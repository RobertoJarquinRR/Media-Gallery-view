import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { App, TFile } from 'obsidian';
import { FileCard, FileCardOptions } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';

export class VideoGallery implements GalleryProcessor {
	readonly supportedType = 'video';
	readonly supportedExtensions = ['mkv', 'mov', 'mp4', 'ogv', 'webm'] as const;

	private grid: GalleryGrid | null = null;

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
			preload: 'none',
			playsinline: 'true',
		};
		if (options.videoControls) mediaAttributes.controls = 'true';
		if (options.videoMuted) mediaAttributes.muted = 'true';
		if (options.videoAutoplay) mediaAttributes.autoplay = 'true';
		if (options.videoLoop) mediaAttributes.loop = 'true';

		for (const file of files) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'video',
				mediaAttributes,
				showFileName: options.showFileNames,
				deferSource: true,
				onDoubleClick: (file: TFile) => {
					void app.workspace.openLinkText(file.path, '', true);
				},
			};

			const card = new FileCard(app, cardOptions);
			this.grid.addCard(card.getElement());
		}

		this.grid.lazyLoadMedia();
	}

	destroy(): void {
		this.grid?.destroy();
		this.grid = null;
	}
}