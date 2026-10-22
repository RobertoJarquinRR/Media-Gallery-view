import { App, TFile } from 'obsidian';

export interface FileCardOptions {
	file: TFile;
	resourcePath: string;
	mediaTag: keyof HTMLElementTagNameMap;
	mediaAttributes: Record<string, string>;
	showFileName: boolean;
	onClick?: (file: TFile, event: MouseEvent) => void;
	onDoubleClick?: (file: TFile, event: MouseEvent) => void;
}

function getActiveDocument(app: App): Document {
	return app.workspace.containerEl?.ownerDocument ?? activeDocument;
}

export class FileCard {
	private readonly element: HTMLDivElement;
	private readonly mediaElement: HTMLElement;
	private readonly infoElement: HTMLDivElement | null;

	constructor(private readonly app: App, options: FileCardOptions) {
		this.element = this.createCard(options);
		this.mediaElement = this.createMediaElement(options);
		this.infoElement = options.showFileName
			? this.createInfoElement(options.file)
			: null;

		this.element.appendChild(this.mediaElement);
		if (this.infoElement) {
			this.element.appendChild(this.infoElement);
		}

		this.attachEvents(options);
	}

	private createCard(options: FileCardOptions): HTMLDivElement {
		const doc = getActiveDocument(this.app);
		const card = doc.createElement('div');
		card.className = 'mg-file-card';
		card.dataset.path = options.file.path;
		card.classList.add('mg-clickable');
		if (options.showFileName) {
			card.classList.add('mg-has-info');
		}
		return card;
	}

	private createMediaElement(options: FileCardOptions): HTMLElement {
		const doc = getActiveDocument(this.app);
		const element = doc.createElement(options.mediaTag);
		element.className = 'mg-media-element';

		Object.entries(options.mediaAttributes).forEach(([key, value]) => {
			element.setAttribute(key, value);
		});

		(element as HTMLMediaElement | HTMLImageElement).src = options.resourcePath;

		return element;
	}

	private createInfoElement(file: TFile): HTMLDivElement {
		const doc = getActiveDocument(this.app);
		const info = doc.createElement('div');
		info.className = 'mg-info';
		const name = doc.createElement('p');
		name.textContent = `${file.basename}.${file.extension}`;
		info.appendChild(name);
		return info;
	}

	private attachEvents(options: FileCardOptions): void {
		if (options.onClick) {
			this.mediaElement.addEventListener('click', (event) => {
				options.onClick?.(options.file, event);
			});
		}

		if (options.onDoubleClick) {
			this.element.addEventListener('dblclick', (event) => {
				const target = event.target as HTMLElement;
				if (target.tagName.toLowerCase() !== options.mediaTag) {
					options.onDoubleClick?.(options.file, event);
				}
			});
		}
	}

	getElement(): HTMLDivElement {
		return this.element;
	}

	destroy(): void {
		this.element.remove();
	}
}