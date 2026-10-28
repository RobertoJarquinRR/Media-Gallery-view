import { LayoutMode } from '../core/types';

export interface MasonryOptions {
	columns?: number;
	gap?: number;
	minWidth?: number;
}

const LAYOUT_DEBOUNCE = 40;
const DEFAULT_COLUMNS = 0;
const DEFAULT_GAP = 5;
const DEFAULT_MIN_WIDTH = 220;

export class GalleryGrid {
	private readonly element: HTMLDivElement;
	private readonly isMasonry: boolean;
	private readonly masonryColumns: number;
	private readonly masonryGap: number;
	private readonly masonryMinWidth: number;
	private readonly ratioListeners = new Map<HTMLElement, () => void>();
	private resizeObserver: ResizeObserver | null = null;
	private windowResizeHandler: (() => void) | null = null;
	private lastObservedWidth = -1;
	private layoutTimer: number | null = null;
	private layoutFrame: number | null = null;
	private destroyed = false;
	private initializing: boolean;

	constructor(
		className: string = 'mg-gallery-grid',
		private readonly doc: Document = activeDocument,
		cardHeight: number = 290,
		layoutMode: LayoutMode = 'masonry',
		masonry: MasonryOptions = {}
	) {
		this.element = createDiv();
		this.element.className = className;
		this.isMasonry = layoutMode === 'masonry';
		this.masonryColumns = masonry.columns ?? DEFAULT_COLUMNS;
		this.masonryGap = masonry.gap ?? DEFAULT_GAP;
		this.masonryMinWidth = masonry.minWidth ?? DEFAULT_MIN_WIDTH;

		if (layoutMode === 'grid') {
			this.element.classList.add('mg-layout-grid');
		} else if (layoutMode === 'grid-ratio') {
			this.element.classList.add('mg-layout-grid-ratio');
		} else {
			this.element.classList.add('mg-layout-masonry');
		}
		this.element.setCssProps({ '--mg-card-height': `${cardHeight}px` });

		this.initializing = this.isMasonry;
		if (this.initializing) {
			this.element.classList.add('mg-masonry-initializing');
		}

		if (this.isMasonry) {
			this.initMasonry();
		}
	}

	addCard(cardElement: HTMLElement): void {
		this.element.appendChild(cardElement);

		if (!this.isMasonry) return;

		const listener = (): void => this.scheduleLayout();
		cardElement.addEventListener('mg-media-resize', listener);
		this.ratioListeners.set(cardElement, listener);
		this.scheduleLayout();
	}

	showEmptyMessage(message: string): void {
		this.resetMasonry();
		this.element.empty();
		const p = createEl('p');
		p.textContent = message;
		this.element.appendChild(p);
	}

	clear(): void {
		this.resetMasonry();
		this.element.empty();
	}

	getElement(): HTMLDivElement {
		return this.element;
	}

	destroy(): void {
		this.destroyed = true;
		this.cancelScheduledLayout();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;

		const view = this.doc.defaultView;
		if (view && this.windowResizeHandler) {
			view.removeEventListener('resize', this.windowResizeHandler);
		}
		this.windowResizeHandler = null;

		for (const [card, listener] of this.ratioListeners) {
			card.removeEventListener('mg-media-resize', listener);
		}
		this.ratioListeners.clear();

		this.element.remove();
	}

	private initMasonry(): void {
		if (typeof ResizeObserver === 'function') {
			this.resizeObserver = new ResizeObserver((entries) => {
				const width = entries[0]?.contentRect.width ?? -1;
				if (Math.abs(width - this.lastObservedWidth) < 0.5) return;
				this.lastObservedWidth = width;
				this.scheduleLayout();
			});
			this.resizeObserver.observe(this.element);
			return;
		}

		const view = this.doc.defaultView;
		if (!view) return;

		this.windowResizeHandler = () => {
			this.lastObservedWidth = -1;
			this.scheduleLayout();
		};
		view.addEventListener('resize', this.windowResizeHandler);
	}

	private scheduleLayout(): void {
		if (this.destroyed) return;

		const view = this.doc.defaultView;
		if (!view) return;

		if (this.layoutTimer !== null) {
			view.clearTimeout(this.layoutTimer);
		}

		this.layoutTimer = view.setTimeout(() => {
			this.layoutTimer = null;
			if (this.layoutFrame !== null) return;

			this.layoutFrame = view.requestAnimationFrame(() => {
				this.layoutFrame = null;
				this.layout();
			});
		}, LAYOUT_DEBOUNCE);
	}

	private cancelScheduledLayout(): void {
		const view = this.doc.defaultView;

		if (view && this.layoutTimer !== null) {
			view.clearTimeout(this.layoutTimer);
		}
		if (view && this.layoutFrame !== null) {
			view.cancelAnimationFrame(this.layoutFrame);
		}

		this.layoutTimer = null;
		this.layoutFrame = null;
	}

	private layout(): void {
		if (this.destroyed) return;

		const width = this.element.clientWidth;
		if (width <= 0) return;

		if (this.initializing) {
			this.element.classList.remove('mg-masonry-initializing');
			this.initializing = false;
		}

		const cards = Array.from(
			this.element.querySelectorAll<HTMLElement>('.mg-file-card')
		);

		if (cards.length === 0) {
			this.element.setCssProps({
				height: 'auto',
				'--mg-masonry-card-width': '220px',
			});
			return;
		}

		const gap = Math.max(0, this.masonryGap);
		const minWidth = Math.max(1, this.masonryMinWidth);
		const configured = Math.max(0, Math.floor(this.masonryColumns));
		const columns =
			configured > 0
				? configured
				: Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
		const cardWidth = Math.max(1, (width - gap * (columns - 1)) / columns);

		this.element.setCssProps({
			'--mg-masonry-card-width': `${cardWidth}px`,
		});

		const heights = new Array<number>(columns).fill(0);
		const positions: Array<{ element: HTMLElement; x: number; y: number }> =
			[];

		for (const card of cards) {
			const height = card.offsetHeight;
			let column = 0;
			for (let index = 1; index < columns; index++) {
				if ((heights[index] ?? 0) < (heights[column] ?? 0)) {
					column = index;
				}
			}

			const x = column * (cardWidth + gap);
			const y = heights[column] ?? 0;
			positions.push({ element: card, x, y });
			heights[column] = y + height + gap;
		}

		for (const position of positions) {
			position.element.style.transform = `translate3d(${position.x.toFixed(
				2
			)}px, ${position.y.toFixed(2)}px, 0)`;
		}

		const totalHeight = Math.max(0, Math.max(...heights) - gap);
		this.element.setCssProps({ height: `${totalHeight.toFixed(2)}px` });
	}

	private resetMasonry(): void {
		this.cancelScheduledLayout();

		for (const [card, listener] of this.ratioListeners) {
			card.removeEventListener('mg-media-resize', listener);
		}
		this.ratioListeners.clear();

		this.element.setCssProps({
			height: 'auto',
			'--mg-masonry-card-width': '220px',
		});
	}
}
