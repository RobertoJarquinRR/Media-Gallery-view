import { App, TFile } from 'obsidian';
import { AnnotationMode } from 'pdfjs-dist';
import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	RenderTask,
} from 'pdfjs-dist';
import { openPdf } from '../thumbnails/pdfWorker';
import type { OverlayZoomHandle } from './zoomTypes';

interface PageSlot {
	num: number;
	wrapper: HTMLDivElement;
	canvas: HTMLCanvasElement | null;
	renderTask: RenderTask | null;
	rendered: boolean;
	rendering: boolean;
	visible: boolean;
	token: number;
	preview: HTMLImageElement | null;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;
const WHEEL_FACTOR = 0.0015;
const MAX_PAGE_WIDTH = 2400;

export class PdfViewer implements OverlayZoomHandle {
	private readonly app: App;
	private readonly file: TFile;
	private readonly previewSrc: string | null;
	private readonly doc: Document;
	private readonly onScrollBound: () => void;
	private readonly onTouchStartBound: (event: TouchEvent) => void;
	private readonly onTouchMoveBound: (event: TouchEvent) => void;
	private readonly onTouchEndBound: (event: TouchEvent) => void;

	private root: HTMLDivElement | null = null;
	private scroll: HTMLDivElement | null = null;
	private label: HTMLSpanElement | null = null;
	private loading: HTMLDivElement | null = null;
	private loadingTask: PDFDocumentLoadingTask | null = null;
	private pdf: PDFDocumentProxy | null = null;
	private observer: IntersectionObserver | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private slots: PageSlot[] = [];
	private currentPage = 1;
	private destroyed = false;
	private scrollFrame: number | null = null;
	private resizeTimer: number | null = null;
	private zoom = MIN_ZOOM;
	private zoomMode = false;
	private pageWidth = 0;
	private pinchDistance = 0;
	private pinchZoom = MIN_ZOOM;
	private pinchActive = false;
	private onZoomChange: (() => void) | null = null;

	constructor(app: App, file: TFile, previewSrc?: string) {
		this.app = app;
		this.file = file;
		this.previewSrc = previewSrc ?? null;
		this.doc = app.workspace.containerEl.ownerDocument ?? activeDocument;
		this.onScrollBound = () => this.scheduleCurrentPageUpdate();
		this.onTouchStartBound = (event) => this.handleTouchStart(event);
		this.onTouchMoveBound = (event) => this.handleTouchMove(event);
		this.onTouchEndBound = (event) => this.handleTouchEnd(event);
	}

	async mount(parent: HTMLElement): Promise<void> {
		this.root = this.doc.createElement('div');
		this.root.className = 'mg-pdf-viewer';

		const toolbar = this.doc.createElement('div');
		toolbar.className = 'mg-pdf-toolbar';

		const previous = this.createPageButton('‹', 'Previous page', -1);
		const next = this.createPageButton('›', 'Next page', 1);

		this.label = this.doc.createElement('span');
		this.label.className = 'mg-pdf-page-label';
		this.label.textContent = '1 / …';

		toolbar.appendChild(previous);
		toolbar.appendChild(this.label);
		toolbar.appendChild(next);

		this.scroll = this.doc.createElement('div');
		this.scroll.className = 'mg-pdf-scroll';
		this.scroll.addEventListener('scroll', this.onScrollBound, { passive: true });
		this.scroll.addEventListener('touchstart', this.onTouchStartBound, {
			passive: false,
		});
		this.scroll.addEventListener('touchmove', this.onTouchMoveBound, {
			passive: false,
		});
		this.scroll.addEventListener('touchend', this.onTouchEndBound);
		this.scroll.addEventListener('touchcancel', this.onTouchEndBound);

		this.loading = this.doc.createElement('div');
		this.loading.className = 'mg-pdf-loading';
		this.loading.textContent = 'Loading PDF…';
		this.scroll.appendChild(this.loading);

		this.root.appendChild(toolbar);
		this.root.appendChild(this.scroll);
		parent.appendChild(this.root);

		try {
			const data = await this.app.vault.adapter.readBinary(this.file.path);
			this.loadingTask = openPdf(data);

			const pdf = await this.loadingTask.promise;
			if (this.destroyed) {
				void this.loadingTask.destroy();
				return;
			}

			this.pdf = pdf;
			await this.buildPages(pdf);
		} catch (error) {
			if (!this.destroyed) {
				console.error(`[MediaGallery] Could not open ${this.file.path}`, error);
				this.showError();
			}
		}
	}

