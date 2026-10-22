import { TFile } from 'obsidian';
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
		const allFiles = this.vault.getFiles();

		return allFiles
			.filter(
				(file: TFile) =>
					file.path.startsWith(normalizedPath) &&
					extensions.includes(file.extension) &&
					!this.isExcluded(file, excludePaths)
			)
			.sort((a, b) => this.compare(a, b, sortOrder))
			.map((file: TFile) => ({
				file,
				resourcePath: this.vault.getResourcePath(file),
			}));
	}

	scanAll(path: string, sortOrder: SortOrder = 'name-asc'): GalleryFile[] {
		const normalizedPath = this.normalizePath(path);
		const allFiles = this.vault.getFiles();

		return allFiles
			.filter((file: TFile) => file.path.startsWith(normalizedPath))
			.sort((a, b) => this.compare(a, b, sortOrder))
			.map((file: TFile) => ({
				file,
				resourcePath: this.vault.getResourcePath(file),
			}));
	}

	private isExcluded(file: TFile, excludePaths: readonly string[]): boolean {
		return excludePaths.some((excluded) => {
			const normalized = this.normalizePath(excluded).replace(/\/+$/, '');
			if (!normalized) return false;
			return (
				file.path === normalized ||
				file.path.startsWith(`${normalized}/`)
			);
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