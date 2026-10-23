import {
	Plugin,
	MarkdownPostProcessorContext,
	normalizePath,
} from 'obsidian';

import {
	GalleryRegistry,
	FileScanner,
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
	SettingsManager,
	MediaGallerySettingTab,
	MediaGallerySettings,
} from './settings/SettingsManager';

export default class MediaGallery extends Plugin {
	private registry!: GalleryRegistry;
	private fileScanner!: FileScanner;
	private settingsManager!: SettingsManager;
	private thumbnails!: ThumbnailService;

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
	}

	onunload(): void {
		this.registry.destroyAll();
		this.thumbnails.destroy();
		disposePdfWorker();
	}

	private registerProcessors(): void {
		this.registry.register(new VideoGallery(this.app, this.settingsManager));
		this.registry.register(new ImageGallery(this.app, this.settingsManager));
		this.registry.register(new PdfGallery(this.app, this.settingsManager));
		this.registry.register(new AudioGallery(this.app, this.settingsManager));
	}

	private registerMarkdownProcessor(): void {
		this.registerMarkdownCodeBlockProcessor(
			'MediaGallery',
			async (source: string, container: HTMLElement, context: MarkdownPostProcessorContext) => {
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
		_context: MarkdownPostProcessorContext
	): Promise<void> {
		const { config } = parseGallerySource(source);
		const errors = validateConfig(config);

		if (errors.length > 0) {
			container.createEl('p', { text: `Configuration error: ${errors.join(', ')}` });
			return;
		}

		const settings = this.settingsManager.getSettings();
		this.thumbnails.setCustomFolder(settings.thumbnailFolder);
		const type = config.type || settings.defaultType;
		const processor = this.registry.get(type);

		if (!processor) {
			const available = this.registry.getSupportedTypes().join(', ');
			container.createEl('p', {
				text: `Unknown gallery type: "${type}". Available: ${available}`,
			});
			return;
		}

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

		if (files.length === 0) {
			container.createEl('p', { text: `No ${type} files found in: ${config.path}` });
			return;
		}

		processor.process(files, container, this.app, {
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
		});
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

	private handleError(container: HTMLElement, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[MediaGallery] Render error:', error);
		container.createEl('p', { text: `Error rendering gallery: ${message}` });
	}
}