	handleKey(event: KeyboardEvent): boolean {
		if (!this.scroll) return false;

		switch (event.key) {
			case 'PageDown':
				event.preventDefault();
				this.scroll.scrollBy({
					top: this.scroll.clientHeight * 0.9,
					behavior: 'smooth',
				});
				return true;
			case 'PageUp':
				event.preventDefault();
				this.scroll.scrollBy({
					top: -this.scroll.clientHeight * 0.9,
					behavior: 'smooth',
				});
				return true;
			case 'Home':
				event.preventDefault();
				this.goToPage(1);
				return true;
			case 'End':
				event.preventDefault();
				this.goToPage(this.slots.length);
				return true;
			default:
				return false;
		}
	}

	getMinZoom(): number {
		return MIN_ZOOM;
	}

	getMaxZoom(): number {
		return MAX_ZOOM;
	}

	getZoom(): number {
		return this.zoom;
	}

	setOnChange(listener: () => void): void {
		this.onZoomChange = listener;
	}

	setMode(enabled: boolean): void {
		this.zoomMode = enabled;
		this.root?.classList.toggle('is-zoom-mode', enabled);
		if (!enabled) {
			this.pinchActive = false;
			this.pinchDistance = 0;
		}
	}

	zoomIn(): void {
		this.applyZoom(this.zoom * ZOOM_STEP);
	}

	zoomOut(): void {
		this.applyZoom(this.zoom / ZOOM_STEP);
	}

	reset(): void {
		this.applyZoom(MIN_ZOOM);
	}

	handleWheel(event: WheelEvent): boolean {
		if (!this.zoomMode || !this.scroll || event.deltaY === 0) return false;

		if (event.shiftKey) {
			this.scroll.scrollBy({ top: event.deltaY });
			return true;
		}

		if (this.zoom <= MIN_ZOOM + 0.001 && event.deltaY > 0) {
			this.scroll.scrollBy({ top: event.deltaY });
			return true;
		}

		const factor = Math.exp(-event.deltaY * WHEEL_FACTOR);
		this.applyZoom(this.zoom * factor, event.clientX, event.clientY);
		return true;
	}

	private applyZoom(
		nextZoom: number,
		clientX?: number,
		clientY?: number
	): void {
		if (!this.scroll) return;

		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
		if (Math.abs(next - this.zoom) < 0.001) return;

		const rect = this.scroll.getBoundingClientRect();
		const relativeX =
			clientX !== undefined ? clientX - rect.left : rect.width / 2;
		const relativeY =
			clientY !== undefined ? clientY - rect.top : rect.height / 2;
		const xRatio =
			(this.scroll.scrollLeft + relativeX) /
			Math.max(1, this.scroll.scrollWidth);
		const yRatio =
			(this.scroll.scrollTop + relativeY) /
			Math.max(1, this.scroll.scrollHeight);

		this.zoom = next;
		this.updatePageWidth();
		this.scheduleRerender();
		this.onZoomChange?.();

		window.requestAnimationFrame(() => {
			if (this.destroyed || !this.scroll) return;

			const maxLeft = Math.max(
				0,
				this.scroll.scrollWidth - this.scroll.clientWidth
			);
			const maxTop = Math.max(
				0,
				this.scroll.scrollHeight - this.scroll.clientHeight
			);
			this.scroll.scrollLeft = Math.min(
				maxLeft,
				Math.max(0, xRatio * this.scroll.scrollWidth - relativeX)
			);
			this.scroll.scrollTop = Math.min(
				maxTop,
				Math.max(0, yRatio * this.scroll.scrollHeight - relativeY)
			);
		});
	}

	private updatePageWidth(): void {
		if (!this.scroll || !this.root) return;

		const available = this.scroll.clientWidth - 8;
		if (available <= 0) return;

		const width = Math.min(
			MAX_PAGE_WIDTH,
			Math.max(320, Math.round(available * this.zoom))
		);
		this.pageWidth = width;
		this.root.classList.toggle('is-zoomed', this.zoom > MIN_ZOOM + 0.001);
		this.root.setCssProps({
			'--mg-pdf-page-width': `${width}px`,
		});
	}

	private handleTouchStart(event: TouchEvent): void {
		if (!this.zoomMode || event.touches.length !== 2) return;

		this.pinchDistance = this.touchDistance(event.touches);
		this.pinchZoom = this.zoom;
		this.pinchActive = this.pinchDistance > 0;
		if (this.pinchActive) {
			event.preventDefault();
		}
	}

