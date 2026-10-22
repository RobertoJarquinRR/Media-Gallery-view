export class GalleryGrid {
	private readonly element: HTMLDivElement;

	constructor(id: string = 'mg-gallery-grid', private readonly doc: Document = document) {
		this.element = doc.createElement('div');
		this.element.id = id;
		this.element.className = 'mg-gallery-grid';
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

	clear(): void {
		this.element.innerHTML = '';
	}

	getElement(): HTMLDivElement {
		return this.element;
	}

	destroy(): void {
		this.element.remove();
	}
}