export type Language = 'en' | 'es';

const EN = {
	viewTitle: 'Media Gallery',
	openView: 'Open media gallery',

	sectionGeneral: 'General',
	language: 'Language',
	languageDesc: 'Language used by the gallery view and settings.',
	enableGalleryView: 'Enable gallery view',
	enableGalleryViewDesc:
		'Adds a ribbon icon to open the gallery view. You can also open it from the command palette. Code block galleries keep working.',

	sectionLibraries: 'Libraries',
	librariesDesc:
		'Each library has a name, a media type and a vault folder. You can add as many as you want.',
	addLibrary: 'Add library',
	noLibraries: 'No libraries configured. Add one to get started.',
	libraryName: 'Name',
	libraryNamePlaceholder: 'Library name',
	libraryPath: 'Folder path',
	libraryPathPlaceholder: 'Attachments/media',
	libraryFallbackName: 'Library {index}',
	deleteLibrary: 'Delete library',
	typeImage: 'Images',
	typePdf: 'PDF',
	typeVideo: 'Video',
	typeAudio: 'Music',

	sectionGalleryDefaults: 'Gallery defaults',
	defaultGalleryType: 'Default gallery type',
	defaultGalleryTypeDesc: 'Type used when the code block does not specify one',
	sortOrder: 'Sort order',
	sortOrderDesc: 'Order of the files inside the gallery',
	sortNameAsc: 'Name, ascending',
	sortNameDesc: 'Name, descending',
	sortMtimeDesc: 'Modified, newest first',
	sortMtimeAsc: 'Modified, oldest first',
	sortSizeDesc: 'Size, largest first',
	sortSizeAsc: 'Size, smallest first',
	videoExtensions: 'Video extensions',
	videoExtensionsDesc:
		'Comma-separated list. This filters files, it does not add playback support: the file must also be decodable by Obsidian',
	imageExtensions: 'Image extensions',
	imageExtensionsDesc: 'Comma-separated list of image file extensions',
	pdfExtensions: 'PDF extensions',
	pdfExtensionsDesc: 'Comma-separated list of PDF file extensions',
	audioExtensions: 'Audio extensions',
	audioExtensionsDesc: 'Comma-separated list of audio file extensions',
	openFilesWith: 'Open files with',
	openFilesWithDesc:
		'Where the open button and double-click send files: a new Obsidian tab or the system default app',
	openWithObsidian: 'Obsidian tab',
	openWithSystem: 'System default app',

	sectionAppearance: 'Appearance',
	cardHeight: 'Card height',
	cardHeightDesc:
		'Height of each row of cards in the grid layouts, in pixels. Masonry ignores it',
	layoutMode: 'Layout mode',
	layoutModeDesc: 'Choose how gallery items are arranged',
	layoutMasonry: 'Masonry / columns (variable height, column flow)',
	layoutGrid: 'Grid (fixed height, rows)',
	showFileNames: 'Show file names',
	showFileNamesDesc: 'Display the file name below each card',
	overlayArrows: 'Overlay arrows',
	overlayArrowsDesc:
		'Show the side arrows in the image overlay. Tapping the edges always navigates',
	customThumbnailFolder: 'Custom thumbnail folder',
	customThumbnailFolderDesc:
		'Vault folder with your own thumbnails. Files are matched by name: clip.pdf uses clip.png',

	sectionVideo: 'Video',
	videoControls: 'Show controls',
	videoControlsDesc: 'Show the native playback controls (they appear on hover)',
	videoMuted: 'Muted by default',
	videoMutedDesc: 'Start videos without sound',
	videoAutoplay: 'Autoplay',
	videoAutoplayDesc: 'Browsers only allow autoplay when the video is muted',
	videoLoop: 'Loop',
	videoLoopDesc: 'Restart videos when they reach the end',

	sectionAudio: 'Audio',
	audioAutoplay: 'Autoplay',
	audioAutoplayDesc:
		'Start playing the first track automatically when opening the overlay',

	emptyLibraryPath:
		'No folder configured for this library. Set a path in Settings.',
	emptyNoLibraries: 'No libraries configured. Add one in Settings.',
	emptyNoFiles: 'No files found in this folder.',
	renderError: 'Could not render this library.',
	openSettings: 'Open settings',

	configError: 'Configuration error: {message}',
	unknownType: 'Unknown gallery type: "{type}". Available: {available}',
	noFilesIn: 'No {type} files found in: {path}',
	renderErrorGeneric: 'Error rendering gallery: {message}',
	thumbnailsUnavailable: 'Thumbnail service unavailable',
	imagesNotFound: 'Images not found',
	pdfNotFound: 'PDF not found',
	videoNotFound: 'Video not found',
	audioNotFound: 'Audio files not found',
};

export type TranslationKey = keyof typeof EN;

