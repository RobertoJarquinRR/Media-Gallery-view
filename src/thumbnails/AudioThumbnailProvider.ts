import { App, Platform, TFile, TFolder } from 'obsidian';
import * as mm from 'music-metadata';
import {
	encodeImageBuffer,
	generateImageThumbnail,
} from './ImageThumbnailProvider';

const MIME_TYPES: Record<string, string> = {
	mp3: 'audio/mpeg',
	flac: 'audio/flac',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	m4a: 'audio/mp4',
	wav: 'audio/wav',
	aac: 'audio/aac',
	opus: 'audio/opus',
	wma: 'audio/x-ms-wma',
	aiff: 'audio/aiff',
	aif: 'audio/aiff',
};

const COVER_BASENAMES = [
	'cover',
	'folder',
	'front',
	'album',
	'albumart',
	'artwork',
	'thumb',
];

const COVER_EXTENSIONS = new Set([
	'avif',
	'bmp',
	'gif',
	'jpeg',
	'jpg',
	'png',
	'webp',
]);

const AUDIO_QUALITY = 0.85;

export interface GeneratedThumbnail {
	data: ArrayBuffer;
	width: number;
	height: number;
	extension: 'webp' | 'png';
}

interface Picture {
	data: Uint8Array;
	format: string;
}

interface NodeFs {
	openSync(path: string, flags: string): number;
	readSync(
		fd: number,
		buffer: Uint8Array,
		offset: number,
		length: number,
		position: number
	): number;
	closeSync(fd: number): void;
}

interface AdapterWithFullPath {
	getFullPath?(path: string): string;
}

export async function generateAudioThumbnail(
	app: App,
	file: TFile,
	targetSize: number
): Promise<GeneratedThumbnail | null> {
	const mime =
		MIME_TYPES[file.extension.toLowerCase()] ?? `audio/${file.extension}`;

	const picture = await extractEmbeddedPicture(app, file, mime);
	if (picture) {
		const encoded = await encodeImageBuffer(
			picture.data,
			picture.format,
			targetSize,
			AUDIO_QUALITY
		);
		if (encoded) return encoded;
	}

	const cover = findFolderCover(file);
	if (cover) {
		return generateImageThumbnail(app, cover, targetSize, AUDIO_QUALITY);
	}

	return null;
}

async function extractEmbeddedPicture(
	app: App,
	file: TFile,
	mime: string
): Promise<Picture | null> {
	const fs = getNodeFs();
	const fullPath = getFullPath(app, file);

	if (fs && fullPath) {
		const end = metadataEnd(fs, fullPath, file.extension.toLowerCase());
		if (end !== null && end > 0 && end <= file.stat.size) {
			const head = readPrefix(fs, fullPath, end);
			if (head) return parsePicture(head, mime);
		}
	}

	try {
		const data = new Uint8Array(await app.vault.adapter.readBinary(file.path));
		const picture = await parsePicture(data, mime);
		if (picture && (await canDecode(picture))) {
			return picture;
		}
	} catch (error) {
		console.warn(`[MediaGallery] Could not read ${file.path}`, error);
	}

	return null;
}

function metadataEnd(fs: NodeFs, path: string, extension: string): number | null {
	let fd: number | null = null;

	try {
		fd = fs.openSync(path, 'r');

		if (extension === 'flac') {
			const magic = new Uint8Array(4);
			if (fs.readSync(fd, magic, 0, 4, 0) < 4) return null;
			if (String.fromCharCode(...magic) !== 'fLaC') return null;

			let offset = 4;
			for (let index = 0; index < 128; index += 1) {
				const header = new Uint8Array(4);
				if (fs.readSync(fd, header, 0, 4, offset) < 4) return null;

				const view = new DataView(header.buffer);
				const last = (view.getUint8(0) & 0x80) !== 0;
				const length =
					(view.getUint8(1) << 16) |
					(view.getUint8(2) << 8) |
					view.getUint8(3);
				offset += 4 + length;

				if (last) return offset;
			}

			return null;
		}

		if (extension === 'mp3') {
			const header = new Uint8Array(10);
			if (fs.readSync(fd, header, 0, 10, 0) < 10) return null;

			const view = new DataView(header.buffer);
			if (
				view.getUint8(0) !== 0x49 ||
				view.getUint8(1) !== 0x44 ||
				view.getUint8(2) !== 0x33
			) {
				return null;
			}

			const size =
				((view.getUint8(6) & 0x7f) << 21) |
				((view.getUint8(7) & 0x7f) << 14) |
				((view.getUint8(8) & 0x7f) << 7) |
				(view.getUint8(9) & 0x7f);
			const footer = (view.getUint8(5) & 0x10) !== 0 ? 10 : 0;

			return 10 + size + footer;
		}

		return null;
	} catch {
		return null;
	} finally {
		if (fd !== null) fs.closeSync(fd);
	}
}

