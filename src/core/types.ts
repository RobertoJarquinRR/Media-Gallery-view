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

export type SortOrder =
	| 'name-asc'
	| 'name-desc'
	| 'mtime-desc'
	| 'mtime-asc'
	| 'size-desc'
	| 'size-asc';

export type ThumbnailKind = 'pdf';

export interface ThumbnailInfo {
	src: string;
	width?: number;
	height?: number;
	source: 'custom' | 'generated';
}

export interface ThumbnailResolver {
	resolve(file: TFile, kind: ThumbnailKind): Promise<ThumbnailInfo | null>;
	getKnown(file: TFile): ThumbnailInfo | null;
}

export interface GalleryRenderOptions {
	cardHeight: number;
	showFileNames: boolean;
	videoControls: boolean;
	videoMuted: boolean;
	videoAutoplay: boolean;
	videoLoop: boolean;
	overlayArrows: boolean;
	onOverlayArrowsChange: (visible: boolean) => void;
	thumbnails?: ThumbnailResolver;
}

export interface GalleryProcessor {
	readonly supportedType: string;
	readonly supportedExtensions: readonly string[];
	process(
		files: GalleryFile[],
		container: HTMLElement,
		app: App,
		options: GalleryRenderOptions
	): void;
	destroy?(): void;
}

export interface FileScannerOptions {
	vault: App['vault'];
	normalizePath: (path: string) => string;
}