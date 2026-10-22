import { TFile } from 'obsidian';
import { GalleryFile, FileScannerOptions } from './types';

export class FileScanner {
	private readonly vault: FileScannerOptions['vault'];
	private readonly normalizePath: FileScannerOptions['normalizePath'];

	constructor(options: FileScannerOptions) {
		this.vault = options.vault;
		this.normalizePath = options.normalizePath;
	}

scan(path: string, extensions: readonly string[]): GalleryFile[] {
			const normalizedPath = this.normalizePath(path);
			const allFiles = this.vault.getFiles();

			const matchedFiles = allFiles.filter((file: TFile) =>
				file.path.startsWith(normalizedPath) && extensions.includes(file.extension)
			);

			return matchedFiles.map((file: TFile) => ({
				file,
				resourcePath: this.vault.getResourcePath(file),
			}));
		}

		scanAll(path: string): GalleryFile[] {
			const normalizedPath = this.normalizePath(path);
			const allFiles = this.vault.getFiles();

			const matchedFiles = allFiles.filter((file: TFile) =>
				file.path.startsWith(normalizedPath)
			);

			return matchedFiles.map((file: TFile) => ({
				file,
				resourcePath: this.vault.getResourcePath(file),
			}));
		}
}