import { ItemView, WorkspaceLeaf } from 'obsidian';
import type MediaGallery from '../main';
import { GalleryLibrary, GalleryProcessor } from '../core/types';
import { Language, translate } from '../i18n';

export const VIEW_TYPE = 'media-gallery-view';

const REFRESH_DELAY = 250;

interface PanelEntry {
	element: HTMLElement;
	processor: GalleryProcessor | null;
	signature: string;
}

export class MediaGalleryView extends ItemView {
	private tabsEl!: HTMLElement;
	private panelsEl!: HTMLElement;
	private emptyEl!: HTMLElement;
	private readonly panels = new Map<string, PanelEntry>();
	private activeId: string | null = null;
	private unsubscribe?: () => void;
	private refreshTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: MediaGallery) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return translate(this.getLanguage(), 'viewTitle');
	}

	getIcon(): string {
		return 'images';
	}

	async onOpen(): Promise<void> {
		this.destroyAllPanels();
		this.activeId = null;
		this.contentEl.empty();
		this.contentEl.addClass('mg-view');
		this.tabsEl = this.contentEl.createDiv('mg-view-tabs');
		this.panelsEl = this.contentEl.createDiv('mg-view-content');
		this.emptyEl = this.panelsEl.createDiv('mg-view-empty');

		this.unsubscribe = this.plugin.settingsManager.onChange(() =>
			this.scheduleRefresh()
		);
		this.refresh();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;

		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		this.destroyAllPanels();
	}

	private getLanguage(): Language {
		return this.plugin.settingsManager.getSettings().language;
	}

	private getLibraries(): GalleryLibrary[] {
		return this.plugin.settingsManager.getSettings().libraries;
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refresh();
		}, REFRESH_DELAY);
	}

	private refresh(): void {
		const libraries = this.getLibraries();
		const ids = new Set(libraries.map((library) => library.id));

		for (const [id, panel] of this.panels) {
			if (!ids.has(id)) this.destroyPanel(id, panel);
		}

		for (const library of libraries) {
			const panel = this.panels.get(library.id);
			if (panel && panel.signature !== this.signature(library)) {
				this.destroyPanel(library.id, panel);
			}
		}

		this.renderTabs(libraries);

		if (this.activeId && !ids.has(this.activeId)) {
			this.activeId = null;
		}

		if (libraries.length === 0) {
			this.activeId = null;
			this.showEmpty(translate(this.getLanguage(), 'emptyNoLibraries'));
			return;
		}

		if (!this.activeId) {
			const first =
				libraries.find((library) => library.path.trim()) ?? libraries[0];
			if (first) {
				this.activate(first.id);
			}
			return;
		}

		const active = libraries.find((library) => library.id === this.activeId);
		if (!active) return;

		this.ensurePanel(active);
		this.showPanel(active.id);
	}

	private renderTabs(libraries: GalleryLibrary[]): void {
		this.tabsEl.empty();
		const language = this.getLanguage();

		libraries.forEach((library, index) => {
			const button = this.tabsEl.createEl('button', {
				text:
					library.name.trim() ||
					translate(language, 'libraryFallbackName', { index: index + 1 }),
				cls: 'mg-view-tab',
			});
			button.dataset.libraryId = library.id;
			if (library.id === this.activeId) button.addClass('is-active');
			button.addEventListener('click', () => this.activate(library.id));
		});
	}

	private activate(id: string): void {
		const library = this.getLibraries().find((item) => item.id === id);
		if (!library) return;

		this.activeId = id;
		this.renderTabs(this.getLibraries());
		this.ensurePanel(library);
		this.showPanel(id);
	}

	private ensurePanel(library: GalleryLibrary): void {
		if (this.panels.has(library.id)) return;

		const element = this.panelsEl.createDiv('mg-view-panel');
		element.dataset.libraryId = library.id;
		const panel: PanelEntry = {
			element,
			processor: null,
			signature: this.signature(library),
		};
		this.panels.set(library.id, panel);

		const language = this.getLanguage();
		if (!library.path.trim()) {
			element.createEl('p', {
				text: translate(language, 'emptyLibraryPath'),
				cls: 'mg-view-empty-message',
			});
			return;
		}

		const processor = this.plugin.renderLibrary(
			{ path: library.path.trim(), type: library.type },
			element
		);

		if (!processor) {
			element.empty();
			element.createEl('p', {
				text: translate(language, 'renderError'),
				cls: 'mg-view-empty-message',
			});
			return;
		}

		panel.processor = processor;
	}

	private showPanel(id: string): void {
		this.emptyEl.hide();

		for (const [panelId, panel] of this.panels) {
			const active = panelId === id;
			panel.element.toggleClass('is-active', active);
			if (!active) this.pauseMedia(panel.element);
		}
	}

	private showEmpty(message: string): void {
		for (const panel of this.panels.values()) {
			panel.element.removeClass('is-active');
		}

		this.emptyEl.show();
		this.emptyEl.setText(message);
	}

	private pauseMedia(element: HTMLElement): void {
		element.querySelectorAll('video, audio').forEach((media) => {
			if (media.instanceOf(HTMLMediaElement)) media.pause();
		});
	}

	private signature(library: GalleryLibrary): string {
		const settings = this.plugin.settingsManager.getSettings();

		return [
			settings.language,
			library.type,
			library.path.trim(),
			settings.sortOrder,
			settings.thumbnailFolder,
			settings.videoExtensions.join(','),
			settings.imageExtensions.join(','),
			settings.pdfExtensions.join(','),
			settings.audioExtensions.join(','),
			settings.cardHeight,
			settings.showFileNames,
			settings.videoControls,
			settings.videoMuted,
			settings.videoAutoplay,
			settings.videoLoop,
			settings.audioAutoplay,
		].join('|');
	}

	private destroyPanel(id: string, panel: PanelEntry): void {
		panel.processor?.destroy?.();
		panel.element.remove();
		this.panels.delete(id);
	}

	private destroyAllPanels(): void {
		for (const [id, panel] of this.panels) {
			this.destroyPanel(id, panel);
		}
	}
}
