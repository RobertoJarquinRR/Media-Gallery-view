import { App } from 'obsidian';
import { GalleryFile } from '../core/types';

export type OverlayMediaType = 'image' | 'video';

export interface OverlayOptions {
	arrowsVisible: boolean;
	onArrowsVisibleChange: (visible: boolean) => void;
	videoAttributes: Record<string, string>;
}

export class OverlayManager {
	private readonly app: App;
	private overlay: HTMLDivElement | null = null;
	private stage: HTMLDivElement | null = null;
	private thumbsBar: HTMLDivElement | null = null;
	private counter: HTMLSpanElement | null = null;
	private toggleButton: HTMLButtonElement | null = null;

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
	}

	open(items: GalleryFile[], index: number, mediaType: OverlayMediaType): void {
		const doc = this.getDocument();
		this.ensureOverlay(doc);

		this.items = items;
		this.index = Math.max(0, Math.min(index, items.length - 1));
		this.mediaType = mediaType;

		this.renderThumbs();
		this.renderCurrent();
		this.applyArrowsVisibility();
		this.overlay?.classList.remove('is-hidden');

		doc.removeEventListener('keydown', this.boundKeyDown);
		doc.addEventListener('keydown', this.boundKeyDown);
	}

	close(): void {
		this.pauseMedia();
		this.overlay?.classList.add('is-hidden');
		this.getDocument().removeEventListener('keydown', this.boundKeyDown);
	}

	destroy(): void {
		this.close();
		this.overlay?.remove();
		this.overlay = null;
		this.stage = null;
		this.thumbsBar = null;
		this.counter = null;
		this.toggleButton = null;
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

		const prev = this.createEdge(doc, 'left', '‹', 'Previous');
		const next = this.createEdge(doc, 'right', '›', 'Next');

		const toolbar = doc.createElement('div');
		toolbar.className = 'mg-overlay-toolbar';

		this.counter = doc.createElement('span');
		this.counter.className = 'mg-overlay-counter';

		this.toggleButton = doc.createElement('button');
		this.toggleButton.type = 'button';
		this.toggleButton.className = 'mg-overlay-toggle';
		this.toggleButton.textContent = '↔';
		this.toggleButton.setAttribute('aria-label', 'Toggle arrows');
		this.toggleButton.title = 'Toggle arrows';
		this.toggleButton.addEventListener('click', (event) => {
			event.stopPropagation();
			this.toggleArrows();
		});

		toolbar.appendChild(this.counter);
		toolbar.appendChild(this.toggleButton);

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
			if (event.target === this.overlay) {
				this.close();
			}
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
		this.stage.innerHTML = '';

		const doc = this.getDocument();
		const media = doc.createElement(this.mediaType === 'video' ? 'video' : 'img');

		if (this.mediaType === 'video') {
			Object.entries(this.options.videoAttributes).forEach(([key, value]) => {
				media.setAttribute(key, value);
			});
		}

		(media as HTMLImageElement | HTMLMediaElement).src = item.resourcePath;
		this.stage.appendChild(media);

		this.counter.textContent = `${this.index + 1} / ${this.items.length}`;
		this.updateThumbSelection();
	}

	private renderThumbs(): void {
		if (!this.thumbsBar) return;

		const doc = this.getDocument();
		this.thumbsBar.innerHTML = '';

		this.items.forEach((item, itemIndex) => {
			const thumb = doc.createElement('button');
			thumb.type = 'button';
			thumb.className = 'mg-overlay-thumb';
			thumb.dataset.index = String(itemIndex);
			thumb.setAttribute('aria-label', item.file.basename);
			thumb.title = item.file.basename;

			const isVideo = this.mediaType === 'video';
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
			this.thumbsBar?.appendChild(thumb);
		});

		this.updateThumbSelection();
	}

	private updateThumbSelection(): void {
		if (!this.thumbsBar) return;

		const thumbs = this.thumbsBar.querySelectorAll<HTMLElement>('.mg-overlay-thumb');
		thumbs.forEach((thumb, thumbIndex) => {
			const isCurrent = thumbIndex === this.index;
			thumb.classList.toggle('is-current', isCurrent);
			if (isCurrent) {
				thumb.scrollIntoView({ block: 'nearest', inline: 'center' });
			}
		});
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

	private applyArrowsVisibility(): void {
		this.overlay?.classList.toggle('mg-arrows-hidden', !this.options.arrowsVisible);
		this.toggleButton?.classList.toggle('is-active', this.options.arrowsVisible);
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (!this.overlay || this.overlay.classList.contains('is-hidden')) return;

		switch (event.key) {
			case 'Escape':
				this.close();
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
		const media = this.stage?.querySelector('video');
		media?.pause();
	}
}