import { TFile, App } from 'obsidian';

export type GalleryType = 'image' | 'pdf' | 'video' | 'audio';
export type LayoutMode = 'masonry' | 'grid';

export interface GalleryLibrary {
	id: string;
	name: string;
	type: GalleryType;
	path: string;
}

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

export type ThumbnailKind = 'pdf' | 'audio' | 'image';

export type ThumbnailPriority = 'high' | 'normal' | 'low';

export interface ThumbnailInfo {
	src: string;
	width?: number;
	height?: number;
	source: 'custom' | 'generated';
}

export interface ThumbnailResolver {
	resolve(
		file: TFile,
		kind: ThumbnailKind,
		priority?: ThumbnailPriority
	): Promise<ThumbnailInfo | null>;
	getKnown(file: TFile): ThumbnailInfo | null;
	resolvePreview?(file: TFile): Promise<string | null>;
}

export interface GalleryRenderOptions {
	cardHeight: number;
	showFileNames: boolean;
	videoControls: boolean;
	videoMuted: boolean;
	videoAutoplay: boolean;
	videoLoop: boolean;
	audioAutoplay: boolean;
	overlayArrows: boolean;
	onOverlayArrowsChange: (visible: boolean) => void;
	thumbnails?: ThumbnailResolver;
	labels?: {
		empty?: string;
		thumbnailsUnavailable?: string;
	};
	layoutMode: LayoutMode;
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