	private handleTouchMove(event: TouchEvent): void {
		if (
			!this.zoomMode ||
			!this.pinchActive ||
			event.touches.length !== 2 ||
			this.pinchDistance === 0
		) {
			return;
		}

		const distance = this.touchDistance(event.touches);
		if (distance === 0) return;

		event.preventDefault();
		const first = event.touches[0];
		const second = event.touches[1];
		if (!first || !second) return;

		this.applyZoom(
			this.pinchZoom * (distance / this.pinchDistance),
			(first.clientX + second.clientX) / 2,
			(first.clientY + second.clientY) / 2
		);
	}

	private handleTouchEnd(event: TouchEvent): void {
		if (!this.pinchActive) return;

		if (event.touches.length < 2) {
			this.pinchActive = false;
			this.pinchDistance = 0;
			this.scheduleRerender();
		}
	}

	private touchDistance(touches: TouchList): number {
		const first = touches[0];
		const second = touches[1];
		if (!first || !second) return 0;

		return Math.hypot(
			first.clientX - second.clientX,
			first.clientY - second.clientY
		);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;

		if (this.scrollFrame !== null) {
			window.cancelAnimationFrame(this.scrollFrame);
			this.scrollFrame = null;
		}
		if (this.resizeTimer !== null) {
			window.clearTimeout(this.resizeTimer);
			this.resizeTimer = null;
		}

		this.observer?.disconnect();
		this.observer = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;

		this.scroll?.removeEventListener('scroll', this.onScrollBound);
		this.scroll?.removeEventListener('touchstart', this.onTouchStartBound);
		this.scroll?.removeEventListener('touchmove', this.onTouchMoveBound);
		this.scroll?.removeEventListener('touchend', this.onTouchEndBound);
		this.scroll?.removeEventListener('touchcancel', this.onTouchEndBound);

		for (const slot of this.slots) {
			slot.renderTask?.cancel();
			slot.canvas?.remove();
		}
		this.slots = [];

		void this.loadingTask?.destroy();
		this.pdf = null;
		this.loadingTask = null;

		this.root?.remove();
		this.root = null;
		this.scroll = null;
		this.label = null;
	}

	private createPageButton(
		glyph: string,
		label: string,
		direction: number
	): HTMLButtonElement {
		const button = this.doc.createElement('button');
		button.type = 'button';
		button.className = 'mg-pdf-page-button';
		button.textContent = glyph;
		button.setAttribute('aria-label', label);
		button.title = label;
		button.addEventListener('click', (event) => {
			event.stopPropagation();
			const target = Math.min(
				Math.max(1, this.currentPage + direction),
				Math.max(1, this.slots.length)
			);
			this.goToPage(target);
		});
		return button;
	}

	private async buildPages(pdf: PDFDocumentProxy): Promise<void> {
		if (!this.scroll) return;

		const first = await pdf.getPage(1);
		if (this.destroyed || !this.scroll) {
			first.cleanup();
			return;
		}

		const viewport = first.getViewport({ scale: 1 });
		const aspect = viewport.width / viewport.height;
		first.cleanup();

		for (let num = 1; num <= pdf.numPages; num++) {
			const wrapper = this.doc.createElement('div');
			wrapper.className = 'mg-pdf-page';
			wrapper.dataset.page = String(num);
			wrapper.setCssProps({ '--mg-pdf-aspect': String(aspect) });
			this.scroll.appendChild(wrapper);

			let preview: HTMLImageElement | null = null;
			if (num === 1 && this.previewSrc) {
				preview = this.doc.createElement('img');
				preview.className = 'mg-pdf-page-preview';
				preview.src = this.previewSrc;
				preview.alt = '';
				wrapper.appendChild(preview);
			}

			this.slots.push({
				num,
				wrapper,
				canvas: null,
				renderTask: null,
				rendered: false,
				rendering: false,
				visible: false,
				token: 0,
				preview,
			});
		}

		this.updatePageWidth();

		this.observer = new IntersectionObserver(
			(entries) => this.handleIntersections(entries),
			{ root: this.scroll, rootMargin: '600px 0px' }
		);
		for (const slot of this.slots) {
			this.observer.observe(slot.wrapper);
		}

		this.resizeObserver = new ResizeObserver(() => {
			this.updatePageWidth();
			this.scheduleRerender();
		});
		this.resizeObserver.observe(this.scroll);
		this.loading?.remove();
		this.loading = null;
		this.updatePageLabel();
	}

	private handleIntersections(entries: IntersectionObserverEntry[]): void {
		for (const entry of entries) {
			const target = entry.target as HTMLElement;
			const slot = this.slots[Number(target.dataset.page) - 1];
			if (!slot) continue;

			slot.visible = entry.isIntersecting;
			if (entry.isIntersecting) {
				void this.renderSlot(slot);
			} else {
				this.unloadSlot(slot);
			}
		}
	}

