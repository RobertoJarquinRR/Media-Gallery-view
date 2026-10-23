import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { App, TFile } from 'obsidian';
import { openMediaFile } from '../core/openNative';
import { FileCard, FileCardOptions } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';
import { SettingsManager } from '../settings/SettingsManager';

export class VideoGallery implements GalleryProcessor {
	readonly supportedType = 'video';
	readonly supportedExtensions = ['mkv', 'mov', 'mp4', 'ogv', 'webm'] as const;

	private grid: GalleryGrid | null = null;
	private readonly overlay: OverlayManager;

	constructor(
		app: App,
		private readonly settings: SettingsManager
	) {
		this.overlay = new OverlayManager(app);
	}

	process(
		files: GalleryFile[],
		container: HTMLElement,
		app: App,
		options: GalleryRenderOptions
	): void {
		this.grid?.destroy();
		this.grid = new GalleryGrid(
			'mg-gallery-grid',
			container.ownerDocument,
			options.cardHeight
		);

		container.empty();
		container.appendChild(this.grid.getElement());

		if (files.length === 0) {
			this.grid.showEmptyMessage('Video not found');
			return;
		}

		const mediaAttributes: Record<string, string> = {
			preload: 'metadata',
			playsinline: 'true',
		};
		const overlayAttributes: Record<string, string> = {
			preload: 'auto',
			playsinline: 'true',
		};
		if (options.videoControls) {
			mediaAttributes.controls = 'true';
			overlayAttributes.controls = 'true';
		}
		if (options.videoMuted) {
			mediaAttributes.muted = 'true';
			overlayAttributes.muted = 'true';
		}
		if (options.videoAutoplay) {
			mediaAttributes.autoplay = 'true';
			overlayAttributes.autoplay = 'true';
		}
		if (options.videoLoop) {
			mediaAttributes.loop = 'true';
			overlayAttributes.loop = 'true';
		}

		const gridElement = this.grid.getElement();

		this.overlay.setOptions({
			arrowsVisible: options.overlayArrows,
			onArrowsVisibleChange: options.onOverlayArrowsChange,
			videoAttributes: overlayAttributes,
			onOpenExternal: (item) => this.openItem(app, item.file),
		});

		for (const file of files) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'video',
				mediaAttributes,
				showFileName: options.showFileNames,
				doubleClickMedia: true,
				onClick: (clicked: TFile, event: MouseEvent) => {
					if (this.isInControlsBand(event, options.videoControls)) {
						return;
					}

					event.preventDefault();
					this.pauseVideos(gridElement);

					const index = files.findIndex(
						(item) => item.file.path === clicked.path
					);
					this.overlay.open(files, index, 'video');
				},
				onDoubleClick: (file: TFile, event: MouseEvent) => {
					if (this.isInControlsBand(event, options.videoControls)) {
						return;
					}
					this.openItem(app, file);
				},
			};

			const card = new FileCard(app, cardOptions);
			this.grid.addCard(card.getElement());
		}
	}

	private isInControlsBand(event: MouseEvent, controls: boolean): boolean {
		if (!controls) return false;
		const target = event.target as HTMLElement;
		const bounds = target.getBoundingClientRect();
		return event.clientY > bounds.bottom - 40;
	}

	private openItem(app: App, file: TFile): void {
		this.overlay.close();
		openMediaFile(app, file, this.settings.getSettings().openWith);
	}

	private pauseVideos(root: HTMLElement): void {
		root.querySelectorAll('video').forEach((video) => video.pause());
	}

	destroy(): void {
		this.grid?.destroy();
		this.grid = null;
		this.overlay.destroy();
	}
}