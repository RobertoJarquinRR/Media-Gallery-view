export class GalleryGrid {
	private readonly element: HTMLDivElement;
	private observer: IntersectionObserver | null = null;

	constructor(
		id: string = 'mg-gallery-grid',
		private readonly doc: Document = activeDocument,
		cardHeight: number = 290
	) {
		this.element = doc.createElement('div');
		this.element.id = id;
		this.element.className = 'mg-gallery-grid';
		this.element.setCssProps({ '--mg-card-height': `${cardHeight}px` });
	}

	addCard(cardElement: HTMLElement): void {
		this.element.appendChild(cardElement);
	}

	showEmptyMessage(message: string): void {
		this.element.innerHTML = '';
		const p = this.doc.createElement('p');
		p.textContent = message;
		this.element.appendChild(p);
	}

	lazyLoadMedia(rootMargin: string = '200px'): void {
		const targets = Array.from(
			this.element.querySelectorAll<HTMLElement>('.mg-media-element[data-src]')
		);
		if (targets.length === 0) {
			return;
		}

		const win = this.doc.defaultView ?? window;
		this.observer = new win.IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					const media = entry.target as HTMLElement & { src?: string };
					const source = media.dataset.src;
					if (source) {
						media.src = source;
						delete media.dataset.src;
						if (media instanceof win.HTMLVideoElement) {
							media.setAttribute('preload', 'metadata');
							media.load();
						}
					}
					this.observer?.unobserve(media);
				}
			},
			{ rootMargin }
		);

		targets.forEach((target) => this.observer?.observe(target));
	}

	clear(): void {
		this.element.innerHTML = '';
	}

	getElement(): HTMLDivElement {
		return this.element;
	}

	destroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.element.remove();
	}
}