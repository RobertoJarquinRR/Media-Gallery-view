import { App, TFile } from 'obsidian';
import {
	GalleryFile,
	GalleryProcessor,
	GalleryRenderOptions,
	ThumbnailResolver,
} from '../core/types';
import { openMediaFile } from '../core/openNative';
import { FileCard } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';
import { PdfViewer } from '../ui/PdfViewer';
import { SettingsManager } from '../settings/SettingsManager';

export class PdfGallery implements GalleryProcessor {
	static readonly type = 'pdf';
	static readonly extensions = ['pdf'] as const;

	readonly supportedType = PdfGallery.type;
	readonly supportedExtensions = PdfGallery.extensions;

	private grid: GalleryGrid | null = null;
	private readonly overlay: OverlayManager;
	private viewer: PdfViewer | null = null;
	private observer: IntersectionObserver | null = null;

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
			options.cardHeight,
			options.layoutMode
		);

		container.empty();
		container.appendChild(this.grid.getElement());

		if (files.length === 0) {
			this.grid.showEmptyMessage(options.labels?.empty ?? 'PDF not found');
			return;
		}

		const thumbnails = options.thumbnails;
		if (!thumbnails) {
			this.grid.showEmptyMessage(
				options.labels?.thumbnailsUnavailable ?? 'Thumbnail service unavailable'
			);
			return;
		}

		this.overlay.setOptions({
			arrowsVisible: options.overlayArrows,
			onArrowsVisibleChange: options.onOverlayArrowsChange,
			videoAttributes: {},
			renderContent: (item, stage) => {
				const preview = thumbnails.getKnown(item.file)?.src;
				const viewer = new PdfViewer(app, item.file, preview);
				this.viewer = viewer;
				void viewer.mount(stage);

				return {
					destroy: () => {
						if (this.viewer === viewer) this.viewer = null;
						viewer.destroy();
					},
				};
			},
			thumbSrc: (item) => thumbnails.getKnown(item.file)?.src,
			onOpenExternal: (item) => this.openPdf(app, item.file),
			onDoubleClickContent: (item) => this.openPdf(app, item.file),
			onKeyDown: (event) => this.viewer?.handleKey(event) ?? false,
		});

		this.observer?.disconnect();
		this.observer = null;

		const pending = new Map<string, { card: FileCard; item: GalleryFile }>();
		const canObserve = typeof IntersectionObserver === 'function';
		const observer = canObserve
			? new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (!entry.isIntersecting) continue;

							const path = (entry.target as HTMLElement).dataset.path;
							const entryData = path ? pending.get(path) : undefined;
							if (!entryData) continue;

							observer?.unobserve(entry.target);
							pending.delete(entryData.item.file.path);
							this.resolveThumbnail(
								thumbnails,
								entryData.card,
								entryData.item
							);
						}
					},
					{ rootMargin: '300px 0px' }
				)
			: null;

		this.observer = observer;

		for (const item of files) {
			const card = new FileCard(app, {
				file: item.file,
				resourcePath: '',
				mediaTag: 'img',
				mediaAttributes: { alt: item.file.basename },
				showFileName: options.showFileNames,
				mediaWidth: 595,
				mediaHeight: 842,
				doubleClickMedia: true,
				onClick: (clicked: TFile) => {
					const index = files.findIndex(
						(entry) => entry.file.path === clicked.path
					);
					this.overlay.open(files, index, 'pdf');
				},
				onDoubleClick: (clicked: TFile) => {
					this.openPdf(app, clicked);
				},
			});

			this.grid.addCard(card.getElement());
			card.getElement().classList.add('mg-card-vertical');

			const known = thumbnails.getKnown(item.file);
			if (known) {
				card.setMediaSource(known.src, known.width, known.height);
				continue;
			}

			if (observer) {
				pending.set(item.file.path, { card, item });
				observer.observe(card.getElement());
			} else {
				this.resolveThumbnail(thumbnails, card, item);
			}
		}
	}

	private openPdf(app: App, file: TFile): void {
		this.overlay.close();
		openMediaFile(app, file, this.settings.getSettings().openWith);
	}

	private resolveThumbnail(
		thumbnails: ThumbnailResolver,
		card: FileCard,
		item: GalleryFile
	): void {
		void thumbnails
			.resolve(item.file, 'pdf')
			.then((info) => {
				if (!info || !card.getElement().isConnected) return;
				card.setMediaSource(info.src, info.width, info.height);
			})
			.catch((error: unknown) => {
				console.error(
					`[MediaGallery] Could not resolve thumbnail for ${item.file.path}`,
					error
				);
			});
	}

	destroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.grid?.destroy();
		this.grid = null;
		this.overlay.destroy();
		this.viewer = null;
	}
}
