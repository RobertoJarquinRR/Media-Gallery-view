import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface MediaGallerySettings {
	videoExtensions: string[];
	imageExtensions: string[];
	defaultType: 'video' | 'image';
	gridColumns: number;
	enableLazyLoad: boolean;
}

export const DEFAULT_SETTINGS: MediaGallerySettings = {
	videoExtensions: ['mkv', 'mov', 'mp4', 'ogv', 'webm'],
	imageExtensions: ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'],
	defaultType: 'video',
	gridColumns: 4,
	enableLazyLoad: true,
};

export class SettingsManager {
	private plugin: Plugin;
	private settings: MediaGallerySettings;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.settings = DEFAULT_SETTINGS;
	}

	async load(): Promise<MediaGallerySettings> {
		const loaded = (await this.plugin.loadData()) as Partial<MediaGallerySettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...loaded };
		return this.settings;
	}

	async save(): Promise<void> {
		await this.plugin.saveData(this.settings);
	}

	getSettings(): MediaGallerySettings {
		return this.settings;
	}

	updateSettings(partial: Partial<MediaGallerySettings>): void {
		this.settings = { ...this.settings, ...partial };
	}
}

export class MediaGallerySettingTab extends PluginSettingTab {
	private manager: SettingsManager;

	constructor(app: App, plugin: Plugin, manager: SettingsManager) {
		super(app, plugin);
		this.manager = manager;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.manager.getSettings();

		new Setting(containerEl)
			.setName('Default gallery type')
			.setDesc('Type used when not specified in the code block')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('video', 'Video')
					.addOption('image', 'Image')
					.setValue(settings.defaultType)
					.onChange(async (value) => {
						this.manager.updateSettings({ defaultType: value as 'video' | 'image' });
						await this.manager.save();
					})
			);

		new Setting(containerEl)
			.setName('Video extensions')
			.setDesc('Comma-separated list of video file extensions')
			.addText((text) =>
				text
					.setPlaceholder('Mkv, mov, mp4, ogv, webm')
					.setValue(settings.videoExtensions.join(', '))
					.onChange(async (value) => {
						this.manager.updateSettings({
							videoExtensions: value.split(',').map((s) => s.trim().toLowerCase()),
						});
						await this.manager.save();
					})
			);

		new Setting(containerEl)
			.setName('Image extensions')
			.setDesc('Comma-separated list of image file extensions')
			.addText((text) =>
				text
					.setPlaceholder('Avif, bmp, GIF, JPEG, JPG, PNG, SVG, webp')
					.setValue(settings.imageExtensions.join(', '))
					.onChange(async (value) => {
						this.manager.updateSettings({
							imageExtensions: value.split(',').map((s) => s.trim().toLowerCase()),
						});
						await this.manager.save();
					})
			);

		new Setting(containerEl)
			.setName('Grid columns')
			.setDesc('Number of columns in the gallery grid')
			.addSlider((slider) =>
				slider
					.setLimits(1, 8, 1)
					.setValue(settings.gridColumns)
					.onChange(async (value) => {
						this.manager.updateSettings({ gridColumns: value });
						await this.manager.save();
					})
			);

		new Setting(containerEl)
			.setName('Enable lazy loading')
			.setDesc('Load media only when visible in viewport')
			.addToggle((toggle) =>
				toggle
					.setValue(settings.enableLazyLoad)
					.onChange(async (value) => {
						this.manager.updateSettings({ enableLazyLoad: value });
						await this.manager.save();
					})
			);
	}
}