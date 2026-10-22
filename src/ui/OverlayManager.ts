import { TFile } from 'obsidian';
import { App } from 'obsidian';

export class OverlayManager {
	private overlay: HTMLDivElement | null = null;
	private readonly app: App;
	private boundKeyDown: (e: KeyboardEvent) => void;

	constructor(app: App) {
		this.app = app;
		this.boundKeyDown = this.handleKeyDown.bind(this);
	}

	private getDocument(): Document {
		return this.app.workspace.containerEl?.ownerDocument ?? activeDocument;
	}

	open(file: TFile, mediaTag: string): void {
		const doc = this.getDocument();
		this.ensureOverlay(doc);

		if (!this.overlay) return;

		this.overlay.innerHTML = '';
		this.overlay.classList.remove('is-hidden');

		const element = doc.createElement(mediaTag);
		(element as HTMLMediaElement | HTMLImageElement).src = this.app.vault.getResourcePath(file);
		this.overlay.appendChild(element);

		doc.addEventListener('keydown', this.boundKeyDown);
	}

	close(): void {
		if (this.overlay) {
			this.overlay.classList.add('is-hidden');
		}
		const doc = this.getDocument();
		doc.removeEventListener('keydown', this.boundKeyDown);
	}

	private ensureOverlay(doc: Document): void {
		if (this.overlay) return;

		this.overlay = doc.createElement('div');
		this.overlay.className = 'mg-overlay is-hidden';

		this.overlay.addEventListener('click', (event) => {
			if (event.target === this.overlay) {
				this.close();
			}
		});

		doc.body.appendChild(this.overlay);
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			this.close();
		}
	}

	destroy(): void {
		this.close();
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}
		const doc = this.getDocument();
		doc.removeEventListener('keydown', this.boundKeyDown);
	}
}