	private async renderSlot(slot: PageSlot): Promise<void> {
		if (
			this.destroyed ||
			slot.rendered ||
			slot.rendering ||
			!slot.visible ||
			!this.pdf ||
			!this.scroll
		) {
			return;
		}

		slot.rendering = true;
		const token = ++slot.token;

		try {
			const page = await this.pdf.getPage(slot.num);
			if (
				this.destroyed ||
				slot.token !== token ||
				!slot.visible ||
				!this.scroll
			) {
				page.cleanup();
				return;
			}

			const base = page.getViewport({ scale: 1 });
			const width =
				this.pageWidth ||
				Math.min(
					Math.max(320, this.scroll.clientWidth - 8),
					900
				);
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			const scale = (width / base.width) * dpr;
			const viewport = page.getViewport({ scale });

			const canvas = this.doc.createElement('canvas');
			canvas.className = 'mg-pdf-page-canvas';
			canvas.width = Math.max(1, Math.floor(viewport.width));
			canvas.height = Math.max(1, Math.floor(viewport.height));

			const context = canvas.getContext('2d');
			if (!context) {
				page.cleanup();
				return;
			}

			slot.wrapper.setCssProps({
				'--mg-pdf-aspect': String(base.width / base.height),
			});

			const task = page.render({
				canvasContext: context,
				viewport,
				intent: 'display',
				annotationMode: AnnotationMode.DISABLE,
			});
			slot.renderTask = task;
			await task.promise;

			if (
				this.destroyed ||
				slot.token !== token ||
				!slot.visible
			) {
				page.cleanup();
				return;
			}

			slot.renderTask = null;
			slot.canvas = canvas;
			slot.wrapper.appendChild(canvas);
			slot.preview?.remove();
			slot.preview = null;
			slot.rendered = true;
			page.cleanup();
		} catch (error) {
			if (
				!(error instanceof Error) ||
				error.name !== 'RenderingCancelledException'
			) {
				console.error(`[MediaGallery] Could not render page ${slot.num}`, error);
			}
		} finally {
			if (slot.token === token) {
				slot.rendering = false;
				slot.renderTask = null;
			}
		}
	}

	private unloadSlot(slot: PageSlot): void {
		slot.token++;
		slot.renderTask?.cancel();
		slot.renderTask = null;
		slot.canvas?.remove();
		slot.canvas = null;
		slot.rendered = false;
		slot.rendering = false;
	}

	private scheduleCurrentPageUpdate(): void {
		if (this.scrollFrame !== null) return;

		this.scrollFrame = window.requestAnimationFrame(() => {
			this.scrollFrame = null;
			this.updatePageLabel();
		});
	}

	private updatePageLabel(): void {
		if (!this.scroll || !this.label || this.slots.length === 0) return;

		const anchor = this.scroll.scrollTop + this.scroll.clientHeight / 2;
		const first = this.slots[0];
		if (!first) return;

		let current = first;

		for (const slot of this.slots) {
			if (slot.wrapper.offsetTop <= anchor) {
				current = slot;
			} else {
				break;
			}
		}

		this.currentPage = current.num;
		this.label.textContent = `${current.num} / ${this.slots.length}`;
	}

	private goToPage(num: number): void {
		if (this.slots.length === 0) return;

		const target = Math.min(Math.max(1, num), this.slots.length);
		this.currentPage = target;

		const slot = this.slots[target - 1];
		if (!slot) return;
		slot.wrapper.scrollIntoView({ block: 'start', behavior: 'smooth' });

		if (this.label) {
			this.label.textContent = `${target} / ${this.slots.length}`;
		}
	}

	private scheduleRerender(): void {
		if (this.resizeTimer !== null) {
			window.clearTimeout(this.resizeTimer);
		}

		this.resizeTimer = window.setTimeout(() => {
			this.resizeTimer = null;

			const visible = this.slots.filter((slot) => slot.visible);
			for (const slot of visible) {
				this.unloadSlot(slot);
			}
			for (const slot of visible) {
				void this.renderSlot(slot);
			}
		}, 250);
	}

	private showError(): void {
		if (!this.root) return;

		this.root.empty();
		this.loading = null;
		const message = this.doc.createElement('p');
		message.className = 'mg-pdf-error';
		message.textContent = `Could not open ${this.file.basename}.pdf`;
		this.root.appendChild(message);
	}
}
