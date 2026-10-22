import { GalleryProcessor, GalleryFile } from '../core/types';
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

	private grid!: GalleryGrid;
	private readonly overlay: OverlayManager;

	constructor(app: App) {
		this.overlay = new OverlayManager(app);
	}

	process(files: GalleryFile[], container: HTMLElement, app: App): void {
		this.grid = new GalleryGrid('mg-gallery-grid', container.ownerDocument);
		container.innerHTML = '';
		container.appendChild(this.grid.getElement());

		const imageFiles = files.filter((f) =>
			this.supportedExtensions.includes(f.file.extension as typeof this.supportedExtensions[number])
		);

		if (imageFiles.length === 0) {
			this.grid.showEmptyMessage('Images not found');
			return;
		}

		for (const file of imageFiles) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'img',
				mediaAttributes: {},
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
		this.grid.destroy();
		this.overlay.destroy();
	}
}