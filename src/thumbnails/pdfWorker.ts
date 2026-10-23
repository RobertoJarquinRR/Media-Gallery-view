import {
	getDocument,
	GlobalWorkerOptions,
	PDFWorker,
} from 'pdfjs-dist';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs';

let workerUrl: string | null = null;
let rawWorker: Worker | null = null;
let sharedWorker: PDFWorker | null = null;

export function openPdf(data: ArrayBuffer): PDFDocumentLoadingTask {
	const worker = getSharedWorker();

	if (worker) {
		return getDocument({
			data,
			worker,
			useSystemFonts: true,
			isEvalSupported: false,
			verbosity: 0,
		});
	}

	configurePdfWorker();
	return getDocument({
		data,
		useSystemFonts: true,
		isEvalSupported: false,
		verbosity: 0,
	});
}

export function disposePdfWorker(): void {
	sharedWorker?.destroy();
	sharedWorker = null;

	rawWorker?.terminate();
	rawWorker = null;

	if (workerUrl) {
		URL.revokeObjectURL(workerUrl);
		workerUrl = null;
	}

	GlobalWorkerOptions.workerSrc = '';
}

function getSharedWorker(): PDFWorker | null {
	if (sharedWorker) return sharedWorker;

	try {
		rawWorker = new Worker(ensureWorkerUrl(), { type: 'module' });
		sharedWorker = PDFWorker.fromPort({
			port: rawWorker,
			verbosity: 0,
		}) as PDFWorker;
		return sharedWorker;
	} catch (error) {
		console.error('[MediaGallery] Could not start the PDF worker', error);
		rawWorker = null;
		return null;
	}
}

function configurePdfWorker(): void {
	GlobalWorkerOptions.workerSrc = ensureWorkerUrl();
}

function ensureWorkerUrl(): string {
	if (workerUrl) return workerUrl;

	const blob = new Blob([workerSource], { type: 'text/javascript' });
	workerUrl = URL.createObjectURL(blob);
	return workerUrl;
}
