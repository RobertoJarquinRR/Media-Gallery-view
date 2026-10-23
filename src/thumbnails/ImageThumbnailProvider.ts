import { App, TFile } from 'obsidian';
import { getImageWorkerPool } from './ImageWorkerPool';

export interface GeneratedThumbnail {
	data: ArrayBuffer;
	width: number;
	height: number;
	extension: 'webp';
}

const MIME_BY_EXTENSION: Record<string, string> = {
	avif: 'image/avif',
	bmp: 'image/bmp',
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	webp: 'image/webp',
};

const PASSTHROUGH_MAX_BYTES = 32 * 1024;

export async function generateImageThumbnail(
	app: App,
	file: TFile,
	targetSize: number,
	quality = 0.82
): Promise<GeneratedThumbnail | null> {
	const data = await app.vault.adapter.readBinary(file.path);
	if (!data || data.byteLength === 0) return null;

	const extension = file.extension.toLowerCase();
	const mime = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';

	if (
		extension === 'webp' &&
		targetSize >= 384 &&
		data.byteLength <= PASSTHROUGH_MAX_BYTES
	) {
		return { data, width: 0, height: 0, extension: 'webp' };
	}

	const generated = await encodeImageBuffer(data, mime, targetSize, quality);
	if (generated) return generated;

	return encodeOnMainThread(app, file, targetSize, quality);
}

export async function generateImagePreview(
	app: App,
	file: TFile,
	targetSize: number,
	quality = 0.6
): Promise<GeneratedThumbnail | null> {
	const data = await app.vault.adapter.readBinary(file.path);
	if (!data || data.byteLength === 0) return null;

	const mime =
		MIME_BY_EXTENSION[file.extension.toLowerCase()] ?? 'application/octet-stream';

	const generated = await encodeImageBuffer(data, mime, targetSize, quality);
	if (generated) return generated;

	return encodeOnMainThread(app, file, targetSize, quality);
}

export async function encodeImageBuffer(
	buffer: ArrayBuffer | Uint8Array,
	mime: string,
	targetSize: number,
	quality = 0.82
): Promise<GeneratedThumbnail | null> {
	const arrayBuffer =
		buffer instanceof Uint8Array ? copyToArrayBuffer(buffer) : buffer;

	const fromPool = await encodeWithPool(arrayBuffer, mime, targetSize, quality);
	if (fromPool) return fromPool;

	return encodeBufferOnMainThread(arrayBuffer, mime, targetSize, quality);
}

async function encodeWithPool(
	buffer: ArrayBuffer,
	mime: string,
	targetSize: number,
	quality: number
): Promise<GeneratedThumbnail | null> {
	const pool = getImageWorkerPool();
	if (!pool.available) return null;

	try {
		const result = await pool.run(buffer, mime, targetSize, quality);
		return {
			data: result.data,
			width: result.width,
			height: result.height,
			extension: 'webp',
		};
	} catch {
		return null;
	}
}

async function encodeOnMainThread(
	app: App,
	file: TFile,
	targetSize: number,
	quality: number
): Promise<GeneratedThumbnail | null> {
	const data = await app.vault.adapter.readBinary(file.path);
	if (!data || data.byteLength === 0) return null;

	const mime =
		MIME_BY_EXTENSION[file.extension.toLowerCase()] ?? 'application/octet-stream';

	return encodeBufferOnMainThread(data, mime, targetSize, quality);
}

async function encodeBufferOnMainThread(
	data: ArrayBuffer,
	mime: string,
	targetSize: number,
	quality: number
): Promise<GeneratedThumbnail | null> {
	const url = URL.createObjectURL(new Blob([data], { type: mime }));

	try {
		const image = await loadImage(url);
		const naturalWidth = image.naturalWidth || 300;
		const naturalHeight = image.naturalHeight || 150;
		const scale = Math.min(1, targetSize / Math.max(naturalWidth, naturalHeight));

		const canvas = activeDocument.createEl('canvas');
		canvas.width = Math.max(1, Math.round(naturalWidth * scale));
		canvas.height = Math.max(1, Math.round(naturalHeight * scale));

		const context = canvas.getContext('2d');
		if (!context) return null;

		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const blob = await canvasToBlob(canvas, quality);

		return {
			data: await blob.arrayBuffer(),
			width: canvas.width,
			height: canvas.height,
			extension: 'webp',
		};
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function copyToArrayBuffer(view: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(view.byteLength);
	copy.set(view);
	return copy.buffer;
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = activeDocument.createEl('img');
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Could not decode image'));
		image.src = url;
	});
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Could not encode the thumbnail'));
				}
			},
			'image/webp',
			quality
		);
	});
}