import { GalleryProcessor, GalleryFile } from '../core/types';
import { App, TFile } from 'obsidian';
import { FileCard, FileCardOptions } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';

export class VideoGallery implements GalleryProcessor {
	readonly supportedType = 'video';
	readonly supportedExtensions = ['mkv', 'mov', 'mp4', 'ogv', 'webm'] as const;

	private grid!: GalleryGrid;

	process(files: GalleryFile[], container: HTMLElement, app: App): void {
		this.grid = new GalleryGrid('mg-gallery-grid', container.ownerDocument);
		container.innerHTML = '';
		container.appendChild(this.grid.getElement());

		const videoFiles = files.filter((f) =>
			this.supportedExtensions.includes(f.file.extension as typeof this.supportedExtensions[number])
		);

		if (videoFiles.length === 0) {
			this.grid.showEmptyMessage('Video not found');
			return;
		}

		for (const file of videoFiles) {
			const cardOptions: FileCardOptions = {
				file: file.file,
				resourcePath: file.resourcePath,
				mediaTag: 'video',
				mediaAttributes: {
					controls: 'true',
					muted: 'true',
					preload: 'auto',
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
	}
}