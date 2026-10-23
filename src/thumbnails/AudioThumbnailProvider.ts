import { App, TFile, TFolder } from 'obsidian';
import * as mm from 'music-metadata';
import {
	encodeImageBuffer,
	generateImageThumbnail,
} from './ImageThumbnailProvider';

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

const COVER_BASENAMES = [
	'cover',
	'folder',
	'front',
	'album',
	'albumart',
	'artwork',
	'thumb',
];

const COVER_EXTENSIONS = new Set([
	'avif',
	'bmp',
	'gif',
	'jpeg',
	'jpg',
	'png',
	'webp',
]);

const AUDIO_QUALITY = 0.85;

export interface GeneratedThumbnail {
	data: ArrayBuffer;
	width: number;
	height: number;
	extension: 'webp' | 'png';
}

interface Picture {
	data: Uint8Array;
	format: string;
}

export async function generateAudioThumbnail(
	app: App,
	file: TFile,
	targetSize: number
): Promise<GeneratedThumbnail | null> {
	const mime =
		MIME_TYPES[file.extension.toLowerCase()] ?? `audio/${file.extension}`;

	const picture = await extractEmbeddedPicture(app, file, mime);
	if (picture) {
		const encoded = await encodeImageBuffer(
			picture.data,
			picture.format,
			targetSize,
			AUDIO_QUALITY
		);
		if (encoded) return encoded;
	}

	const cover = findFolderCover(file);
	if (cover) {
		return generateImageThumbnail(app, cover, targetSize, AUDIO_QUALITY);
	}

	return null;
}

async function extractEmbeddedPicture(
	app: App,
	file: TFile,
	mime: string
): Promise<Picture | null> {
	try {
		const data = new Uint8Array(await app.vault.adapter.readBinary(file.path));
		return parsePicture(data, mime);
	} catch (error) {
		console.warn(`[MediaGallery] Could not read ${file.path}`, error);
		return null;
	}
}

async function parsePicture(data: Uint8Array, mime: string): Promise<Picture | null> {
	try {
		const metadata = await mm.parseBuffer(data, mime, { duration: false });
		const pictures = metadata.common.picture;
		if (!pictures || pictures.length === 0) return null;

		const picture = pictures[0];
		if (!picture?.data || picture.data.byteLength === 0) return null;

		return {
			data: new Uint8Array(
				picture.data.buffer,
				picture.data.byteOffset,
				picture.data.byteLength
			).slice(),
			format: picture.format || 'image/jpeg',
		};
	} catch {
		return null;
	}
}

const folderCoverCache = new Map<string, TFile | null>();

function findFolderCover(file: TFile): TFile | null {
	const folder = file.parent;
	if (!(folder instanceof TFolder)) return null;

	const cached = folderCoverCache.get(folder.path);
	if (cached !== undefined) return cached;

	const candidates = folder.children.filter(
		(child): child is TFile =>
			child instanceof TFile &&
			COVER_EXTENSIONS.has(child.extension.toLowerCase())
	);

	if (candidates.length === 0) {
		folderCoverCache.set(folder.path, null);
		return null;
	}

	for (const name of COVER_BASENAMES) {
		const match = candidates.find(
			(candidate) =>
				candidate.basename.toLowerCase().replace(/[\s_-]/g, '') === name
		);
		if (match) {
			folderCoverCache.set(folder.path, match);
			return match;
		}
	}

	const loose =
		candidates.find((candidate) =>
			/(cover|folder|front|album|artwork)/i.test(candidate.basename)
		) ?? null;

	folderCoverCache.set(folder.path, loose);
	return loose;
}
