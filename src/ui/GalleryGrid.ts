export class GalleryGrid {
	private readonly element: HTMLDivElement;

	constructor(
		className: string = 'mg-gallery-grid',
		private readonly doc: Document = activeDocument,
		cardHeight: number = 290
	) {
		this.element = this.doc.createElement('div');
		this.element.className = className;
		this.element.setCssProps({ '--mg-card-height': `${cardHeight}px` });
	}

	addCard(cardElement: HTMLElement): void {
		this.element.appendChild(cardElement);
	}

	showEmptyMessage(message: string): void {
		this.element.empty();
		const p = this.doc.createElement('p');
		p.textContent = message;
		this.element.appendChild(p);
	}

	clear(): void {
		this.element.empty();
	}

	getElement(): HTMLDivElement {
		return this.element;
	}

	destroy(): void {
		this.element.remove();
	}
}
