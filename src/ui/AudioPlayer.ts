import { App, TFile } from 'obsidian';
import { DEFAULT_AUDIO_ARTWORK } from './defaultArtwork';

interface AudioPlayerOptions {
	autoplay: boolean;
}

const MIME_TYPES: Record<string, string> = {
	mp3: 'audio/mpeg',
	flac: 'audio/flac',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	m4a: 'audio/mp4',
	wav: 'audio/wav',
	aac: 'audio/aac',
	opus: 'audio/opus',
	wma: 'audio/x-ms-wma',
	aiff: 'audio/aiff',
	aif: 'audio/aiff',
};

export class AudioPlayer {
	private readonly app: App;
	private readonly file: TFile;
	private readonly previewSrc: string | null;
	private readonly options: AudioPlayerOptions;
	private readonly doc: Document;

	private root: HTMLDivElement | null = null;
	private audio: HTMLAudioElement | null = null;
	private audioBlobUrl: string | null = null;
	private statusEl: HTMLDivElement | null = null;
	private resourcePath: string | null = null;

	private sources: string[] = [];
	private sourceIndex = 0;
	private usedBlob = false;
	private destroyed = false;
	private readonly onAudioError = () => this.tryNextSource();

	constructor(
		app: App,
		file: TFile,
		previewSrc?: string,
		options?: Partial<AudioPlayerOptions>,
		resourcePath?: string
	) {
		this.app = app;
		this.file = file;
		this.previewSrc = previewSrc ?? null;
		this.resourcePath = resourcePath?.trim() ? resourcePath : null;
		this.options = {
			autoplay: options?.autoplay ?? false,
		};
		this.doc = app.workspace.containerEl.ownerDocument ?? activeDocument;
	}

	async mount(parent: HTMLElement): Promise<void> {
		this.root = this.doc.createDiv();
		this.root.className = 'mg-audio-player';

		this.buildUI(parent);
		this.collectSources();
		await this.loadSource(0);
	}

	private buildUI(parent: HTMLElement): void {
		if (!this.root || !this.doc) return;

		const artworkWrapper = this.doc.createDiv();
		artworkWrapper.className = 'mg-audio-artwork-wrapper';
		const artwork = this.doc.createEl('img');
		artwork.className = 'mg-audio-artwork';
		artwork.alt = '';
		artwork.src = this.previewSrc ?? DEFAULT_AUDIO_ARTWORK;
		artworkWrapper.appendChild(artwork);

		const info = this.doc.createDiv();
		info.className = 'mg-audio-info';
		const title = this.doc.createDiv();
		title.className = 'mg-audio-title';
		title.textContent = this.file.basename;
		info.appendChild(title);

		const status = this.doc.createDiv();
		status.className = 'mg-audio-status is-hidden';

		this.audio = this.doc.createEl('audio');
		this.audio.className = 'mg-audio-element';
		this.audio.controls = true;
		this.audio.preload = 'metadata';
		this.audio.addEventListener('error', this.onAudioError);
		if (this.options.autoplay) {
			this.audio.addEventListener('loadedmetadata', () => {
				void this.audio?.play().catch(() => {});
			}, { once: true });
		}

		this.root.appendChild(artworkWrapper);
		this.root.appendChild(info);
		this.root.appendChild(this.audio);
		this.root.appendChild(status);

		parent.appendChild(this.root);

		this.statusEl = status;
	}

	private collectSources(): void {
		const candidates: string[] = [];
		const push = (value: string | null | undefined) => {
			if (!value) return;
			const trimmed = value.trim();
			if (!trimmed) return;
			if (candidates.includes(trimmed)) return;
			candidates.push(trimmed);
		};

		push(this.resourcePath);
		try {
			push(this.app.vault.getResourcePath(this.file));
		} catch {
			/* ignore */
		}
		try {
			push(this.app.vault.adapter.getResourcePath(this.file.path));
		} catch {
			/* ignore */
		}

		this.sources = candidates;
	}

	private async loadSource(index: number): Promise<void> {
		if (this.destroyed || !this.audio) return;
		this.sourceIndex = index;

		const source = this.sources[index];
		if (source) {
			this.audio.src = source;
			this.audio.load();
			return;
		}

		if (!this.usedBlob) {
			this.usedBlob = true;
			await this.loadFromBlob();
			return;
		}

		this.showError();
	}

	private async loadFromBlob(): Promise<void> {
		if (!this.audio) return;
		try {
			const data = await this.app.vault.adapter.readBinary(this.file.path);
			if (this.destroyed || !this.audio) return;
			if (!data || data.byteLength === 0) {
				this.showError();
				return;
			}
			const mime = MIME_TYPES[this.file.extension.toLowerCase()] ?? 'audio/mpeg';
			const blob = new Blob([data], { type: mime });
			this.audioBlobUrl = URL.createObjectURL(blob);
			this.audio.src = this.audioBlobUrl;
			this.audio.load();
		} catch (error) {
			console.error('[MediaGallery] Could not read audio file', this.file.path, error);
			this.showError();
		}
	}

	private tryNextSource(): void {
		if (this.destroyed || !this.audio) return;
		void this.loadSource(this.sourceIndex + 1);
	}

	private showError(): void {
		if (!this.statusEl) return;
		this.statusEl.classList.remove('is-hidden');
		this.statusEl.textContent = `Could not load the audio file (${this.file.extension}).`;
	}

	destroy(): void {
		this.destroyed = true;
		if (this.audio) {
			this.audio.removeEventListener('error', this.onAudioError);
			this.audio.pause();
			this.audio.removeAttribute('src');
			this.audio.load();
			this.audio = null;
		}
		if (this.audioBlobUrl) {
			URL.revokeObjectURL(this.audioBlobUrl);
			this.audioBlobUrl = null;
		}
		this.root?.remove();
		this.root = null;
	}
}