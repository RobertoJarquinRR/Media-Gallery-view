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
                
                const lines = source.split(/\r?\n/);
                
                const typeLine = lines.find((p) => p.trim().toLocaleLowerCase().startsWith('type:'));
                
                let typeGallery = 'video'; 
                if (typeLine) {
                    const cutIndex = typeLine.indexOf(':');
                    typeGallery = typeLine.substring(cutIndex + 1).trim().toLocaleLowerCase();
                }

                switch (typeGallery) {
                    case 'video':
                        gallery.videoGallery();
                        break;
                    case 'image':
                        gallery.imagesGallery();
                        break;
                    default:
                        gallery.videoGallery();
                        break;
                }
            },
        );
    }

    onunload() { }
}

interface GalleryOptions {
    elementConfig: DomElementInfo;
    onClick?: (File: TFile, tag: keyof HTMLElementTagNameMap) => void;
    ondblClick?: (path: string, event: MouseEvent, tag: string) => void;
}

class Gallery {
    private _source: string;
    private _container: HTMLElement;
    private _context: MarkdownPostProcessorContext;
    public _app: App;

    private static readonly FILE_CARD_CLASS = 'mg-file-card';
    private static readonly INFO_CARD_CLASS = 'mg-info';
    private static readonly GALLERY_GRID_ID = 'mg-gallery-grid';
    private static readonly MEDIA_ELEMENT_CLASS = 'mg-media-element';
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
        const lines = this._source.split(/\r?\n/);

        const pathLine = lines.find((p) => p.trim().toLocaleLowerCase().startsWith('path:'));

        let path = undefined;
        if (pathLine) {
            const cutIndex = pathLine.indexOf(':');
            path = pathLine.substring(cutIndex + 1).trim();
        }

        if (path) {
            return this._app.vault
                .getFiles()
                .filter((file) => file.path.startsWith(normalizePath(path)));
        } else {
            this._container.createEl('p', { text: 'Write a path' });
            return;
        }
    }

    private galleryElement(
        galleryGrid: HTMLElement,
        files: TFile[],
        tag: keyof HTMLElementTagNameMap,
        options: GalleryOptions,
    ): void {
        files.forEach((file) => {
            const fileCard = galleryGrid.createDiv({
                cls: Gallery.FILE_CARD_CLASS,
                attr: {
                    'data-path': file.path,
                },
            });

            options.elementConfig.attr!.src =
                this._app.vault.getResourcePath(file);

            const element = fileCard.createEl(tag, options.elementConfig);
            element.addClass(Gallery.MEDIA_ELEMENT_CLASS);

            const info = fileCard.createDiv({ cls: Gallery.INFO_CARD_CLASS });

            info.createEl('p', { text: file.basename + '.' + file.extension });

            element.addEventListener('click', () => {
                options.onClick?.(file, tag);
            });
        });
    }

    private openNewLeft(div: HTMLDivElement, tag: string): void {
        div.addEventListener('dblclick', (event) => {
            const target = event.target as HTMLElement;
            if (target.tagName.toLocaleLowerCase() === tag) {
                return;
            }

            const file = target.closest(`.${Gallery.FILE_CARD_CLASS}`);
            const filePath = file?.getAttribute('data-path');
            if (filePath) {
                void this._app.workspace.openLinkText(filePath, '', true);
            }
        });
    }

    private getOrCreateOverlay(): HTMLElement {
        if (this._overlay) return this._overlay;

        const overlay = activeDocument.body.createDiv({
            cls: Gallery.OVERLAY_CLASS,
        });
        overlay.addClass('is-hidden');

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.closeOverlay();
            }
        });

        activeDocument.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeOverlay();
        });

        this._overlay = overlay;
        return overlay;
    }

    private openOverlay(file: TFile, tag: keyof HTMLElementTagNameMap): void {
        const overlay = this.getOrCreateOverlay();
        overlay.empty();

        const config: DomElementInfo = {
            attr: {
                src: this._app.vault.getResourcePath(file),
            },
        };

        overlay.createEl(tag, config);
        overlay.removeClass('is-hidden');
    }

    private closeOverlay(): void {
        this._overlay?.addClass('is-hidden');
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
        this.openNewLeft(galleryGrid, 'video');

        const options: GalleryOptions = {
            elementConfig: {
                attr: {
                    src: '',
                    controls: 'true',
                    muted: 'true',
                    preload: 'auto',
                },
            },
        };
        this.galleryElement(galleryGrid, videoFiles, 'video', options);
    }

    public imagesGallery() {
        let imagesExtensions = [
            'avif',
            'bmp',
            'gif',
            'jpeg',
            'jpg',
            'png',
            'svg',
            'webp',
        ];

        const files = this.getFiles();

        if (!files) {
            return;
        }

        const imagesFiles = files.filter((image) =>
            imagesExtensions.includes(image.extension),
        );

        const galleryGrid = this._container.createDiv();
        galleryGrid.id = Gallery.GALLERY_GRID_ID;

        if (imagesFiles.length === 0) {
            galleryGrid.createEl('p', { text: 'Images not found' });
            return;
        }

        this.openNewLeft(galleryGrid, 'img');
        const options: GalleryOptions = {
            elementConfig: {
                attr: {
                    src: '',
                },
            },
            onClick: (file, tag) => this.openOverlay(file, tag),
        };

        this.galleryElement(galleryGrid, imagesFiles, 'img', options);
    }
}