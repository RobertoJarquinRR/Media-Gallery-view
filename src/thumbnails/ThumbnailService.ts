import { App, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import { ThumbnailInfo, ThumbnailKind, ThumbnailResolver } from '../core/types';
import { generatePdfThumbnail } from './PdfThumbnailProvider';
import { disposePdfWorker } from './pdfWorker';

const CACHE_VERSION = 1;
const CACHE_FILE = 'thumbnails.json';
const CACHE_FOLDER = 'thumbnails';
const THUMBNAIL_SIZE = 1600;
const FAILURE_TTL = 60 * 60 * 1000;
const MAX_CONCURRENT_JOBS = 2;

const IMAGE_EXTENSIONS = new Set([
	'avif',
	'bmp',
	'gif',
	'jpeg',
	'jpg',
	'png',
	'svg',
	'webp',
]);

const IMAGE_PRIORITY = ['png', 'webp', 'jpg', 'jpeg', 'avif', 'gif', 'svg', 'bmp'];

interface CacheEntry {
	mtime: number;
	size: number;
	file: string;
	width?: number;
	height?: number;
	source: 'generated';
	failedAt?: number;
	error?: string;
}

interface CacheIndex {
	version: number;
	entries: Record<string, CacheEntry>;
}

interface GeneratedFile {
	data: ArrayBuffer;
	path: string;
	width: number;
	height: number;
}

export class ThumbnailService implements ThumbnailResolver {
	private readonly app: App;
	private readonly plugin: Plugin;
	private readonly generatedDir: string;
	private readonly indexPath: string;
	private readonly cache: CacheIndex = { version: CACHE_VERSION, entries: {} };
	private readonly known = new Map<
		string,
		{ info: ThumbnailInfo; mtime: number; size: number }
	>();
	private readonly pending = new Map<string, Promise<ThumbnailInfo | null>>();
	private readonly custom = new Map<string, TFile>();
	private readonly blobUrls = new Set<string>();
	private readonly queue: Array<() => void> = [];
	private customFolder = '';
	private activeJobs = 0;
	private saveTimer: number | null = null;
	private customTimer: number | null = null;
	private loaded: Promise<void> | null = null;
	private destroyed = false;
	private failureNotified = false;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;

		const baseDir = `${app.vault.configDir}/plugins/${plugin.manifest.id}`;
		this.generatedDir = `${baseDir}/${CACHE_FOLDER}`;
		this.indexPath = `${baseDir}/${CACHE_FILE}`;

		plugin.registerEvent(
			app.vault.on('create', (file) => this.handleVaultChange(file.path))
		);
		plugin.registerEvent(
			app.vault.on('delete', (file) => this.handleVaultChange(file.path))
		);
		plugin.registerEvent(
			app.vault.on('rename', (file, oldPath) => {
				this.handleVaultChange(oldPath);
				this.handleVaultChange(file.path);
			})
		);
	}

	async init(customFolder: string): Promise<void> {
		this.setCustomFolder(customFolder);
		await this.ensureLoaded();
	}

	setCustomFolder(folder: string): void {
		const normalized = folder.trim();
		const next = normalized
			? normalizePath(normalized).replace(/\/+$/, '')
			: '';

		if (next === this.customFolder) return;

		this.customFolder = next;
		this.rebuildCustomIndex();
	}

	async resolve(file: TFile, kind: ThumbnailKind): Promise<ThumbnailInfo | null> {
		if (this.destroyed) return null;

		const known = this.known.get(file.path);
		if (
			known &&
			known.mtime === file.stat.mtime &&
			known.size === file.stat.size
		) {
			return known.info;
		}

		const inFlight = this.pending.get(file.path);
		if (inFlight) return inFlight;

		const task = this.resolveFile(file, kind).finally(() => {
			this.pending.delete(file.path);
		});
		this.pending.set(file.path, task);
		return task;
	}

	getKnown(file: TFile): ThumbnailInfo | null {
		const known = this.known.get(file.path);
		if (!known) return null;
		if (known.mtime !== file.stat.mtime || known.size !== file.stat.size) {
			return null;
		}
		return known.info;
	}

	destroy(): void {
		this.destroyed = true;

		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		if (this.customTimer !== null) {
			window.clearTimeout(this.customTimer);
			this.customTimer = null;
		}

		void this.saveIndex();

		for (const url of this.blobUrls) {
			URL.revokeObjectURL(url);
		}
		this.blobUrls.clear();
		this.known.clear();
		this.pending.clear();
		this.queue.length = 0;

		disposePdfWorker();
	}

	private async resolveFile(
		file: TFile,
		kind: ThumbnailKind
	): Promise<ThumbnailInfo | null> {
		await this.ensureLoaded();

		const customFile = this.custom.get(file.basename.toLowerCase());
		if (customFile) {
			const info: ThumbnailInfo = {
				src: this.app.vault.getResourcePath(customFile),
				source: 'custom',
			};
			this.known.set(file.path, {
				info,
				mtime: file.stat.mtime,
				size: file.stat.size,
			});
			return info;
		}

		const entry = this.cache.entries[file.path];
		if (entry) {
			if (this.isFreshFailure(entry, file)) return null;

			if (this.isValidEntry(entry, file)) {
				const info = await this.toInfo(entry.file, entry.width, entry.height);
				if (info) {
					this.known.set(file.path, {
						info,
						mtime: file.stat.mtime,
						size: file.stat.size,
					});
					return info;
				}
			}
		}

		let generated: GeneratedFile | null = null;
		try {
			generated = await this.enqueue(() => this.generateThumbnail(file, kind));
		} catch (error) {
			this.markFailure(file, error);
			return null;
		}

		if (!generated) {
			this.markFailure(file, new Error('Unsupported thumbnail type'));
			return null;
		}

		await this.removeStaleFile(entry?.file, generated.path);
		await this.app.vault.adapter.writeBinary(generated.path, generated.data);

		this.cache.entries[file.path] = {
			mtime: file.stat.mtime,
			size: file.stat.size,
			file: generated.path,
			width: generated.width,
			height: generated.height,
			source: 'generated',
		};
		this.scheduleSave();

		const info = await this.toInfo(
			generated.path,
			generated.width,
			generated.height
		);
		if (info) {
			this.known.set(file.path, {
				info,
				mtime: file.stat.mtime,
				size: file.stat.size,
			});
		}
		return info;
	}

	private async generateThumbnail(
		file: TFile,
		kind: ThumbnailKind
	): Promise<GeneratedFile | null> {
		if (kind !== 'pdf') return null;

		const thumb = await generatePdfThumbnail(this.app, file, THUMBNAIL_SIZE);
		const path = `${this.generatedDir}/${hashPath(file.path)}.${thumb.extension}`;

		return {
			data: thumb.data,
			path,
			width: thumb.width,
			height: thumb.height,
		};
	}

	private async toInfo(
		path: string,
		width?: number,
		height?: number
	): Promise<ThumbnailInfo | null> {
		const src = await this.getResourceUrl(path);
		if (!src) return null;

		return { src, width, height, source: 'generated' };
	}

	private async getResourceUrl(path: string): Promise<string | null> {
		try {
			const url = this.app.vault.adapter.getResourcePath(path);
			if (url) return url;
		} catch {
			// The adapter cannot expose this path as a resource.
		}

		try {
			const data = await this.app.vault.adapter.readBinary(path);
			const url = URL.createObjectURL(new Blob([data], { type: mimeType(path) }));
			this.blobUrls.add(url);
			return url;
		} catch (error) {
			console.error(`[MediaGallery] Could not read thumbnail ${path}`, error);
			return null;
		}
	}

	private async ensureLoaded(): Promise<void> {
		if (!this.loaded) {
			this.loaded = this.loadIndex();
		}
		await this.loaded;
	}

	private async loadIndex(): Promise<void> {
		const adapter = this.app.vault.adapter;

		try {
			if (!(await adapter.exists(this.generatedDir))) {
				await adapter.mkdir(this.generatedDir);
			}

			if (!(await adapter.exists(this.indexPath))) return;

			const raw = await adapter.read(this.indexPath);
			const parsed = JSON.parse(raw) as Partial<CacheIndex>;

			if (parsed.version !== CACHE_VERSION || !parsed.entries) return;
			Object.assign(this.cache.entries, parsed.entries);
		} catch (error) {
			console.error('[MediaGallery] Could not load the thumbnail cache', error);
		}
	}

	private scheduleSave(): void {
		if (this.saveTimer !== null) return;

		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.saveIndex();
		}, 800);
	}

	private async saveIndex(): Promise<void> {
		try {
			await this.app.vault.adapter.write(
				this.indexPath,
				JSON.stringify(this.cache)
			);
		} catch (error) {
			console.error('[MediaGallery] Could not save the thumbnail cache', error);
		}
	}

	private isValidEntry(entry: CacheEntry, file: TFile): boolean {
		return (
			entry.mtime === file.stat.mtime &&
			entry.size === file.stat.size &&
			typeof entry.file === 'string' &&
			entry.file.length > 0
		);
	}

	private isFreshFailure(entry: CacheEntry, file: TFile): boolean {
		return (
			typeof entry.failedAt === 'number' &&
			entry.mtime === file.stat.mtime &&
			entry.size === file.stat.size &&
			Date.now() - entry.failedAt < FAILURE_TTL
		);
	}

	private markFailure(file: TFile, error: unknown): void {
		const message =
			error instanceof Error
				? `${error.name}: ${error.message}`
				: String(error);

		console.error(
			`[MediaGallery] Could not generate thumbnail for ${file.path}`,
			error
		);

		this.cache.entries[file.path] = {
			mtime: file.stat.mtime,
			size: file.stat.size,
			file: '',
			source: 'generated',
			failedAt: Date.now(),
			error: message,
		};
		this.scheduleSave();

		if (!this.failureNotified) {
			this.failureNotified = true;
			new Notice(`Media Gallery: PDF thumbnail failed. ${message}`, 12000);
		}
	}

	private async removeStaleFile(
		previous: string | undefined,
		current: string
	): Promise<void> {
		if (!previous || previous === current) return;

		try {
			if (await this.app.vault.adapter.exists(previous)) {
				await this.app.vault.adapter.remove(previous);
			}
		} catch (error) {
			console.error(`[MediaGallery] Could not remove stale thumbnail ${previous}`, error);
		}
	}

	private enqueue<T>(job: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push(() => {
				this.activeJobs++;
				job()
					.then(resolve, reject)
					.finally(() => {
						this.activeJobs--;
						this.drainQueue();
					});
			});
			this.drainQueue();
		});
	}

	private drainQueue(): void {
		while (this.activeJobs < MAX_CONCURRENT_JOBS && this.queue.length > 0) {
			const job = this.queue.shift();
			job?.();
		}
	}

	private rebuildCustomIndex(): void {
		this.custom.clear();

		if (!this.customFolder || this.destroyed) return;

		const prefix = `${this.customFolder}/`;
		const files = this.app.vault
			.getFiles()
			.filter(
				(file) =>
					file.path.startsWith(prefix) &&
					IMAGE_EXTENSIONS.has(file.extension.toLowerCase())
			)
			.sort((a, b) => {
				const priority =
					imagePriority(a.extension) - imagePriority(b.extension);
				if (priority !== 0) return priority;
				return a.path.localeCompare(b.path);
			});

		for (const file of files) {
			const key = file.basename.toLowerCase();
			if (!this.custom.has(key)) {
				this.custom.set(key, file);
			}
		}

		for (const [path, known] of this.known) {
			if (known.info.source === 'custom') {
				this.known.delete(path);
			}
		}
	}

	private handleVaultChange(path: string): void {
		if (!this.customFolder) return;

		const prefix = `${this.customFolder}/`;
		if (!path.startsWith(prefix)) return;

		if (this.customTimer !== null) {
			window.clearTimeout(this.customTimer);
		}

		this.customTimer = window.setTimeout(() => {
			this.customTimer = null;
			this.rebuildCustomIndex();
		}, 400);
	}
}

function hashPath(path: string): string {
	let first = 0x811c9dc5;
	let second = 0x01000193;

	for (let index = 0; index < path.length; index++) {
		const code = path.charCodeAt(index);
		first = Math.imul(first ^ code, 0x01000193);
		second = Math.imul(second + code, 0x85ebca6b);
	}

	return (
		(first >>> 0).toString(16).padStart(8, '0') +
		(second >>> 0).toString(16).padStart(8, '0')
	);
}

function imagePriority(extension: string): number {
	const priority = IMAGE_PRIORITY.indexOf(extension.toLowerCase());
	return priority === -1 ? IMAGE_PRIORITY.length : priority;
}

function mimeType(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase();

	switch (extension) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		default:
			return 'image/webp';
	}
}
