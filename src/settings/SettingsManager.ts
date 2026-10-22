import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { SortOrder } from '../core/types';

export interface MediaGallerySettings {
	videoExtensions: string[];
	imageExtensions: string[];
	pdfExtensions: string[];
	pdfOpenWith: 'obsidian' | 'system';
	thumbnailFolder: string;
	defaultType: 'video' | 'image' | 'pdf';
	sortOrder: SortOrder;
	cardHeight: number;
	showFileNames: boolean;
	videoControls: boolean;
	videoMuted: boolean;
	videoAutoplay: boolean;
	videoLoop: boolean;
	overlayArrows: boolean;
}

export const DEFAULT_SETTINGS: MediaGallerySettings = {
	videoExtensions: ['mkv', 'mov', 'mp4', 'ogv', 'webm'],
	imageExtensions: ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'],
	pdfExtensions: ['pdf'],
	pdfOpenWith: 'obsidian',
	thumbnailFolder: '',
	defaultType: 'video',
	sortOrder: 'mtime-desc',
	cardHeight: 290,
	showFileNames: true,
	videoControls: true,
	videoMuted: true,
	videoAutoplay: false,
	videoLoop: false,
	overlayArrows: true,
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
		const update = async (partial: Partial<MediaGallerySettings>) => {
			this.manager.updateSettings(partial);
			await this.manager.save();
		};

		new Setting(containerEl).setName('Gallery defaults').setHeading();

		new Setting(containerEl)
			.setName('Default gallery type')
			.setDesc('Type used when the code block does not specify one')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('video', 'Video')
					.addOption('image', 'Image')
					.addOption('pdf', 'PDF')
					.setValue(settings.defaultType)
					.onChange(async (value) => {
						await update({
							defaultType: value as 'video' | 'image' | 'pdf',
						});
					})
			);

		new Setting(containerEl)
			.setName('Sort order')
			.setDesc('Order of the files inside the gallery')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('name-asc', 'Name, ascending')
					.addOption('name-desc', 'Name, descending')
					.addOption('mtime-desc', 'Modified, newest first')
					.addOption('mtime-asc', 'Modified, oldest first')
					.addOption('size-desc', 'Size, largest first')
					.addOption('size-asc', 'Size, smallest first')
					.setValue(settings.sortOrder)
					.onChange(async (value) => {
						await update({ sortOrder: value as SortOrder });
					})
			);

		new Setting(containerEl)
			.setName('Video extensions')
			.setDesc(
				'Comma-separated list. This filters files, it does not add playback support: the file must also be decodable by Obsidian'
			)
			.addTextArea((text) =>
				text
					.setPlaceholder('Mkv, mov, mp4, ogv, webm')
					.setValue(settings.videoExtensions.join(', '))
					.onChange(async (value) => {
						await update({
							videoExtensions: value
								.split(',')
								.map((s) => s.trim().toLowerCase().replace(/^\./, ''))
								.filter((s) => s.length > 0),
						});
					})
			);

		new Setting(containerEl)
			.setName('Image extensions')
			.setDesc('Comma-separated list of image file extensions')
			.addTextArea((text) =>
				text
					.setPlaceholder('Avif, bmp, GIF, JPEG, JPG, PNG, SVG, webp')
					.setValue(settings.imageExtensions.join(', '))
					.onChange(async (value) => {
						await update({
							imageExtensions: value
								.split(',')
								.map((s) => s.trim().toLowerCase().replace(/^\./, ''))
								.filter((s) => s.length > 0),
						});
					})
			);

		new Setting(containerEl)
			.setName('PDF extensions')
			.setDesc('Comma-separated list of PDF file extensions')
			.addTextArea((text) =>
				text
					.setPlaceholder('PDF')
					.setValue(settings.pdfExtensions.join(', '))
					.onChange(async (value) => {
						await update({
							pdfExtensions: parseExtensions(value),
						});
					})
			);

		new Setting(containerEl)
			.setName('Open PDF files on double-click')
			.setDesc(
				'Double-clicking a PDF opens it in a new Obsidian tab or with the system default app'
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('obsidian', 'Obsidian tab')
					.addOption('system', 'System default app')
					.setValue(settings.pdfOpenWith)
					.onChange(async (value) => {
						await update({
							pdfOpenWith: value as 'obsidian' | 'system',
						});
					})
			);

		new Setting(containerEl).setName('Appearance').setHeading();

		new Setting(containerEl)
			.setName('Card height')
			.setDesc('Height of each row of cards, in pixels')
			.addSlider((slider) =>
				slider
					.setLimits(150, 500, 10)
					.setValue(settings.cardHeight)
					.onChange(async (value) => {
						await update({ cardHeight: value });
					})
			);

		new Setting(containerEl)
			.setName('Show file names')
			.setDesc('Display the file name below each card')
			.addToggle((toggle) =>
				toggle.setValue(settings.showFileNames).onChange(async (value) => {
					await update({ showFileNames: value });
				})
			);

		new Setting(containerEl)
			.setName('Overlay arrows')
			.setDesc(
				'Show the side arrows in the image overlay. Tapping the edges always navigates'
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.overlayArrows).onChange(async (value) => {
					await update({ overlayArrows: value });
				})
			);

		new Setting(containerEl)
			.setName('Custom thumbnail folder')
			.setDesc(
				'Vault folder with your own thumbnails. Files are matched by name: clip.pdf uses clip.png'
			)
			.addText((text) =>
				text
					.setPlaceholder('Attachments/thumbnails')
					.setValue(settings.thumbnailFolder)
					.onChange(async (value) => {
						await update({ thumbnailFolder: value.trim() });
					})
			);

		new Setting(containerEl).setName('Video').setHeading();

		new Setting(containerEl)
			.setName('Show controls')
			.setDesc('Show the native playback controls (they appear on hover)')
			.addToggle((toggle) =>
				toggle.setValue(settings.videoControls).onChange(async (value) => {
					await update({ videoControls: value });
				})
			);

		new Setting(containerEl)
			.setName('Muted by default')
			.setDesc('Start videos without sound')
			.addToggle((toggle) =>
				toggle.setValue(settings.videoMuted).onChange(async (value) => {
					await update({ videoMuted: value });
				})
			);

		new Setting(containerEl)
			.setName('Autoplay')
			.setDesc('Browsers only allow autoplay when the video is muted')
			.addToggle((toggle) =>
				toggle.setValue(settings.videoAutoplay).onChange(async (value) => {
					await update({ videoAutoplay: value });
				})
			);

		new Setting(containerEl)
			.setName('Loop')
			.setDesc('Restart videos when they reach the end')
			.addToggle((toggle) =>
				toggle.setValue(settings.videoLoop).onChange(async (value) => {
					await update({ videoLoop: value });
				})
			);
	}
}

function parseExtensions(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim().toLowerCase().replace(/^\./, ''))
		.filter((item) => item.length > 0);
}
