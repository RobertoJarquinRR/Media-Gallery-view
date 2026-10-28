import { App } from 'obsidian';
import { GalleryFile } from '../core/types';
import { ImageZoomController } from './ImageZoomController';
import type { OverlayZoomHandle } from './zoomTypes';

export type OverlayMediaType = 'image' | 'video' | 'pdf' | 'audio';

export interface OverlayContentHandle {
	destroy(): void;
	zoom?: OverlayZoomHandle;
}

export interface OverlayOptions {
	arrowsVisible: boolean;
	onArrowsVisibleChange: (visible: boolean) => void;
	videoAttributes: Record<string, string>;
	renderContent?: (
		item: GalleryFile,
		stage: HTMLElement,
		mediaType: OverlayMediaType
	) => OverlayContentHandle | void;
	thumbSrc?: (item: GalleryFile) => string | undefined;
	onOpenExternal?: (item: GalleryFile) => void;
	onDoubleClickContent?: (item: GalleryFile) => void;
	onKeyDown?: (event: KeyboardEvent) => boolean;
}

export class OverlayManager {
	private readonly app: App;
	private overlay: HTMLDivElement | null = null;
	private stage: HTMLDivElement | null = null;
	private thumbsBar: HTMLDivElement | null = null;
	private counter: HTMLSpanElement | null = null;
	private toggleButton: HTMLButtonElement | null = null;
	private openButton: HTMLButtonElement | null = null;
	private closeButton: HTMLButtonElement | null = null;
	private zoomToggle: HTMLButtonElement | null = null;
	private zoomControls: HTMLDivElement | null = null;
	private zoomOutButton: HTMLButtonElement | null = null;
	private zoomPercentButton: HTMLButtonElement | null = null;
	private zoomInButton: HTMLButtonElement | null = null;
	private contentHandle: OverlayContentHandle | null = null;
	private zoomHandle: OverlayZoomHandle | null = null;
	private zoomMode = false;
	private thumbCenterFrame: number | null = null;

	private items: GalleryFile[] = [];
	private index = 0;
	private mediaType: OverlayMediaType = 'image';
	private options: OverlayOptions = {
		arrowsVisible: true,
		onArrowsVisibleChange: () => {},
		videoAttributes: {},
	};
	private readonly boundKeyDown: (event: KeyboardEvent) => void;

	constructor(app: App) {
		this.app = app;
		this.boundKeyDown = (event) => this.handleKeyDown(event);
	}

	setOptions(options: OverlayOptions): void {
		this.options = options;
		this.applyArrowsVisibility();
		this.applyOpenVisibility();
	}

	open(items: GalleryFile[], index: number, mediaType: OverlayMediaType): void {
		const doc = this.getDocument();
		this.ensureOverlay(doc);

		this.items = items;
		this.index = Math.max(0, Math.min(index, items.length - 1));
		this.mediaType = mediaType;
		this.zoomMode = false;

		this.renderThumbs();
		this.renderCurrent();
		this.applyArrowsVisibility();
		this.applyOpenVisibility();
		this.overlay?.classList.remove('is-hidden');
		this.scheduleThumbCenter();

		doc.removeEventListener('keydown', this.boundKeyDown);
		doc.addEventListener('keydown', this.boundKeyDown);
	}

	close(): void {
		this.setZoomMode(false);
		this.pauseMedia();
		this.destroyContent();
		this.overlay?.classList.add('is-hidden');
		this.getDocument().removeEventListener('keydown', this.boundKeyDown);
	}

	destroy(): void {
		this.close();
		if (this.thumbCenterFrame !== null) {
			window.cancelAnimationFrame(this.thumbCenterFrame);
			this.thumbCenterFrame = null;
		}
		this.overlay?.remove();
		this.overlay = null;
		this.stage = null;
		this.thumbsBar = null;
		this.counter = null;
		this.toggleButton = null;
		this.openButton = null;
		this.closeButton = null;
		this.zoomToggle = null;
		this.zoomControls = null;
		this.zoomOutButton = null;
		this.zoomPercentButton = null;
		this.zoomInButton = null;
		this.zoomHandle = null;
	}

	private getDocument(): Document {
		return this.app.workspace.containerEl?.ownerDocument ?? activeDocument;
	}

