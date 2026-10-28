import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
import { GalleryLibrary, GalleryType, SortOrder, LayoutMode } from '../core/types';
import { Language, translate } from '../i18n';

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
	defaultType: GalleryType;
	sortOrder: SortOrder;
	layoutMode: LayoutMode;
	cardHeight: number;
	masonryColumns: number;
	masonryGap: number;
	masonryMinWidth: number;
	showFileNames: boolean;
	videoControls: boolean;
	videoMuted: boolean;
	videoAutoplay: boolean;
	videoLoop: boolean;
	audioAutoplay: boolean;
	overlayArrows: boolean;
	libraries: GalleryLibrary[];
	enableGalleryView: boolean;
	language: Language;
}

export function createDefaultLibraries(): GalleryLibrary[] {
	return [
		{ id: 'default-image', name: 'Images', type: 'image', path: '' },
		{ id: 'default-pdf', name: 'PDF', type: 'pdf', path: '' },
		{ id: 'default-video', name: 'Video', type: 'video', path: '' },
		{ id: 'default-audio', name: 'Music', type: 'audio', path: '' },
	];
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
	layoutMode: 'masonry',
	cardHeight: 290,
	masonryColumns: 0,
	masonryGap: 5,
	masonryMinWidth: 220,
	showFileNames: true,
	videoControls: true,
	videoMuted: true,
	videoAutoplay: false,
	videoLoop: false,
	audioAutoplay: false,
	overlayArrows: true,
	libraries: createDefaultLibraries(),
	enableGalleryView: false,
	language: 'en',
};

