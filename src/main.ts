import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Plugin,
	normalizePath,
} from 'obsidian';
import type { Command } from 'obsidian';

import {
	FileScanner,
	GalleryConfig,
	GalleryProcessor,
	GalleryRegistry,
	GalleryRenderOptions,
	GalleryType,
	parseGallerySource,
	validateConfig,
} from './core';

import { VideoGallery } from './galleries/VideoGallery';
import { ImageGallery } from './galleries/ImageGallery';
import { PdfGallery } from './galleries/PdfGallery';
import { AudioGallery } from './galleries/AudioGallery';
import { ThumbnailService } from './thumbnails/ThumbnailService';
import { disposePdfWorker } from './thumbnails/pdfWorker';

import {
	MediaGallerySettingTab,
	MediaGallerySettings,
	SettingsManager,
} from './settings/SettingsManager';

import { TranslationKey, translate } from './i18n';
import { MediaGalleryView, VIEW_TYPE } from './ui/MediaGalleryView';

const EMPTY_LABEL_KEYS: Record<GalleryType, TranslationKey> = {
	image: 'imagesNotFound',
	pdf: 'pdfNotFound',
	video: 'videoNotFound',
	audio: 'audioNotFound',
};

export default class MediaGallery extends Plugin {
	private registry!: GalleryRegistry;
	private fileScanner!: FileScanner;
	settingsManager!: SettingsManager;
	private thumbnails!: ThumbnailService;
	private readonly codeBlockProcessors = new WeakMap<HTMLElement, GalleryProcessor>();
	private readonly allProcessors = new Set<GalleryProcessor>();
	private ribbonEl: HTMLElement | null = null;
	private command: Command | null = null;
	private unsubscribeSettings?: () => void;

	async onload(): Promise<void> {
		this.settingsManager = new SettingsManager(this);
		const settings = await this.settingsManager.load();
		this.thumbnails = new ThumbnailService(this.app, this);
		await this.thumbnails.init(settings.thumbnailFolder);

		this.registry = new GalleryRegistry();
		this.fileScanner = new FileScanner({
			vault: this.app.vault,
			normalizePath,
		});

		this.registerProcessors();
		this.registerMarkdownProcessor();
		this.registerSettingsTab();
		this.registerGalleryView();

		this.unsubscribeSettings = this.settingsManager.onChange(() => {
			this.updateRibbonVisibility();
		});
		this.updateRibbonVisibility();
	}

	onunload(): void {
		this.unsubscribeSettings?.();
		for (const processor of this.allProcessors) {
			processor.destroy?.();
		}
		this.allProcessors.clear();
		this.thumbnails.destroy();
		disposePdfWorker();
	}

	private registerProcessors(): void {
		this.registry.register(VideoGallery.type, VideoGallery.extensions, () =>
			new VideoGallery(this.app, this.settingsManager)
		);
		this.registry.register(ImageGallery.type, ImageGallery.extensions, () =>
			new ImageGallery(this.app, this.settingsManager)
		);
		this.registry.register(PdfGallery.type, PdfGallery.extensions, () =>
			new PdfGallery(this.app, this.settingsManager)
		);
		this.registry.register(AudioGallery.type, AudioGallery.extensions, () =>
			new AudioGallery(this.app, this.settingsManager)
		);
	}

	private registerMarkdownProcessor(): void {
		this.registerMarkdownCodeBlockProcessor(
			'MediaGallery',
			async (
				source: string,
				container: HTMLElement,
				context: MarkdownPostProcessorContext
			) => {
				try {
					await this.renderGallery(source, container, context);
				} catch (error) {
					this.handleError(container, error);
				}
			}
		);
	}

	private async renderGallery(
		source: string,
		container: HTMLElement,
		context: MarkdownPostProcessorContext
	): Promise<void> {
		const language = this.settingsManager.getSettings().language;
		const { config } = parseGallerySource(source);
		const errors = validateConfig(config);

		if (errors.length > 0) {
			container.createEl('p', {
				text: translate(language, 'configError', {
					message: errors.join(', '),
				}),
			});
			return;
		}

		const previous = this.codeBlockProcessors.get(container);
		if (previous) {
			previous.destroy?.();
			this.allProcessors.delete(previous);
			this.codeBlockProcessors.delete(container);
		}

		const processor = this.renderLibrary(config, container);
		if (processor) {
			this.codeBlockProcessors.set(container, processor);
			this.allProcessors.add(processor);

			const child = new MarkdownRenderChild(container);
			child.register(() => {
				processor.destroy?.();
				this.allProcessors.delete(processor);
				if (this.codeBlockProcessors.get(container) === processor) {
					this.codeBlockProcessors.delete(container);
				}
			});
			context.addChild(child);
		}
	}