const ES: Record<TranslationKey, string> = {
	viewTitle: 'Galería multimedia',
	openView: 'Abrir galería multimedia',

	sectionGeneral: 'General',
	language: 'Idioma',
	languageDesc: 'Idioma usado por la vista de galería y los ajustes.',
	enableGalleryView: 'Activar vista de galería',
	enableGalleryViewDesc:
		'Añade un icono en la cinta para abrir la vista de galería. También puedes abrirla desde la paleta de comandos. Las galerías en bloques de código siguen funcionando.',

	sectionLibraries: 'Bibliotecas',
	librariesDesc:
		'Cada biblioteca tiene un nombre, un tipo de archivo y una carpeta del vault. Puedes añadir todas las que quieras.',
	addLibrary: 'Añadir biblioteca',
	noLibraries: 'No hay bibliotecas configuradas. Añade una para empezar.',
	libraryName: 'Nombre',
	libraryNamePlaceholder: 'Nombre de la biblioteca',
	libraryPath: 'Ruta de la carpeta',
	libraryPathPlaceholder: 'Adjuntos/multimedia',
	libraryFallbackName: 'Biblioteca {index}',
	deleteLibrary: 'Eliminar biblioteca',
	typeImage: 'Imágenes',
	typePdf: 'PDF',
	typeVideo: 'Vídeo',
	typeAudio: 'Música',

	sectionGalleryDefaults: 'Valores por defecto',
	defaultGalleryType: 'Tipo de galería por defecto',
	defaultGalleryTypeDesc: 'Tipo usado cuando el bloque de código no indica uno',
	sortOrder: 'Orden',
	sortOrderDesc: 'Orden de los archivos dentro de la galería',
	sortNameAsc: 'Nombre, ascendente',
	sortNameDesc: 'Nombre, descendente',
	sortMtimeDesc: 'Modificado, más reciente primero',
	sortMtimeAsc: 'Modificado, más antiguo primero',
	sortSizeDesc: 'Tamaño, mayor primero',
	sortSizeAsc: 'Tamaño, menor primero',
	videoExtensions: 'Extensiones de vídeo',
	videoExtensionsDesc:
		'Lista separada por comas. Solo filtra archivos, no añade reproducción: el archivo también debe poder decodificarlo Obsidian',
	imageExtensions: 'Extensiones de imagen',
	imageExtensionsDesc: 'Lista de extensiones de imagen separadas por comas',
	pdfExtensions: 'Extensiones de PDF',
	pdfExtensionsDesc: 'Lista de extensiones de PDF separadas por comas',
	audioExtensions: 'Extensiones de audio',
	audioExtensionsDesc: 'Lista de extensiones de audio separadas por comas',
	openFilesWith: 'Abrir archivos con',
	openFilesWithDesc:
		'Dónde abren los archivos el botón de abrir y el doble clic: una pestaña de Obsidian o la app por defecto del sistema',
	openWithObsidian: 'Pestaña de Obsidian',
	openWithSystem: 'App por defecto del sistema',

	sectionAppearance: 'Apariencia',
	cardHeight: 'Altura de las tarjetas',
	cardHeightDesc:
		'Altura de cada fila de tarjetas en los modos de cuadrícula, en píxeles. Masonry la ignora',
	layoutMode: 'Modo de disposición',
	layoutModeDesc: 'Elige cómo se organizan los elementos de la galería',
	layoutMasonry: 'Masonry / columnas (altura variable, flujo en columnas)',
	layoutGrid: 'Cuadrícula (altura fija, filas)',
	showFileNames: 'Mostrar nombres',
	showFileNamesDesc: 'Muestra el nombre del archivo debajo de cada tarjeta',
	overlayArrows: 'Flechas del visor',
	overlayArrowsDesc:
		'Muestra las flechas laterales en el visor de imágenes. Tocar los bordes siempre navega',
	customThumbnailFolder: 'Carpeta de miniaturas',
	customThumbnailFolderDesc:
		'Carpeta del vault con tus propias miniaturas. Se emparejan por nombre: clip.pdf usa clip.png',

	sectionVideo: 'Vídeo',
	videoControls: 'Mostrar controles',
	videoControlsDesc:
		'Muestra los controles nativos de reproducción (aparecen al pasar el ratón)',
	videoMuted: 'Silenciado por defecto',
	videoMutedDesc: 'Inicia los vídeos sin sonido',
	videoAutoplay: 'Reproducción automática',
	videoAutoplayDesc:
		'Los navegadores solo permiten la reproducción automática si el vídeo está silenciado',
	videoLoop: 'Repetir',
	videoLoopDesc: 'Reinicia los vídeos al llegar al final',

	sectionAudio: 'Audio',
	audioAutoplay: 'Reproducción automática',
	audioAutoplayDesc:
		'Reproduce la primera pista automáticamente al abrir el visor',

	emptyLibraryPath:
		'Esta biblioteca no tiene carpeta configurada. Indica una ruta en Ajustes.',
	emptyNoLibraries: 'No hay bibliotecas configuradas. Añade una en Ajustes.',
	emptyNoFiles: 'No se encontraron archivos en esta carpeta.',
	renderError: 'No se pudo renderizar esta biblioteca.',
	openSettings: 'Abrir ajustes',

	configError: 'Error de configuración: {message}',
	unknownType: 'Tipo de galería desconocido: "{type}". Disponibles: {available}',
	noFilesIn: 'No se encontraron archivos de tipo {type} en: {path}',
	renderErrorGeneric: 'Error al renderizar la galería: {message}',
	thumbnailsUnavailable: 'El servicio de miniaturas no está disponible',
	imagesNotFound: 'No se encontraron imágenes',
	pdfNotFound: 'No se encontraron PDF',
	videoNotFound: 'No se encontraron vídeos',
	audioNotFound: 'No se encontraron archivos de audio',
};

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
	en: EN,
	es: ES,
};

export function translate(
	language: Language,
	key: TranslationKey,
	params?: Record<string, string | number>
): string {
	const dictionary = DICTIONARIES[language] ?? EN;
	let value = dictionary[key] ?? EN[key] ?? key;

	if (params) {
		for (const [name, replacement] of Object.entries(params)) {
			value = value.split(`{${name}}`).join(String(replacement));
		}
	}

	return value;
}

export function getLanguageLabel(language: Language): string {
	return language === 'es' ? 'Español' : 'English';
}
