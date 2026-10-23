import { TFile, TFolder } from 'obsidian';
import { GalleryFile, FileScannerOptions, SortOrder } from './types';

export class FileScanner {
	private readonly vault: FileScannerOptions['vault'];
	private readonly normalizePath: FileScannerOptions['normalizePath'];

	constructor(options: FileScannerOptions) {
		this.vault = options.vault;
		this.normalizePath = options.normalizePath;
	}

	scan(
		path: string,
		extensions: readonly string[],
		sortOrder: SortOrder = 'name-asc',
		excludePaths: readonly string[] = []
	): GalleryFile[] {
		const normalizedPath = this.normalizePath(path);
		const root = this.vault.getAbstractFileByPath(normalizedPath);
		if (!(root instanceof TFolder)) return [];

		const files: TFile[] = [];
		this.collect(root, extensions, excludePaths, files);

		return files
			.sort((a, b) => this.compare(a, b, sortOrder))
			.map((file) => ({
				file,
				resourcePath: this.vault.getResourcePath(file),
			}));
	}

	private collect(
		folder: TFolder,
		extensions: readonly string[],
		excludePaths: readonly string[],
		files: TFile[]
	): void {
		for (const child of folder.children) {
			if (this.isExcluded(child.path, excludePaths)) continue;

			if (child instanceof TFolder) {
				this.collect(child, extensions, excludePaths, files);
				continue;
			}

			if (
				child instanceof TFile &&
				extensions.includes(child.extension.toLowerCase())
			) {
				files.push(child);
			}
		}
	}

	private isExcluded(path: string, excludePaths: readonly string[]): boolean {
		return excludePaths.some((excluded) => {
			const normalized = this.normalizePath(excluded).replace(/\/+$/, '');
			if (!normalized) return false;
			return path === normalized || path.startsWith(`${normalized}/`);
		});
	}

	private compare(a: TFile, b: TFile, sortOrder: SortOrder): number {
		switch (sortOrder) {
			case 'name-desc':
				return b.basename.localeCompare(a.basename);
			case 'mtime-desc':
				return b.stat.mtime - a.stat.mtime;
			case 'mtime-asc':
				return a.stat.mtime - b.stat.mtime;
			case 'size-desc':
				return b.stat.size - a.stat.size;
			case 'size-asc':
				return a.stat.size - b.stat.size;
			case 'name-asc':
			default:
				return a.basename.localeCompare(b.basename);
		}
	}
}