export class SettingsManager {
	private plugin: Plugin;
	private settings: MediaGallerySettings;
	private readonly listeners = new Set<() => void>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.settings = DEFAULT_SETTINGS;
	}

	async load(): Promise<MediaGallerySettings> {
		const loaded = (await this.plugin.loadData()) as
			| (Partial<MediaGallerySettings> & { pdfOpenWith?: 'obsidian' | 'system' })
			| null;
		const { pdfOpenWith, ...rest } = loaded ?? {};
		this.settings = {
			...DEFAULT_SETTINGS,
			...rest,
			libraries: normalizeLibraries(rest.libraries),
		};

		if (this.settings.language !== 'en' && this.settings.language !== 'es') {
			this.settings.language = 'en';
		}

		if (
			this.settings.layoutMode !== 'masonry' &&
			this.settings.layoutMode !== 'grid' &&
			this.settings.layoutMode !== 'grid-ratio'
		) {
			this.settings.layoutMode = 'masonry';
		}

		this.settings.masonryColumns = clampNumber(
			this.settings.masonryColumns,
			0,
			6,
			DEFAULT_SETTINGS.masonryColumns
		);
		this.settings.masonryGap = clampNumber(
			this.settings.masonryGap,
			0,
			40,
			DEFAULT_SETTINGS.masonryGap
		);
		this.settings.masonryMinWidth = clampNumber(
			this.settings.masonryMinWidth,
			100,
			600,
			DEFAULT_SETTINGS.masonryMinWidth
		);

		this.settings.enableGalleryView = Boolean(this.settings.enableGalleryView);

		if (loaded && loaded.openWith === undefined && pdfOpenWith) {
			this.settings.openWith = pdfOpenWith;
		}

		return this.settings;
	}

	async save(): Promise<void> {
		await this.plugin.saveData(this.settings);
		this.emitChange();
	}

	getSettings(): MediaGallerySettings {
		return this.settings;
	}

	updateSettings(partial: Partial<MediaGallerySettings>): void {
		this.settings = { ...this.settings, ...partial };
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getLibraries(): GalleryLibrary[] {
		return this.settings.libraries;
	}

	addLibrary(): GalleryLibrary {
		const index = this.settings.libraries.length + 1;
		const library: GalleryLibrary = {
			id: createId(),
			name: translate(this.settings.language, 'libraryFallbackName', { index }),
			type: 'image',
			path: '',
		};

		this.settings = {
			...this.settings,
			libraries: [...this.settings.libraries, library],
		};

		return library;
	}

	removeLibrary(index: number): void {
		if (index < 0 || index >= this.settings.libraries.length) return;

		this.settings = {
			...this.settings,
			libraries: this.settings.libraries.filter((_, itemIndex) => itemIndex !== index),
		};
	}

	reorderLibraries(oldIndex: number, newIndex: number): void {
		const libraries = [...this.settings.libraries];
		if (
			oldIndex < 0 ||
			oldIndex >= libraries.length ||
			newIndex < 0 ||
			newIndex >= libraries.length
		) {
			return;
		}

		const [moved] = libraries.splice(oldIndex, 1);
		if (!moved) return;

		libraries.splice(newIndex, 0, moved);
		this.settings = { ...this.settings, libraries };
	}

	updateLibrary(id: string, partial: Partial<Omit<GalleryLibrary, 'id'>>): void {
		this.settings = {
			...this.settings,
			libraries: this.settings.libraries.map((library) =>
				library.id === id ? { ...library, ...partial } : library
			),
		};
	}

	private emitChange(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export class MediaGallerySettingTab extends PluginSettingTab {
	private manager: SettingsManager;

	constructor(app: App, plugin: Plugin, manager: SettingsManager) {
		super(app, plugin);
		this.manager = manager;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const lang = this.manager.getSettings().language;

		return [
			{
				type: 'group',
				heading: translate(lang, 'sectionGeneral'),
				items: [
					{
						name: translate(lang, 'language'),
						desc: translate(lang, 'languageDesc'),
						control: {
							type: 'dropdown',
							key: 'language',
							options: { en: 'English', es: 'Español' },
						},
					},
					{
						name: translate(lang, 'enableGalleryView'),
						desc: translate(lang, 'enableGalleryViewDesc'),
						control: { type: 'toggle', key: 'enableGalleryView' },
					},
				],
			},
			this.getLibraryDefinitions(lang),
			{
				type: 'group',
				heading: translate(lang, 'sectionGalleryDefaults'),
				items: [
					{
						name: translate(lang, 'defaultGalleryType'),
						desc: translate(lang, 'defaultGalleryTypeDesc'),
						control: {
							type: 'dropdown',
							key: 'defaultType',
							options: {
								video: translate(lang, 'typeVideo'),
								image: translate(lang, 'typeImage'),
								pdf: translate(lang, 'typePdf'),
								audio: translate(lang, 'typeAudio'),
							},
						},
					},
					{
						name: translate(lang, 'sortOrder'),
						desc: translate(lang, 'sortOrderDesc'),
						control: {
							type: 'dropdown',
							key: 'sortOrder',
							options: {
								'name-asc': translate(lang, 'sortNameAsc'),
								'name-desc': translate(lang, 'sortNameDesc'),
								'mtime-desc': translate(lang, 'sortMtimeDesc'),
								'mtime-asc': translate(lang, 'sortMtimeAsc'),
								'size-desc': translate(lang, 'sortSizeDesc'),
								'size-asc': translate(lang, 'sortSizeAsc'),
							},
						},
					},
					{
						name: translate(lang, 'videoExtensions'),
						desc: translate(lang, 'videoExtensionsDesc'),
						control: {
							type: 'textarea',
							key: 'videoExtensions',
							placeholder: 'Mkv, mov, mp4, ogv, webm',
						},
					},
					{
						name: translate(lang, 'imageExtensions'),
						desc: translate(lang, 'imageExtensionsDesc'),
						control: {
							type: 'textarea',
							key: 'imageExtensions',
							placeholder: 'Avif, bmp, GIF, JPEG, JPG, PNG, SVG, webp',
						},
					},
					{
						name: translate(lang, 'pdfExtensions'),
						desc: translate(lang, 'pdfExtensionsDesc'),
						control: {
							type: 'textarea',
							key: 'pdfExtensions',
							placeholder: 'PDF',
						},
					},
					{
						name: translate(lang, 'audioExtensions'),
						desc: translate(lang, 'audioExtensionsDesc'),
						control: {
							type: 'textarea',
							key: 'audioExtensions',
							placeholder:
								'Mp3, flac, ogg, oga, m4a, wav, aac, opus, wma, aiff, aif',
						},
					},
					{
						name: translate(lang, 'openFilesWith'),
						desc: translate(lang, 'openFilesWithDesc'),
						control: {
							type: 'dropdown',
							key: 'openWith',
							options: {
								obsidian: translate(lang, 'openWithObsidian'),
								system: translate(lang, 'openWithSystem'),
							},
						},
					},
				],
			},
{
					type: 'group',
					heading: translate(lang, 'sectionAppearance'),
					items: [
						{
							name: translate(lang, 'cardHeight'),
							desc: translate(lang, 'cardHeightDesc'),
							control: {
								type: 'slider',
								key: 'cardHeight',
								min: 150,
								max: 500,
								step: 10,
							},
						},
						{
							name: translate(lang, 'layoutMode'),
							desc: translate(lang, 'layoutModeDesc'),
							control: {
								type: 'dropdown',
								key: 'layoutMode',
								options: {
									masonry: translate(lang, 'layoutMasonry'),
									grid: translate(lang, 'layoutGrid'),
									'grid-ratio': translate(lang, 'layoutGridRatio'),
								},
							},
						},
						{
							name: translate(lang, 'masonryColumns'),
							desc: translate(lang, 'masonryColumnsDesc'),
							control: {
								type: 'dropdown',
								key: 'masonryColumns',
								options: {
									'0': translate(lang, 'masonryColumnsAuto'),
									'2': translate(lang, 'masonryColumnsCount', { count: 2 }),
									'3': translate(lang, 'masonryColumnsCount', { count: 3 }),
									'4': translate(lang, 'masonryColumnsCount', { count: 4 }),
									'5': translate(lang, 'masonryColumnsCount', { count: 5 }),
									'6': translate(lang, 'masonryColumnsCount', { count: 6 }),
								},
							},
						},
						{
							name: translate(lang, 'masonryMinWidth'),
							desc: translate(lang, 'masonryMinWidthDesc'),
							control: {
								type: 'slider',
								key: 'masonryMinWidth',
								min: 120,
								max: 400,
								step: 10,
							},
						},
						{
							name: translate(lang, 'masonryGap'),
							desc: translate(lang, 'masonryGapDesc'),
							control: {
								type: 'slider',
								key: 'masonryGap',
								min: 0,
								max: 24,
								step: 1,
							},
						},
						{
							name: translate(lang, 'showFileNames'),
							desc: translate(lang, 'showFileNamesDesc'),
							control: { type: 'toggle', key: 'showFileNames' },
						},
						{
							name: translate(lang, 'overlayArrows'),
							desc: translate(lang, 'overlayArrowsDesc'),
							control: { type: 'toggle', key: 'overlayArrows' },
						},
						{
							name: translate(lang, 'customThumbnailFolder'),
							desc: translate(lang, 'customThumbnailFolderDesc'),
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
				heading: translate(lang, 'sectionVideo'),
				items: [
					{
						name: translate(lang, 'videoControls'),
						desc: translate(lang, 'videoControlsDesc'),
						control: { type: 'toggle', key: 'videoControls' },
					},
					{
						name: translate(lang, 'videoMuted'),
						desc: translate(lang, 'videoMutedDesc'),
						control: { type: 'toggle', key: 'videoMuted' },
					},
					{
						name: translate(lang, 'videoAutoplay'),
						desc: translate(lang, 'videoAutoplayDesc'),
						control: { type: 'toggle', key: 'videoAutoplay' },
					},
					{
						name: translate(lang, 'videoLoop'),
						desc: translate(lang, 'videoLoopDesc'),
						control: { type: 'toggle', key: 'videoLoop' },
					},
				],
			},
			{
				type: 'group',
				heading: translate(lang, 'sectionAudio'),
				items: [
					{
						name: translate(lang, 'audioAutoplay'),
						desc: translate(lang, 'audioAutoplayDesc'),
						control: { type: 'toggle', key: 'audioAutoplay' },
					},
				],
			},
		];
	}

	private getLibraryDefinitions(lang: Language): SettingDefinitionItem {
		const libraries = this.manager.getSettings().libraries;

		return {
			type: 'list',
			heading: translate(lang, 'sectionLibraries'),
			emptyState: translate(lang, 'noLibraries'),
			items: libraries.map((library, index) => ({
				name:
					library.name.trim() ||
					translate(lang, 'libraryFallbackName', { index: index + 1 }),
				render: (setting: Setting) => {
					setting.setName('');
					setting.setDesc('');

					setting.addText((text) =>
						text
							.setPlaceholder(translate(lang, 'libraryNamePlaceholder'))
							.setValue(library.name)
							.onChange(async (value) => {
								this.manager.updateLibrary(library.id, { name: value });
								await this.manager.save();
							})
					);

					setting.addDropdown((dropdown) =>
						dropdown
							.addOption('image', translate(lang, 'typeImage'))
							.addOption('pdf', translate(lang, 'typePdf'))
							.addOption('video', translate(lang, 'typeVideo'))
							.addOption('audio', translate(lang, 'typeAudio'))
							.setValue(library.type)
							.onChange(async (value) => {
								this.manager.updateLibrary(library.id, {
									type: value as GalleryType,
								});
								await this.manager.save();
								this.update();
							})
					);

					setting.addText((text) =>
						text
							.setPlaceholder(translate(lang, 'libraryPathPlaceholder'))
							.setValue(library.path)
							.onChange(async (value) => {
								this.manager.updateLibrary(library.id, { path: value.trim() });
								await this.manager.save();
							})
					);
				},
			})),
			addItem: {
				name: translate(lang, 'addLibrary'),
				action: () => {
					this.manager.addLibrary();
					void this.manager.save();
					this.update();
				},
			},
			onDelete: (index) => {
				this.manager.removeLibrary(index);
				void this.manager.save();
				this.update();
			},
			onReorder: (oldIndex, newIndex) => {
				this.manager.reorderLibraries(oldIndex, newIndex);
				void this.manager.save();
				this.update();
			},
		};
	}

	getControlValue(key: string): unknown {
		const settings = this.manager.getSettings() as unknown as Record<string, unknown>;
		const value = settings[key];
		if (key === 'masonryColumns') {
			return typeof value === 'number' ? String(value) : '0';
		}
		return Array.isArray(value) ? value.join(', ') : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'language') {
			this.manager.updateSettings({ language: value === 'es' ? 'es' : 'en' });
			await this.manager.save();
			window.setTimeout(() => this.update(), 0);
			return;
		}

		if (key === 'enableGalleryView') {
			this.manager.updateSettings({ enableGalleryView: Boolean(value) });
			await this.manager.save();
			return;
		}

		const raw =
			typeof value === 'string'
				? value
				: typeof value === 'number'
					? String(value)
					: '';
		let next: unknown = value;

		if (EXTENSION_KEYS.has(key)) {
			next = parseExtensions(raw);
		} else if (key === 'thumbnailFolder') {
			next = raw.trim();
		} else if (key === 'masonryColumns') {
			next = clampNumber(raw, 0, 6, DEFAULT_SETTINGS.masonryColumns);
		} else if (key === 'masonryGap') {
			next = clampNumber(raw, 0, 40, DEFAULT_SETTINGS.masonryGap);
		} else if (key === 'masonryMinWidth') {
			next = clampNumber(
				raw,
				100,
				600,
				DEFAULT_SETTINGS.masonryMinWidth
			);
		}

		this.manager.updateSettings({ [key]: next });
		await this.manager.save();
	}
}

function parseExtensions(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim().toLowerCase().replace(/^\./, ''))
		.filter((item) => item.length > 0);
}

function normalizeLibraries(value: unknown): GalleryLibrary[] {
	if (!Array.isArray(value)) return createDefaultLibraries();

	const seen = new Set<string>();
	const libraries: GalleryLibrary[] = [];

	for (const item of value) {
		if (!item || typeof item !== 'object') continue;

		const record = item as Record<string, unknown>;
		const type = record.type;
		if (!isGalleryType(type)) continue;

		let id = typeof record.id === 'string' && record.id ? record.id : createId();
		if (seen.has(id)) id = createId();
		seen.add(id);

		libraries.push({
			id,
			name: typeof record.name === 'string' ? record.name : '',
			type,
			path: typeof record.path === 'string' ? record.path : '',
		});
	}

	return libraries;
}

function isGalleryType(value: unknown): value is GalleryType {
	return value === 'image' || value === 'pdf' || value === 'video' || value === 'audio';
}

function clampNumber(
	value: unknown,
	min: number,
	max: number,
	fallback: number
): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `library-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
