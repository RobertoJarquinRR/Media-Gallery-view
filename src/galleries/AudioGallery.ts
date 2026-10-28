import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from '../core/types';
import { openMediaFile } from '../core/openNative';
import { FileCard } from '../ui/FileCard';
import { GalleryGrid } from '../ui/GalleryGrid';
import { OverlayManager } from '../ui/OverlayManager';
import { AudioPlayer } from '../ui/AudioPlayer';
import { DEFAULT_AUDIO_ARTWORK, DEFAULT_AUDIO_ARTWORK_SIZE } from '../ui/defaultArtwork';
import { SettingsManager } from '../settings/SettingsManager';

export class AudioGallery implements GalleryProcessor {
	static readonly type = 'audio';
	static readonly extensions = [
		'mp3',
		'flac',
		'ogg',
		'oga',
		'm4a',
		'wav',
		'aac',
		'opus',
		'wma',
		'aiff',
		'aif',
	] as const;

	readonly supportedType = AudioGallery.type;
	readonly supportedExtensions = AudioGallery.extensions;

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
			options.cardHeight,
			options.layoutMode,
			{
				columns: options.masonryColumns,
				gap: options.masonryGap,
				minWidth: options.masonryMinWidth,
			}
		);

		container.empty();
		container.appendChild(this.grid.getElement());

		if (files.length === 0) {
			this.grid.showEmptyMessage(options.labels?.empty ?? 'Audio files not found');
			return;
		}

		const thumbnails = options.thumbnails;
		if (!thumbnails) {
			this.grid.showEmptyMessage(options.labels?.thumbnailsUnavailable ?? 'Thumbnail service unavailable');
			return;
		}

		this.overlay.setOptions({
			arrowsVisible: options.overlayArrows,
			onArrowsVisibleChange: options.onOverlayArrowsChange,
			videoAttributes: {},
			renderContent: (item, stage) => {
				const wrapper = createDiv({ cls: 'mg-audio-player mg-audio-native' });
				stage.appendChild(wrapper);

				const component = new Component();
				component.load();

				let fallbackPlayer: AudioPlayer | null = null;
				const mountFallback = () => {
					if (fallbackPlayer) return;
					wrapper.classList.remove('mg-audio-native');
					wrapper.empty();
					fallbackPlayer = new AudioPlayer(
						app,
						item.file,
						thumbnails.getKnown(item.file)?.src ?? DEFAULT_AUDIO_ARTWORK,
						{
							autoplay: options.audioAutoplay,
						},
						item.resourcePath
					);
					void fallbackPlayer.mount(wrapper);
				};

				void MarkdownRenderer.render(
					app,
					`![[${item.file.path}]]`,
					wrapper,
					item.file.path,
					component
				)
					.then(() => {
						const audio = wrapper.querySelector('audio');
						if (!audio) {
							mountFallback();
							return;
						}
						if (options.audioAutoplay) {
							void audio.play().catch(() => {});
						}
					})
					.catch((error: unknown) => {
						console.error(
							`[MediaGallery] Native audio embed failed for ${item.file.path}`,
							error
						);
						mountFallback();
					});

				return {
					destroy: () => {
						fallbackPlayer?.destroy();
						fallbackPlayer = null;
						component.unload();
					},
				};
			},
			thumbSrc: (item) =>
				thumbnails.getKnown(item.file)?.src ?? DEFAULT_AUDIO_ARTWORK,
			onOpenExternal: (item) => this.openItem(app, item.file),
			onKeyDown: () => false,
		});

		for (const item of files) {
			const card = new FileCard({
				file: item.file,
				resourcePath: '',
				mediaTag: 'img',
				mediaAttributes: { alt: item.file.basename },
				showFileName: options.showFileNames,
				mediaWidth: 300,
				mediaHeight: 300,
				doubleClickMedia: true,
				onClick: (clicked: TFile) => {
					const index = files.findIndex(
						(entry) => entry.file.path === clicked.path
					);
					this.overlay.open(files, index, 'audio');
				},
				onDoubleClick: (clicked: TFile) => {
					this.openItem(app, clicked);
				},
			});

			this.grid.addCard(card.getElement());
			card.getElement().classList.add('mg-card-audio');

			const known = thumbnails.getKnown(item.file);
			if (known) {
				card.setMediaSource(known.src, known.width, known.height);
			} else {
				card.setMediaSource(
					DEFAULT_AUDIO_ARTWORK,
					DEFAULT_AUDIO_ARTWORK_SIZE,
					DEFAULT_AUDIO_ARTWORK_SIZE
				);
				void thumbnails
					.resolve(item.file, 'audio')
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
		}
	}

	destroy(): void {
		this.grid?.destroy();
		this.grid = null;
		this.overlay.destroy();
	}

	private openItem(app: App, file: TFile): void {
		this.overlay.close();
		openMediaFile(app, file, this.settings.getSettings().openWith);
	}
}
