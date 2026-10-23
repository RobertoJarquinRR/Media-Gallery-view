import { IMAGE_WORKER_SOURCE } from './imageWorkerSource';

export interface ImageWorkerResult {
	data: ArrayBuffer;
	width: number;
	height: number;
}

interface PendingJob {
	buffer: ArrayBuffer;
	mime: string;
	maxSize: number;
	quality: number;
	resolve: (result: ImageWorkerResult) => void;
	reject: (error: Error) => void;
}

const MAX_WORKERS = 4;

export class ImageWorkerPool {
	private readonly workers: Worker[] = [];
	private readonly idle: Worker[] = [];
	private readonly jobs: PendingJob[] = [];
	private readonly inFlight = new Map<number, PendingJob>();
	private readonly urls: string[] = [];
	private nextId = 1;
	private unavailable = false;

	constructor(size: number) {
		const count = Math.max(1, Math.min(MAX_WORKERS, Math.floor(size) || 1));

		try {
			for (let index = 0; index < count; index += 1) {
				const url = URL.createObjectURL(
					new Blob([IMAGE_WORKER_SOURCE], { type: 'text/javascript' })
				);
				const worker = new Worker(url);
				worker.onmessage = (event: MessageEvent) =>
					this.handleMessage(worker, event.data);
				worker.onerror = () => this.disable();
				this.urls.push(url);
				this.workers.push(worker);
				this.idle.push(worker);
			}
		} catch {
			this.disable();
		}
	}

	get available(): boolean {
		return !this.unavailable && this.workers.length > 0;
	}

	run(
		buffer: ArrayBuffer,
		mime: string,
		maxSize: number,
		quality: number
	): Promise<ImageWorkerResult> {
		if (!this.available) {
			return Promise.reject(new Error('Image worker pool unavailable'));
		}

		return new Promise<ImageWorkerResult>((resolve, reject) => {
			this.jobs.push({ buffer, mime, maxSize, quality, resolve, reject });
			this.drain();
		});
	}

	dispose(): void {
		for (const worker of this.workers) {
			worker.terminate();
		}
		this.workers.length = 0;
		this.idle.length = 0;

		for (const url of this.urls) {
			URL.revokeObjectURL(url);
		}
		this.urls.length = 0;

		this.failPending(new Error('Image worker pool disposed'));
	}

	private drain(): void {
		while (this.idle.length > 0 && this.jobs.length > 0) {
			const worker = this.idle.pop();
			const job = this.jobs.shift();
			if (!worker || !job) return;

			const id = this.nextId;
			this.nextId += 1;
			this.inFlight.set(id, job);

			worker.postMessage(
				{
					id,
					buffer: job.buffer,
					mime: job.mime,
					maxSize: job.maxSize,
					quality: job.quality,
				},
				[job.buffer]
			);
		}
	}

	private handleMessage(worker: Worker, data: unknown): void {
		const message = data as {
			id?: number;
			ok?: boolean;
			buffer?: ArrayBuffer;
			width?: number;
			height?: number;
			error?: string;
		};

		const job = message.id !== undefined ? this.inFlight.get(message.id) : undefined;
		if (!job || !message.id) return;

		this.inFlight.delete(message.id);
		this.idle.push(worker);

		if (message.ok && message.buffer) {
			job.resolve({
				data: message.buffer,
				width: message.width ?? 0,
				height: message.height ?? 0,
			});
		} else {
			job.reject(new Error(message.error ?? 'Image worker failed'));
		}

		this.drain();
	}

	private disable(): void {
		this.unavailable = true;

		for (const worker of this.workers) {
			worker.terminate();
		}
		this.workers.length = 0;
		this.idle.length = 0;

		for (const url of this.urls) {
			URL.revokeObjectURL(url);
		}
		this.urls.length = 0;

		this.failPending(new Error('Image worker pool unavailable'));
	}

	private failPending(error: Error): void {
		for (const job of this.inFlight.values()) {
			job.reject(error);
		}
		this.inFlight.clear();

		for (const job of this.jobs.splice(0, this.jobs.length)) {
			job.reject(error);
		}
	}
}

let sharedPool: ImageWorkerPool | null = null;

export function getImageWorkerPool(): ImageWorkerPool {
	if (!sharedPool) {
		const cores =
			typeof navigator !== 'undefined' && navigator.hardwareConcurrency
				? navigator.hardwareConcurrency
				: 4;
		sharedPool = new ImageWorkerPool(Math.max(2, Math.min(MAX_WORKERS, cores - 1)));
	}
	return sharedPool;
}

export function disposeImageWorkerPool(): void {
	sharedPool?.dispose();
	sharedPool = null;
}