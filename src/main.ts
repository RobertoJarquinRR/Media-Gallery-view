import {
	Plugin,
	MarkdownPostProcessorContext,
	App,
	normalizePath,
} from 'obsidian';


export default class MediaGallery extends Plugin {


	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			'MediaGallery',


			(source, container, context) => {

				const gallery = new Gallery(
					source,
					container,
					context,
					this.app,
				);

				gallery.VideoGallery();

			},
		);


	}

	onunload() { }


	
}


class Gallery {
	private _source: string;
	private _container: HTMLElement;
	private _context: MarkdownPostProcessorContext;
	public _app: App;

	constructor(
		source: string,
		container: HTMLElement,
		context: MarkdownPostProcessorContext,
		app: App,
	) {
		this._source = source;
		this._container = container;
		this._context = context;
		this._app = app;


	}

	private getFiles() {

		const result = this._source.split(/\r?\n/)
			.map((p) => p.trim().toLocaleLowerCase());

		const path = result.find((p) => p.startsWith('path:'))
			?.replace('path:', '')
			.trim()

		if (path) {
			return this._app.vault
			.getFiles()
				.filter((file) => file.path.startsWith(normalizePath(path)))
		}
		else {
			this._container.createEl('p', { text: 'Write a path' })
			return;
		}


	}
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
		else {
			div.createEl('p', { text: "File not found" })

		}
		div.addEventListener('dblclick', (event: MouseEvent) => {
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
