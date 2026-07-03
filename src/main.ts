import {
	Plugin,
	MarkdownPostProcessorContext,
	App,
	normalizePath,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	MediaGallerySetting,
	SettingTab,
} from './settings.js';

export default class MediaGallery extends Plugin {
	settings!: MediaGallerySetting;

	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			'MediaGallery',
			(Source, Container, Context) => {
				const path = GetPath(Source);
				const gallery = new Gallery(
					path,
					Source,
					Container,
					Context,
					this.app,
				);

				gallery.VideoGallery();
				
			},
		);

		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},

			DEFAULT_SETTINGS,

			(await this.loadData()) as Partial<MediaGallerySetting>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class Gallery {
	private _path: string;
	private _source: string;
	private _container: HTMLElement;
	private _context: MarkdownPostProcessorContext;
	public _app: App;

	constructor(
		Path: string,
		source: string,
		container: HTMLElement,
		context: MarkdownPostProcessorContext,
		app: App,
	) {
		this._path = Path;
		this._source = source;
		this._container = container;
		this._context = context;
		this._app = app;
	}

	public VideoGallery(){
		let VideoExtensions = ['mp4', 'webm', 'ogv', 'mov'];

		const div = this._container.createDiv();

		div.id = 'video-grid';

		const files = this._app.vault
			.getFiles()
			.filter((file) => file.path.startsWith(this._path));
		const VideoFiles = files.filter((video) =>
			VideoExtensions.includes(video.extension),
		);

		if (files.length > 0){
			VideoFiles.forEach((video, index) => {
			div.createDiv(
				{ cls: 'video-card', attr:{
					"data-path": video.path,
				} },
				(videocard) => {
					videocard.createEl('video', {
						attr: {
							src: this._app.vault.getResourcePath(video),
							controls: 'true',
							muted: 'true',
							preload: 'auto',
							
						},
					});

					videocard.createDiv({ cls: 'video-info' }, (videoinfo) => {
						const name = VideoFiles[index]?.basename;

						videoinfo.createEl('p', { text: name });
						
					});
					
				},
			);
			
		});
		}
		else
		{
			div.createEl('p', {text: "File not found"})
			
		}
		div.addEventListener('dblclick', (event: MouseEvent) =>{
			const target = event.target as HTMLElement;
			if (target.tagName === 'VIDEO') {
        return;
    }

   const videoCard = target.closest('.video-card');

			if (videoCard !== null) {
				let filePath: string | null = videoCard.getAttribute('data-path');

				if (!filePath) {
					const titleParagraph = videoCard.querySelector('.video-info p');
					if (titleParagraph && titleParagraph.textContent) {
						filePath = `${titleParagraph.textContent.trim()}.mp4`;
					}
				}

				if (filePath && filePath.trim() !== '') {
					void this._app.workspace.openLinkText(filePath, '', true);
				} else {
					console.warn('Could not determine a path for this element.');
				}
			}
		});
	}
}


function GetPath(Source: string): string {
	if (Source === undefined) {
		return 'Write a path';
	}
	const result = Source.split(',')
		.map((p) => p.trim().toLocaleLowerCase())
		.find((p) => p.startsWith('path:'))
		?.replace('path:', '')
		.trim();

	return normalizePath(result ?? 'Write a path');
}
