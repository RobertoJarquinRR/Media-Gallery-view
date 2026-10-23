import { App, TFile } from 'obsidian';
import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { openMediaFile } from '../core/openNative';
import { FileCard } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';
import { SettingsManager } from '../settings/SettingsManager';

type ThumbnailResolver = NonNullable<GalleryRenderOptions['thumbnails']>;
type CardJob = { card: FileCard; item: GalleryFile };

const PREVIEW_DELAY = 150;
const PREFETCH_DELAY = 800;
const PREFETCH_CONCURRENCY = 4;

export class ImageGallery implements GalleryProcessor {
	static readonly type = 'image';
	static readonly extensions = [
		'avif',
		'bmp',
		'gif',
		'jpeg',
		'jpg',
		'png',
		'svg',
		'webp',
	] as const;

	readonly supportedType = ImageGallery.type;
	readonly supportedExtensions = ImageGallery.extensions;

	private grid: GalleryGrid | null = null;
	private readonly overlay: OverlayManager;
	private observer: IntersectionObserver | null = null;
	private prefetchToken = 0;

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
			this.grid.showEmptyMessage(options.labels?.empty ?? 'Images not found');
			return;
		}

		const thumbnails = options.thumbnails;

		this.overlay.setOptions({
			arrowsVisible: options.overlayArrows,
			onArrowsVisibleChange: options.onOverlayArrowsChange,
			videoAttributes: {},
			onOpenExternal: (item) => this.openItem(app, item.file),
			thumbSrc: (item) => thumbnails?.getKnown(item.file)?.src,
		});

		this.observer?.disconnect();
		this.observer = null;
		this.prefetchToken += 1;
		const token = this.prefetchToken;

		const pending = new Map<string, CardJob>();
		const jobs: CardJob[] = [];
		const canObserve = typeof IntersectionObserver === 'function';
		const observer = canObserve
			? new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (!entry.isIntersecting) continue;

							const path = (entry.target as HTMLElement).dataset.path;
							const job = path ? pending.get(path) : undefined;
							if (!job) continue;

							observer?.unobserve(entry.target);
							pending.delete(job.item.file.path);
							void this.resolveThumbnail(
								thumbnails,
								job.card,
								job.item,
								'high'
							);
						}
					},
					{ rootMargin: '1200px 0px' }
				)
			: null;

		this.observer = observer;

		for (const item of files) {
			const cardOptions = {
				file: item.file,
				resourcePath: thumbnails ? '' : item.resourcePath,
				mediaTag: 'img' as const,
				mediaAttributes: { alt: item.file.basename },
				showFileName: options.showFileNames,
				doubleClickMedia: true,
				onClick: (file: TFile) => {
					const index = files.findIndex((entry) => entry.file.path === file.path);
					this.overlay.open(files, index, 'image');
				},
				onDoubleClick: (file: TFile) => {
					this.openItem(app, file);
				},
			};

			const card = new FileCard(app, cardOptions);
			this.grid.addCard(card.getElement());

			if (!thumbnails) continue;

			const known = thumbnails.getKnown(item.file);
			if (known) {
				card.setMediaSource(known.src);
				continue;
			}

			const job = { card, item };
			jobs.push(job);

			if (observer) {
				pending.set(item.file.path, job);
				observer.observe(card.getElement());
			} else {
				void this.resolveThumbnail(thumbnails, card, item, 'high');
			}
		}

		if (!thumbnails || jobs.length === 0) return;

		window.setTimeout(() => {
			void this.loadPreviews(thumbnails, jobs, token);
		}, PREVIEW_DELAY);

		window.setTimeout(() => {
			void this.prefetchThumbnails(thumbnails, jobs, token);
		}, PREFETCH_DELAY);
	}

	private async loadPreviews(
		thumbnails: ThumbnailResolver,
		jobs: CardJob[],
		token: number
	): Promise<void> {
		if (!thumbnails.resolvePreview) return;

		for (const job of jobs) {
			if (token !== this.prefetchToken) return;
			if (!job.card.getElement().isConnected) continue;
			if (thumbnails.getKnown(job.item.file)) continue;

			const preview = await thumbnails.resolvePreview(job.item.file);
			if (!preview || token !== this.prefetchToken) continue;
			if (!job.card.getElement().isConnected) continue;
			if (thumbnails.getKnown(job.item.file)) continue;

			job.card.setMediaSource(preview);
		}
	}

	private async prefetchThumbnails(
		thumbnails: ThumbnailResolver,
		jobs: CardJob[],
		token: number
	): Promise<void> {
		let cursor = 0;

		const worker = async (): Promise<void> => {
			while (cursor < jobs.length) {
				if (token !== this.prefetchToken) return;

				const job = jobs[cursor];
				cursor += 1;
				if (!job) return;

				if (!job.card.getElement().isConnected) continue;
				if (thumbnails.getKnown(job.item.file)) continue;

				await this.resolveThumbnail(thumbnails, job.card, job.item, 'low');
				await new Promise<void>((resolve) => {
					window.setTimeout(resolve, 0);
				});
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(PREFETCH_CONCURRENCY, jobs.length) }, worker)
		);
	}

	private async resolveThumbnail(
		thumbnails: ThumbnailResolver | undefined,
		card: FileCard,
		item: GalleryFile,
		priority: 'high' | 'normal' | 'low'
	): Promise<void> {
		if (!thumbnails) return;

		try {
			const info = await thumbnails.resolve(item.file, 'image', priority);
			if (!info || !card.getElement().isConnected) return;
			card.setMediaSource(info.src);
		} catch (error) {
			console.error(
				`[MediaGallery] Could not resolve thumbnail for ${item.file.path}`,
				error
			);
		}
	}

	private openItem(app: App, file: TFile): void {
		this.overlay.close();
		openMediaFile(app, file, this.settings.getSettings().openWith);
	}

	destroy(): void {
		this.prefetchToken += 1;
		this.observer?.disconnect();
		this.observer = null;
		this.grid?.destroy();
		this.grid = null;
		this.overlay.destroy();
	}
}