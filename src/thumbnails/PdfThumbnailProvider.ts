import { App, TFile } from 'obsidian';
import { openPdf } from './pdfWorker';

export interface GeneratedThumbnail {
	data: ArrayBuffer;
	width: number;
	height: number;
	extension: 'webp' | 'png';
}

export async function generatePdfThumbnail(
	app: App,
	file: TFile,
	targetSize: number
): Promise<GeneratedThumbnail> {
	const data = await app.vault.adapter.readBinary(file.path);
	const loadingTask = openPdf(data);

	try {
		const pdf = await loadingTask.promise;
		const page = await pdf.getPage(1);
		const baseViewport = page.getViewport({ scale: 1 });
		const longestSide = Math.max(baseViewport.width, baseViewport.height);
		const scale = longestSide > targetSize ? targetSize / longestSide : 1;
		const viewport = page.getViewport({ scale });

		const canvas = activeDocument.createEl('canvas');
		canvas.width = Math.max(1, Math.ceil(viewport.width));
		canvas.height = Math.max(1, Math.ceil(viewport.height));

		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Canvas 2D context unavailable');
		}

		await page.render({ canvasContext: context, viewport }).promise;

		const blob = await canvasToBlob(canvas);
		return {
			data: await blob.arrayBuffer(),
			width: canvas.width,
			height: canvas.height,
			extension: blob.type === 'image/png' ? 'png' : 'webp',
		};
	} finally {
		await loadingTask.destroy();
	}
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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
			0.85
		);
	});
}
