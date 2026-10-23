import { App, TFile } from 'obsidian';
import { AnnotationMode } from 'pdfjs-dist';
import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	RenderTask,
} from 'pdfjs-dist';
import { openPdf } from '../thumbnails/pdfWorker';

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

export class PdfViewer {
	private readonly app: App;
	private readonly file: TFile;
	private readonly previewSrc: string | null;
	private readonly doc: Document;
	private readonly onScrollBound: () => void;

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

	constructor(app: App, file: TFile, previewSrc?: string) {
		this.app = app;
		this.file = file;
		this.previewSrc = previewSrc ?? null;
		this.doc = app.workspace.containerEl.ownerDocument ?? activeDocument;
		this.onScrollBound = () => this.scheduleCurrentPageUpdate();
	}

	async mount(parent: HTMLElement): Promise<void> {
		this.root = this.doc.createDiv();
		this.root.className = 'mg-pdf-viewer';

		const toolbar = this.doc.createDiv();
		toolbar.className = 'mg-pdf-toolbar';

		const previous = this.createPageButton('‹', 'Previous page', -1);
		const next = this.createPageButton('›', 'Next page', 1);

		this.label = this.doc.createSpan();
		this.label.className = 'mg-pdf-page-label';
		this.label.textContent = '1 / …';

		toolbar.appendChild(previous);
		toolbar.appendChild(this.label);
		toolbar.appendChild(next);

		this.scroll = this.doc.createDiv();
		this.scroll.className = 'mg-pdf-scroll';
		this.scroll.addEventListener('scroll', this.onScrollBound, { passive: true });

		this.loading = this.doc.createDiv();
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
		const button = this.doc.createEl('button');
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
			const wrapper = this.doc.createDiv();
			wrapper.className = 'mg-pdf-page';
			wrapper.dataset.page = String(num);
			wrapper.setCssProps({ '--mg-pdf-aspect': String(aspect) });
			this.scroll.appendChild(wrapper);

			let preview: HTMLImageElement | null = null;
			if (num === 1 && this.previewSrc) {
				preview = this.doc.createEl('img');
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

		this.observer = new IntersectionObserver(
			(entries) => this.handleIntersections(entries),
			{ root: this.scroll, rootMargin: '600px 0px' }
		);
		for (const slot of this.slots) {
			this.observer.observe(slot.wrapper);
		}

		this.resizeObserver = new ResizeObserver(() => this.scheduleRerender());
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
			const available = Math.max(320, this.scroll.clientWidth - 48);
			const width = Math.min(available, 1000);
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			const scale = (width / base.width) * dpr;
			const viewport = page.getViewport({ scale });

			const canvas = this.doc.createEl('canvas');
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
		const message = this.doc.createEl('p');
		message.className = 'mg-pdf-error';
		message.textContent = `Could not open ${this.file.basename}.pdf`;
		this.root.appendChild(message);
	}
}
