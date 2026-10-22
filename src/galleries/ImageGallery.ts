import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { App, TFile } from 'obsidian';
import { FileCard, FileCardOptions } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';

export class ImageGallery implements GalleryProcessor {
	readonly supportedType = 'image';
	readonly supportedExtensions = [
		'avif',
		'bmp',
		'gif',
		'jpeg',
		'jpg',
		'png',
		'svg',
		'webp',
	] as const;

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
			this.grid.showEmptyMessage('Images not found');
			return;
		}

		for (const file of files) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'img',
				mediaAttributes: {
					loading: 'lazy',
					decoding: 'async',
				},
				showFileName: options.showFileNames,
				deferSource: false,
				onClick: (file: TFile, tag: string) => {
					this.overlay.open(file, tag);
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