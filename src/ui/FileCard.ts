import { App, TFile } from 'obsidian';

export interface FileCardOptions {
	file: TFile;
	resourcePath: string;
	mediaTag: keyof HTMLElementTagNameMap;
	mediaAttributes: Record<string, string>;
	showFileName: boolean;
	mediaWidth?: number;
	mediaHeight?: number;
	fallbackAspectRatio?: number;
	doubleClickMedia?: boolean;
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
	private mediaRatio: number | null = null;
	private ratioKnown = false;

	constructor(private readonly app: App, options: FileCardOptions) {
		this.element = this.createCard(options);
		this.mediaElement = this.createMediaElement(options);
		this.infoElement = options.showFileName
			? this.createInfoElement(options.file)
			: null;

		const knownSize = Boolean(options.mediaWidth && options.mediaHeight);
		const initialRatio = knownSize
			? (options.mediaWidth as number) / (options.mediaHeight as number)
			: options.fallbackAspectRatio;
		if (initialRatio) {
			this.applyMediaRatio(initialRatio, knownSize);
		}

		this.attachMediaRatioTracking();

		this.element.appendChild(this.mediaElement);
		if (this.infoElement) {
			this.element.appendChild(this.infoElement);
		}

		this.syncRatioFromMedia();
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

		if (options.mediaWidth && options.mediaHeight) {
			element.setAttribute('width', String(options.mediaWidth));
			element.setAttribute('height', String(options.mediaHeight));
		}

		if (options.resourcePath) {
			(element as HTMLMediaElement | HTMLImageElement).src =
				options.resourcePath;
		} else {
			element.classList.add('mg-media-pending');
		}

		return element;
	}

	setMediaSource(src: string, width?: number, height?: number): void {
		if (width && height) {
			this.mediaElement.setAttribute('width', String(width));
			this.mediaElement.setAttribute('height', String(height));
			this.applyMediaRatio(width / height, true);
		}

		this.mediaElement.classList.remove('mg-media-pending');
		(this.mediaElement as HTMLImageElement | HTMLMediaElement).src = src;

		if (!this.ratioKnown) {
			this.syncRatioFromMedia();
		}
	}

	private attachMediaRatioTracking(): void {
		const handler = (): void => this.syncRatioFromMedia();
		this.mediaElement.addEventListener('load', handler);
		this.mediaElement.addEventListener('loadedmetadata', handler);
	}

	private syncRatioFromMedia(): void {
		if (this.ratioKnown) return;

		const media = this.mediaElement as HTMLImageElement &
			HTMLVideoElement;
		const width = media.naturalWidth || media.videoWidth;
		const height = media.naturalHeight || media.videoHeight;

		if (width > 0 && height > 0) {
			this.applyMediaRatio(width / height, true);
		}
	}

	private applyMediaRatio(ratio: number, known: boolean): void {
		if (!Number.isFinite(ratio) || ratio <= 0) return;

		const changed =
			this.mediaRatio === null ||
			Math.abs(this.mediaRatio - ratio) > 0.001;

		this.mediaRatio = ratio;
		this.ratioKnown = known;
		this.mediaElement.style.aspectRatio = String(ratio);

		if (changed && this.element.isConnected) {
			const view = this.element.ownerDocument.defaultView;
			this.element.dispatchEvent(
				view
					? new view.Event('mg-media-resize')
					: new Event('mg-media-resize')
			);
		}
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
				const isMedia = target.tagName.toLowerCase() === options.mediaTag;
				if (isMedia && !options.doubleClickMedia) return;
				options.onDoubleClick?.(options.file, event);
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