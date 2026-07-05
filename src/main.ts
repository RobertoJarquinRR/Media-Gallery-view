import {
	Plugin,
	MarkdownPostProcessorContext,
	App,
	normalizePath,
	TFile,
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
interface GalleryObcions {
	elementConfig: DomElementInfo,
	onClick?: (File: TFile, tag: keyof HTMLElementTagNameMap) => void,
	ondblClick?: (path: string, event: MouseEvent, tag: string) => void
}


class Gallery {
	private _source: string;
	private _container: HTMLElement;
	private _context: MarkdownPostProcessorContext;
	public _app: App;

	private static readonly FILE_CARD_CLASS = 'mg-file-card'
	private static readonly INFO_CARD_CLASS = 'mg-info'
	private static readonly GALLERY_GRID_ID = 'mg-gallery-grid'
	private static readonly MEDIA_ELEMENT_CLASS = 'mg-media-element'
	private static readonly OVERLAY_CLASS = 'mg-overlay';
	private _overlay: HTMLElement | null = null;

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
	private galleryElement(galleryGrid: HTMLElement, file: TFile, tag: keyof HTMLElementTagNameMap, opcions: GalleryObcions): void {
		const fileCard = galleryGrid.createDiv({
			cls: Gallery.FILE_CARD_CLASS, attr: {
				'data-path': file.path
			}
		})

		const element = fileCard.createEl(tag, opcions.elementConfig)
		element.addClass(Gallery.MEDIA_ELEMENT_CLASS);

		const info = fileCard.createDiv({ cls: Gallery.INFO_CARD_CLASS })


		info.createEl('p', { text: file.basename + '.' + file.extension });

		element.addEventListener('click', () => {
			opcions.onClick?.(file, tag)
		});





	}
	private openNewLeft(div: HTMLDivElement, tag: string): void {

		div.addEventListener('dblclick', (event) => {
			const target = event.target as HTMLElement
			if (target.tagName.toLocaleLowerCase() === tag) {
				return;
			}

			const file = target.closest(`.${Gallery.FILE_CARD_CLASS}`)
			const filePath = file?.getAttribute('data-path')
			if (filePath) {
				void this._app.workspace.openLinkText(filePath, '', true)
			}

		})

	}
	public videoGallery() {

		let videoExtensions = ['mkv', 'mov', 'mp4', 'ogv', 'webm'];


		const files = this.getFiles();

		if (!files) {
			return;
		}
		const videoFiles = files.filter((video) =>
			videoExtensions.includes(video.extension),
		);

		const galleryGrid = this._container.createDiv();
		galleryGrid.id = Gallery.GALLERY_GRID_ID;


		if (videoFiles.length === 0) {
			galleryGrid.createEl('p', { text: 'Video not found' });
			return;
		}
		this.openNewLeft(galleryGrid, 'video')
		videoFiles.forEach((video) => {


			const opcions: GalleryObcions = {
				elementConfig: {
							attr: {
								src: this._app.vault.getResourcePath(video),
								controls: 'true',
								muted: 'true',
								preload: 'auto',

							},
				},


			}

			this.galleryElement(galleryGrid, video, 'video', opcions);
		})



	}
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