async function parsePicture(data: Uint8Array, mime: string): Promise<Picture | null> {
	try {
		const metadata = await mm.parseBuffer(data, mime, { duration: false });
		const pictures = metadata.common.picture;
		if (!pictures || pictures.length === 0) return null;

		const picture = pictures[0];
		if (!picture?.data || picture.data.byteLength === 0) return null;

		return {
			data: new Uint8Array(
				picture.data.buffer,
				picture.data.byteOffset,
				picture.data.byteLength
			).slice(),
			format: picture.format || 'image/jpeg',
		};
	} catch {
		return null;
	}
}

async function canDecode(picture: Picture): Promise<boolean> {
	try {
		const copy = new Uint8Array(picture.data.byteLength);
		copy.set(picture.data);
		const bitmap = await createImageBitmap(
			new Blob([copy], { type: picture.format })
		);
		const valid = bitmap.width > 0 && bitmap.height > 0;
		bitmap.close();
		return valid;
	} catch {
		return false;
	}
}

const folderCoverCache = new Map<string, TFile | null>();

function findFolderCover(file: TFile): TFile | null {
	const folder = file.parent;
	if (!(folder instanceof TFolder)) return null;

	const cached = folderCoverCache.get(folder.path);
	if (cached !== undefined) return cached;

	const candidates = folder.children.filter(
		(child): child is TFile =>
			child instanceof TFile &&
			COVER_EXTENSIONS.has(child.extension.toLowerCase())
	);

	if (candidates.length === 0) {
		folderCoverCache.set(folder.path, null);
		return null;
	}

	for (const name of COVER_BASENAMES) {
		const match = candidates.find(
			(candidate) =>
				candidate.basename.toLowerCase().replace(/[\s_-]/g, '') === name
		);
		if (match) {
			folderCoverCache.set(folder.path, match);
			return match;
		}
	}

	const loose =
		candidates.find((candidate) =>
			/(cover|folder|front|album|artwork)/i.test(candidate.basename)
		) ?? null;

	folderCoverCache.set(folder.path, loose);
	return loose;
}

function getNodeFs(): NodeFs | null {
	if (!Platform.isDesktopApp) return null;

	try {
		const globalWindow = window as Window & {
			require?: (id: string) => unknown;
		};
		const require = globalWindow.require;
		if (typeof require !== 'function') return null;
		// eslint-disable-next-line import/no-nodejs-modules
		return require('fs') as NodeFs;
	} catch {
		return null;
	}
}

function getFullPath(app: App, file: TFile): string | null {
	const adapter = app.vault.adapter as AdapterWithFullPath;
	if (typeof adapter.getFullPath !== 'function') return null;

	try {
		return adapter.getFullPath(file.path);
	} catch {
		return null;
	}
}

function readPrefix(fs: NodeFs, path: string, bytes: number): Uint8Array | null {
	try {
		const fd = fs.openSync(path, 'r');
		try {
			const buffer = new Uint8Array(bytes);
			const read = fs.readSync(fd, buffer, 0, bytes, 0);
			return buffer.subarray(0, read);
		} finally {
			fs.closeSync(fd);
		}
	} catch {
		return null;
	}
}