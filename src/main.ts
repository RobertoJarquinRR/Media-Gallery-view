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

import { SettingsManager, MediaGallerySettingTab } from './settings/SettingsManager';

export default class MediaGallery extends Plugin {
	private registry!: GalleryRegistry;
	private fileScanner!: FileScanner;
	private settingsManager!: SettingsManager;

	async onload(): Promise<void> {
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.load();

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
	}

	private registerProcessors(): void {
		const videoGallery = new VideoGallery();
		const imageGallery = new ImageGallery(this.app);

		this.registry.register(videoGallery);
		this.registry.register(imageGallery);
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

		const processor = this.registry.get(config.type);
		if (!processor) {
			const available = this.registry.getSupportedTypes().join(', ');
			container.createEl('p', {
				text: `Unknown gallery type: "${config.type}". Available: ${available}`,
			});
			return;
		}

		const files = this.fileScanner.scan(config.path, processor.supportedExtensions);

		if (files.length === 0) {
			container.createEl('p', { text: `No ${config.type} files found in: ${config.path}` });
			return;
		}

		processor.process(files, container, this.app);
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