	private ensureOverlay(doc: Document): void {
		if (this.overlay) return;

		this.overlay = doc.createElement('div');
		this.overlay.className = 'mg-overlay is-hidden';

		this.stage = doc.createElement('div');
		this.stage.className = 'mg-overlay-stage';

const prev = this.createEdge(doc, 'left', '\u2039', 'Previous');
const next = this.createEdge(doc, 'right', '\u203A', 'Next');

		const toolbar = doc.createElement('div');
		toolbar.className = 'mg-overlay-toolbar';

		this.counter = doc.createElement('span');
		this.counter.className = 'mg-overlay-counter';

		this.toggleButton = doc.createElement('button');
		this.toggleButton.type = 'button';
		this.toggleButton.className = 'mg-overlay-toggle';
		this.toggleButton.textContent = '\u2194';
		this.toggleButton.setAttribute('aria-label', 'Toggle arrows');
		this.toggleButton.title = 'Toggle arrows';
		this.toggleButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.toggleArrows();
		});

		this.openButton = doc.createElement('button');
		this.openButton.type = 'button';
		this.openButton.className = 'mg-overlay-open';
		this.openButton.textContent = '\u2197';
		this.openButton.setAttribute('aria-label', 'Open in default app');
		this.openButton.title = 'Open in default app';
		this.openButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.openCurrent();
		});

		this.closeButton = doc.createElement('button');
		this.closeButton.type = 'button';
		this.closeButton.className = 'mg-overlay-close';
		this.closeButton.textContent = '\u2715';
		this.closeButton.setAttribute('aria-label', 'Close');
		this.closeButton.title = 'Close (esc)';
		this.closeButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.close();
		});

		this.zoomToggle = doc.createElement('button');
		this.zoomToggle.type = 'button';
		this.zoomToggle.className = 'mg-overlay-toggle';
		this.zoomToggle.textContent = '\u2315';
		this.zoomToggle.setAttribute('aria-label', 'Toggle zoom');
		this.zoomToggle.setAttribute('aria-pressed', 'false');
		this.zoomToggle.title = 'Zoom';
		this.zoomToggle.addEventListener('click', (event) => {
			event.stopPropagation();
			this.setZoomMode(!this.zoomMode);
		});

		this.zoomControls = doc.createElement('div');
		this.zoomControls.className = 'mg-overlay-zoom-controls is-hidden';

		this.zoomOutButton = doc.createElement('button');
		this.zoomOutButton.type = 'button';
		this.zoomOutButton.className = 'mg-overlay-zoom-button';
		this.zoomOutButton.textContent = '\u2212';
		this.zoomOutButton.setAttribute('aria-label', 'Zoom out');
		this.zoomOutButton.title = 'Zoom out';
		this.zoomOutButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.zoomHandle?.zoomOut();
			this.syncZoomUi();
		});

		this.zoomPercentButton = doc.createElement('button');
		this.zoomPercentButton.type = 'button';
		this.zoomPercentButton.className = 'mg-overlay-zoom-percent';
		this.zoomPercentButton.textContent = '100%';
		this.zoomPercentButton.setAttribute('aria-label', 'Reset zoom');
		this.zoomPercentButton.title = 'Reset zoom';
		this.zoomPercentButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.zoomHandle?.reset();
			this.syncZoomUi();
		});

		this.zoomInButton = doc.createElement('button');
		this.zoomInButton.type = 'button';
		this.zoomInButton.className = 'mg-overlay-zoom-button';
		this.zoomInButton.textContent = '+';
		this.zoomInButton.setAttribute('aria-label', 'Zoom in');
		this.zoomInButton.title = 'Zoom in';
		this.zoomInButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.zoomHandle?.zoomIn();
			this.syncZoomUi();
		});

		this.zoomControls.appendChild(this.zoomOutButton);
		this.zoomControls.appendChild(this.zoomPercentButton);
		this.zoomControls.appendChild(this.zoomInButton);

		toolbar.appendChild(this.counter);
		toolbar.appendChild(this.zoomToggle);
		toolbar.appendChild(this.zoomControls);
		toolbar.appendChild(this.openButton);
		toolbar.appendChild(this.toggleButton);
		toolbar.appendChild(this.closeButton);

		this.thumbsBar = doc.createElement('div');
		this.thumbsBar.className = 'mg-overlay-thumbs';
		this.thumbsBar.addEventListener('click', (event) => {
			const target = (event.target as HTMLElement).closest<HTMLElement>(
				'.mg-overlay-thumb'
			);
			if (!target) return;
			const nextIndex = Number(target.dataset.index);
			if (Number.isNaN(nextIndex)) return;
			this.index = nextIndex;
			this.renderCurrent();
		});

		this.overlay.appendChild(prev);
		this.overlay.appendChild(this.stage);
		this.overlay.appendChild(next);
		this.overlay.appendChild(toolbar);
		this.overlay.appendChild(this.thumbsBar);

		this.overlay.addEventListener('click', (event) => {
			if (event.target !== this.overlay) return;
			this.close();
		});

		this.overlay.addEventListener(
			'wheel',
			(event) => this.handleZoomWheel(event),
			{ passive: false }
		);

		this.stage.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			if (target.closest('.mg-audio-player, .internal-embed, audio, .mg-overlay-toolbar, .mg-overlay-thumbs')) {
				return;
			}
			if (target === this.stage) {
				this.close();
			}
		});

		this.stage.addEventListener('dblclick', (event) => {
			const item = this.items[this.index];
			if (!item) return;

			const action =
				this.options.onDoubleClickContent ?? this.options.onOpenExternal;
			if (!action) return;

			event.preventDefault();
			action(item);
		});

		doc.body.appendChild(this.overlay);
	}