	renderLibrary(
		config: GalleryConfig,
		container: HTMLElement
	): GalleryProcessor | null {
		const settings = this.settingsManager.getSettings();
		const language = settings.language;
		const requestedType = (config.type || settings.defaultType).toLowerCase();
		const processor = this.registry.create(requestedType);

		if (!processor) {
			container.createEl('p', {
				text: translate(language, 'unknownType', {
					type: requestedType,
					available: this.registry.getSupportedTypes().join(', '),
				}),
			});
			return null;
		}

		const type = processor.supportedType as GalleryType;
		const extensions = this.resolveExtensions(
			type,
			processor.supportedExtensions,
			settings
		);
		const files = this.fileScanner.scan(
			config.path,
			extensions,
			settings.sortOrder,
			this.getExcludedPaths(settings)
		);

		this.thumbnails.setCustomFolder(settings.thumbnailFolder);
		processor.process(files, container, this.app, this.buildRenderOptions(settings, type));

		return processor;
	}

	private buildRenderOptions(
		settings: MediaGallerySettings,
		type: GalleryType
	): GalleryRenderOptions {
		const language = settings.language;

		return {
			cardHeight: settings.cardHeight,
			showFileNames: settings.showFileNames,
			videoControls: settings.videoControls,
			videoMuted: settings.videoMuted,
			videoAutoplay: settings.videoAutoplay,
			videoLoop: settings.videoLoop,
			audioAutoplay: settings.audioAutoplay,
			overlayArrows: settings.overlayArrows,
			onOverlayArrowsChange: (visible: boolean) => {
				void this.saveOverlayArrows(visible);
			},
			thumbnails: this.thumbnails,
			labels: {
				empty: translate(language, EMPTY_LABEL_KEYS[type]),
				thumbnailsUnavailable: translate(language, 'thumbnailsUnavailable'),
			},
		};
	}

	private async saveOverlayArrows(visible: boolean): Promise<void> {
		this.settingsManager.updateSettings({ overlayArrows: visible });
		await this.settingsManager.save();
	}

	private getExcludedPaths(settings: MediaGallerySettings): string[] {
		const folder = settings.thumbnailFolder.trim();
		return folder ? [folder] : [];
	}

	private resolveExtensions(
		type: string,
		fallback: readonly string[],
		settings: MediaGallerySettings
	): readonly string[] {
		const configured =
			type === 'video'
				? settings.videoExtensions
				: type === 'image'
					? settings.imageExtensions
					: type === 'pdf'
						? settings.pdfExtensions
						: type === 'audio'
							? settings.audioExtensions
							: [];

		return configured.length > 0 ? configured : fallback;
	}

	private registerSettingsTab(): void {
		this.addSettingTab(new MediaGallerySettingTab(this.app, this, this.settingsManager));
	}

	private registerGalleryView(): void {
		this.registerView(VIEW_TYPE, (leaf) => new MediaGalleryView(leaf, this));
		this.command = this.addCommand({
			id: 'open-media-gallery-view',
			name: translate(this.settingsManager.getSettings().language, 'openView'),
			callback: () => {
				void this.activateView();
			},
		});
	}

	private updateRibbonVisibility(): void {
		const settings = this.settingsManager.getSettings();
		const label = translate(settings.language, 'openView');

		if (this.command) this.command.name = label;

		if (settings.enableGalleryView) {
			if (!this.ribbonEl) {
				this.ribbonEl = this.addRibbonIcon('images', label, () => {
					void this.activateView();
				});
			} else {
				this.ribbonEl.setAttribute('aria-label', label);
			}
			return;
		}

		if (this.ribbonEl) {
			this.ribbonEl.remove();
			this.ribbonEl = null;
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	private handleError(container: HTMLElement, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[MediaGallery] Render error:', error);
		const language = this.settingsManager.getSettings().language;
		container.createEl('p', {
			text: translate(language, 'renderErrorGeneric', { message }),
		});
	}
}
