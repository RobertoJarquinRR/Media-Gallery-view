import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { App, TFile } from 'obsidian';
import { FileCard, FileCardOptions } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';

export class VideoGallery implements GalleryProcessor {
	readonly supportedType = 'video';
	readonly supportedExtensions = ['mkv', 'mov', 'mp4', 'ogv', 'webm'] as const;

	private grid: GalleryGrid | null = null;
	private readonly overlay: OverlayManager;

	constructor(app: App) {
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

		container.innerHTML = '';
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

		this.overlay.setOptions({
			arrowsVisible: options.overlayArrows,
			onArrowsVisibleChange: options.onOverlayArrowsChange,
			videoAttributes: overlayAttributes,
		});

		for (const file of files) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'video',
				mediaAttributes,
				showFileName: options.showFileNames,
				onClick: (clicked: TFile, event: MouseEvent) => {
					const target = event.target as HTMLElement;
					const bounds = target.getBoundingClientRect();
					if (event.clientY > bounds.bottom - 40) {
						return;
					}
					const index = files.findIndex(
						(item) => item.file.path === clicked.path
					);
					this.overlay.open(files, index, 'video');
				},
				onDoubleClick: (file: TFile) => {
					void app.workspace.openLinkText(file.path, '', true);
				},
			};

			const card = new FileCard(app, cardOptions);
			this.grid.addCard(card.getElement());
		}
	}

	destroy(): void {
		this.grid?.destroy();
		this.grid = null;
		this.overlay.destroy();
	}
}