private createEdge(
		doc: Document,
		side: 'left' | 'right',
		glyph: string,
		label: string
	): HTMLElement {
		const edge = doc.createElement('div');
		edge.className = `mg-overlay-edge mg-overlay-edge-${side}`;
		edge.setAttribute('role', 'button');
		edge.setAttribute('tabindex', '0');
		edge.setAttribute('aria-label', label);

		const arrow = doc.createElement('span');
		arrow.className = 'mg-overlay-arrow';
		arrow.textContent = glyph;
		edge.appendChild(arrow);

		const go = (event: Event) => {
			event.stopPropagation();
			this.navigate(side === 'left' ? -1 : 1);
		};

		edge.addEventListener('click', go);
		edge.addEventListener(
			'wheel',
			(event) => {
				if (event.deltaY === 0) return;

				const scroller =
					this.stage?.querySelector<HTMLElement>('.mg-pdf-scroll');
				if (!scroller) return;

				scroller.scrollBy({ top: event.deltaY });
				event.preventDefault();
			},
			{ passive: false }
		);
		edge.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				go(event);
			}
		});

		return edge;
	}

	private renderCurrent(): void {
		if (!this.stage || !this.counter) return;

		const item = this.items[this.index];
		if (!item) return;

		this.pauseMedia();
		this.zoomHandle?.reset();
		this.zoomHandle = null;
		this.destroyContent();
		this.stage.empty();
		this.stage.classList.toggle('mg-overlay-stage-pdf', this.mediaType === 'pdf');
		this.stage.classList.toggle(
			'mg-overlay-stage-image',
			this.mediaType === 'image'
		);
		this.overlay?.classList.toggle('is-pdf', this.mediaType === 'pdf');

		if (this.options.renderContent) {
			this.contentHandle =
				this.options.renderContent(item, this.stage, this.mediaType) ?? null;
			this.zoomHandle = this.contentHandle?.zoom ?? null;
		} else {
			const doc = this.getDocument();
			const media = doc.createElement(this.mediaType === 'video' ? 'video' : 'img');

			if (this.mediaType === 'video') {
				Object.entries(this.options.videoAttributes).forEach(([key, value]) => {
					media.setAttribute(key, value);
				});
			}

			(media as HTMLImageElement | HTMLMediaElement).src = item.resourcePath;
			this.stage.appendChild(media);

			if (this.mediaType === 'image') {
				(media as HTMLImageElement).draggable = false;
				this.zoomHandle = new ImageZoomController(
					this.stage,
					media as HTMLImageElement
				);
			}
		}

		if (this.zoomHandle) {
			this.zoomHandle.setOnChange?.(() => this.syncZoomUi());
			this.zoomHandle.reset();
			this.zoomHandle.setMode(this.zoomMode);
		} else {
			this.zoomMode = false;
		}

		this.applyZoomUi();
		this.counter.textContent = `${this.index + 1} / ${this.items.length}`;
		this.updateThumbSelection();
	}

	private renderThumbs(): void {
		if (!this.thumbsBar) return;

		const doc = this.getDocument();
		this.thumbsBar.empty();

		this.items.forEach((item, itemIndex) => {
			const thumb = doc.createElement('button');
			thumb.type = 'button';
			thumb.className = 'mg-overlay-thumb';
			thumb.dataset.index = String(itemIndex);
			thumb.setAttribute('aria-label', item.file.basename);
			thumb.title = item.file.basename;

			const isVideo = this.mediaType === 'video';
			const thumbSource = this.options.thumbSrc?.(item);

			if (thumbSource) {
				const preview = doc.createElement('img');
				preview.setAttribute('loading', 'lazy');
				preview.setAttribute('src', thumbSource);
				preview.setAttribute('alt', item.file.basename);
				thumb.appendChild(preview);
			} else if (this.mediaType === 'pdf') {
				thumb.classList.add('is-placeholder');
				const label = doc.createElement('span');
				label.textContent = 'PDF';
				thumb.appendChild(label);
			} else {
				const preview = doc.createElement(isVideo ? 'video' : 'img');

				if (isVideo) {
					preview.setAttribute('muted', 'true');
					preview.setAttribute('preload', 'metadata');
					preview.setAttribute('playsinline', 'true');
					preview.setAttribute('src', `${item.resourcePath}#t=0.1`);
				} else {
					preview.setAttribute('loading', 'lazy');
					preview.setAttribute('src', item.resourcePath);
					preview.setAttribute('alt', item.file.basename);
				}

				thumb.appendChild(preview);
			}

			this.thumbsBar?.appendChild(thumb);
		});

		this.updateThumbSelection();
	}

	private updateThumbSelection(): void {
		if (!this.thumbsBar) return;

		const thumbs = this.thumbsBar.querySelectorAll<HTMLElement>('.mg-overlay-thumb');
		thumbs.forEach((thumb, thumbIndex) => {
			thumb.classList.toggle('is-current', thumbIndex === this.index);
		});
		this.scheduleThumbCenter();
	}

	private scheduleThumbCenter(): void {
		if (this.thumbCenterFrame !== null) {
			window.cancelAnimationFrame(this.thumbCenterFrame);
		}
		this.thumbCenterFrame = window.requestAnimationFrame(() => {
			this.thumbCenterFrame = null;
			const current = this.thumbsBar?.querySelector<HTMLElement>(
				'.mg-overlay-thumb.is-current'
			);
			if (current) {
				this.centerThumb(current);
			}
		});
	}

	private centerThumb(thumb: HTMLElement): void {
		const bar = this.thumbsBar;
		if (!bar) return;

		const scroller = this.findScrollable(bar);
		if (!scroller) return;

		const scrollerRect = scroller.getBoundingClientRect();
		if (scrollerRect.width === 0) return;

		const thumbRect = thumb.getBoundingClientRect();
		const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
		const target = Math.max(
			0,
			Math.min(
				maxScroll,
				scroller.scrollLeft +
					(thumbRect.left - scrollerRect.left) -
					(scrollerRect.width - thumbRect.width) / 2
			)
		);

		scroller.scrollTo({ left: target, behavior: 'smooth' });
		window.setTimeout(() => {
			if (Math.abs(scroller.scrollLeft - target) > 2) {
				scroller.scrollLeft = target;
			}
		}, 320);
	}

	private findScrollable(start: HTMLElement): HTMLElement | null {
		let element: HTMLElement | null = start;
		while (element) {
			if (element.scrollWidth > element.clientWidth + 1) {
				return element;
			}
			element = element.parentElement;
		}
		return start;
	}

	private navigate(delta: number): void {
		if (this.items.length < 2) return;
		this.index = (this.index + delta + this.items.length) % this.items.length;
		this.renderCurrent();
	}

	private toggleArrows(): void {
		const visible = !this.options.arrowsVisible;
		this.options = { ...this.options, arrowsVisible: visible };
		this.applyArrowsVisibility();
		this.options.onArrowsVisibleChange(visible);
	}

	private setZoomMode(enabled: boolean): void {
		const next = enabled && this.zoomHandle !== null;
		this.zoomMode = next;
		this.zoomHandle?.setMode(next);
		if (!next) {
			this.zoomHandle?.reset();
		}
		this.overlay?.classList.toggle('mg-zoom-mode', next);
		this.applyZoomUi();
	}

	private applyZoomUi(): void {
		const available = this.zoomHandle !== null;

		this.overlay?.classList.toggle('mg-zoom-mode', this.zoomMode);
		this.zoomToggle?.classList.toggle('is-hidden', !available);
		this.zoomToggle?.classList.toggle('is-active', this.zoomMode);
		this.zoomToggle?.setAttribute('aria-pressed', String(this.zoomMode));
		this.zoomControls?.classList.toggle(
			'is-hidden',
			!available || !this.zoomMode
		);
		this.syncZoomUi();
	}

	private syncZoomUi(): void {
		if (!this.zoomPercentButton || !this.zoomOutButton || !this.zoomInButton) {
			return;
		}

		if (!this.zoomHandle || !this.zoomMode) {
			this.zoomPercentButton.textContent = '100%';
			this.zoomOutButton.disabled = true;
			this.zoomInButton.disabled = true;
			return;
		}

		const zoom = this.zoomHandle.getZoom();
		this.zoomPercentButton.textContent = `${Math.round(zoom * 100)}%`;
		this.zoomOutButton.disabled =
			zoom <= this.zoomHandle.getMinZoom() + 0.001;
		this.zoomInButton.disabled =
			zoom >= this.zoomHandle.getMaxZoom() - 0.001;
	}

	private handleZoomWheel(event: WheelEvent): void {
		if (!this.zoomMode || !this.zoomHandle?.handleWheel) return;

		const target = event.target as HTMLElement | null;
		if (
			target?.closest?.(
				'.mg-overlay-toolbar, .mg-overlay-thumbs, .mg-overlay-edge, .mg-pdf-toolbar'
			)
		) {
			return;
		}

		if (this.zoomHandle.handleWheel(event)) {
			event.preventDefault();
			this.syncZoomUi();
		}
	}

	private applyArrowsVisibility(): void {
		this.overlay?.classList.toggle('mg-arrows-hidden', !this.options.arrowsVisible);
		this.toggleButton?.classList.toggle('is-active', this.options.arrowsVisible);
	}

	private applyOpenVisibility(): void {
		this.openButton?.classList.toggle(
			'is-hidden',
			typeof this.options.onOpenExternal !== 'function'
		);
	}

	private openCurrent(): void {
		const item = this.items[this.index];
		if (!item) return;
		this.options.onOpenExternal?.(item);
	}

	private destroyContent(): void {
		this.contentHandle?.destroy();
		this.contentHandle = null;
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (!this.overlay || this.overlay.classList.contains('is-hidden')) return;

		if (this.options.onKeyDown?.(event)) return;

		if (this.zoomMode && this.zoomHandle) {
			switch (event.key) {
				case '+':
				case '=':
					event.preventDefault();
					this.zoomHandle.zoomIn();
					this.syncZoomUi();
					return;
				case '-':
				case '_':
					event.preventDefault();
					this.zoomHandle.zoomOut();
					this.syncZoomUi();
					return;
				case '0':
					event.preventDefault();
					this.zoomHandle.reset();
					this.syncZoomUi();
					return;
				default:
					break;
			}
		}

		switch (event.key) {
			case 'Escape':
				if (this.zoomMode) {
					this.setZoomMode(false);
				} else {
					this.close();
				}
				break;
			case 'ArrowLeft':
				event.preventDefault();
				this.navigate(-1);
				break;
			case 'ArrowRight':
				event.preventDefault();
				this.navigate(1);
				break;
			default:
				break;
		}
	}

	private pauseMedia(): void {
		this.stage
			?.querySelectorAll<HTMLMediaElement>('video, audio')
			.forEach((media) => media.pause());
	}
}