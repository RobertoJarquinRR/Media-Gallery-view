import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
import { SortOrder } from '../core/types';

const EXTENSION_KEYS = new Set([
	'videoExtensions',
	'imageExtensions',
	'pdfExtensions',
	'audioExtensions',
]);

export interface MediaGallerySettings {
	videoExtensions: string[];
	imageExtensions: string[];
	pdfExtensions: string[];
	audioExtensions: string[];
	openWith: 'obsidian' | 'system';
	thumbnailFolder: string;
	defaultType: 'video' | 'image' | 'pdf' | 'audio';
	sortOrder: SortOrder;
	cardHeight: number;
	showFileNames: boolean;
	videoControls: boolean;
	videoMuted: boolean;
	videoAutoplay: boolean;
	videoLoop: boolean;
	audioAutoplay: boolean;
	overlayArrows: boolean;
}

export const DEFAULT_SETTINGS: MediaGallerySettings = {
	videoExtensions: ['mkv', 'mov', 'mp4', 'ogv', 'webm'],
	imageExtensions: ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'],
	pdfExtensions: ['pdf'],
	audioExtensions: ['mp3', 'flac', 'ogg', 'oga', 'm4a', 'wav', 'aac', 'opus', 'wma', 'aiff', 'aif'],
	openWith: 'obsidian',
	thumbnailFolder: '',
	defaultType: 'video',
	sortOrder: 'mtime-desc',
	cardHeight: 290,
	showFileNames: true,
	videoControls: true,
	videoMuted: true,
	videoAutoplay: false,
	videoLoop: false,
	audioAutoplay: false,
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
		const loaded = (await this.plugin.loadData()) as
			| (Partial<MediaGallerySettings> & { pdfOpenWith?: 'obsidian' | 'system' })
			| null;
		const { pdfOpenWith, ...rest } = loaded ?? {};
		this.settings = { ...DEFAULT_SETTINGS, ...rest };

		if (loaded && loaded.openWith === undefined && pdfOpenWith) {
			this.settings.openWith = pdfOpenWith;
		}

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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Gallery defaults',
				items: [
					{
						name: 'Default gallery type',
						desc: 'Type used when the code block does not specify one',
						control: {
							type: 'dropdown',
							key: 'defaultType',
							options: {
								video: 'Video',
								image: 'Image',
								pdf: 'PDF',
								audio: 'Audio',
							},
						},
					},
					{
						name: 'Sort order',
						desc: 'Order of the files inside the gallery',
						control: {
							type: 'dropdown',
							key: 'sortOrder',
							options: {
								'name-asc': 'Name, ascending',
								'name-desc': 'Name, descending',
								'mtime-desc': 'Modified, newest first',
								'mtime-asc': 'Modified, oldest first',
								'size-desc': 'Size, largest first',
								'size-asc': 'Size, smallest first',
							},
						},
					},
					{
						name: 'Video extensions',
						desc: 'Comma-separated list. This filters files, it does not add playback support: the file must also be decodable by Obsidian',
						control: {
							type: 'textarea',
							key: 'videoExtensions',
							placeholder: 'Mkv, mov, mp4, ogv, webm',
						},
					},
					{
						name: 'Image extensions',
						desc: 'Comma-separated list of image file extensions',
						control: {
							type: 'textarea',
							key: 'imageExtensions',
							placeholder: 'Avif, bmp, GIF, JPEG, JPG, PNG, SVG, webp',
						},
					},
					{
						name: 'PDF extensions',
						desc: 'Comma-separated list of PDF file extensions',
						control: {
							type: 'textarea',
							key: 'pdfExtensions',
							placeholder: 'PDF',
						},
					},
					{
						name: 'Audio extensions',
						desc: 'Comma-separated list of audio file extensions',
						control: {
							type: 'textarea',
							key: 'audioExtensions',
							placeholder:
								'Mp3, flac, ogg, oga, m4a, wav, aac, opus, wma, aiff, aif',
						},
					},
					{
						name: 'Open files with',
						desc: 'Where the open button and double-click send files: a new Obsidian tab or the system default app',
						control: {
							type: 'dropdown',
							key: 'openWith',
							options: {
								obsidian: 'Obsidian tab',
								system: 'System default app',
							},
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Appearance',
				items: [
					{
						name: 'Card height',
						desc: 'Height of each row of cards, in pixels',
						control: {
							type: 'slider',
							key: 'cardHeight',
							min: 150,
							max: 500,
							step: 10,
						},
					},
					{
						name: 'Show file names',
						desc: 'Display the file name below each card',
						control: { type: 'toggle', key: 'showFileNames' },
					},
					{
						name: 'Overlay arrows',
						desc: 'Show the side arrows in the image overlay. Tapping the edges always navigates',
						control: { type: 'toggle', key: 'overlayArrows' },
					},
					{
						name: 'Custom thumbnail folder',
						desc: 'Vault folder with your own thumbnails. Files are matched by name: clip.pdf uses clip.png',
						control: {
							type: 'text',
							key: 'thumbnailFolder',
							placeholder: 'Attachments/thumbnails',
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Video',
				items: [
					{
						name: 'Show controls',
						desc: 'Show the native playback controls (they appear on hover)',
						control: { type: 'toggle', key: 'videoControls' },
					},
					{
						name: 'Muted by default',
						desc: 'Start videos without sound',
						control: { type: 'toggle', key: 'videoMuted' },
					},
					{
						name: 'Autoplay',
						desc: 'Browsers only allow autoplay when the video is muted',
						control: { type: 'toggle', key: 'videoAutoplay' },
					},
					{
						name: 'Loop',
						desc: 'Restart videos when they reach the end',
						control: { type: 'toggle', key: 'videoLoop' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Audio',
				items: [
					{
						name: 'Autoplay',
						desc: 'Start playing the first track automatically when opening the overlay',
						control: { type: 'toggle', key: 'audioAutoplay' },
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const settings = this.manager.getSettings() as unknown as Record<
			string,
			unknown
		>;
		const value = settings[key];
		return Array.isArray(value) ? value.join(', ') : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const raw = typeof value === 'string' ? value : '';
		let next: unknown = value;

		if (EXTENSION_KEYS.has(key)) {
			next = parseExtensions(raw);
		} else if (key === 'thumbnailFolder') {
			next = raw.trim();
		}

		this.manager.updateSettings({ [key]: next });
		await this.manager.save();
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
					.addOption('audio', 'Audio')
					.setValue(settings.defaultType)
					.onChange(async (value) => {
						await update({
							defaultType: value as 'video' | 'image' | 'pdf' | 'audio',
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
			.setName('Audio extensions')
			.setDesc('Comma-separated list of audio file extensions')
			.addTextArea((text) =>
				text
					.setPlaceholder('Mp3, flac, ogg, oga, m4a, wav, aac, opus, wma, aiff, aif')
					.setValue(settings.audioExtensions.join(', '))
					.onChange(async (value) => {
						await update({
							audioExtensions: parseExtensions(value),
						});
					})
			);

		new Setting(containerEl)
			.setName('Open files with')
			.setDesc(
				'Where the open button and double-click send files: a new Obsidian tab or the system default app'
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('obsidian', 'Obsidian tab')
					.addOption('system', 'System default app')
					.setValue(settings.openWith)
					.onChange(async (value) => {
						await update({
							openWith: value as 'obsidian' | 'system',
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

		new Setting(containerEl).setName('Audio').setHeading();

		new Setting(containerEl)
			.setName('Autoplay')
			.setDesc('Start playing the first track automatically when opening the overlay')
			.addToggle((toggle) =>
				toggle.setValue(settings.audioAutoplay).onChange(async (value) => {
					await update({ audioAutoplay: value });
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