import { TFile, App } from 'obsidian';

export interface GalleryConfig {
	path: string;
	type: string;
	[key: string]: unknown;
}

export interface ParsedGallerySource {
	config: GalleryConfig;
	rawSource: string;
}

export interface GalleryFile {
	file: TFile;
	resourcePath: string;
}

export interface GalleryProcessor {
	readonly supportedType: string;
	readonly supportedExtensions: readonly string[];
	process(files: GalleryFile[], container: HTMLElement, app: App): void;
	destroy?(): void;
}

export interface FileScannerOptions {
	vault: App['vault'];
	normalizePath: (path: string) => string;
}