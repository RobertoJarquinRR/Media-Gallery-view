import { GalleryProcessor, GalleryFile, GalleryRenderOptions } from './types';
import { App } from 'obsidian';

export class GalleryRegistry {
	private readonly processors = new Map<string, GalleryProcessor>();

	register(processor: GalleryProcessor): void {
		const key = processor.supportedType.toLowerCase();
		if (this.processors.has(key)) {
			console.warn(`[GalleryRegistry] Overwriting processor for type: ${key}`);
		}
		this.processors.set(key, processor);
	}

	unregister(type: string): boolean {
		return this.processors.delete(type.toLowerCase());
	}

	get(type: string): GalleryProcessor | undefined {
		return this.processors.get(type.toLowerCase());
	}

	getAll(): GalleryProcessor[] {
		return Array.from(this.processors.values());
	}

	getSupportedTypes(): string[] {
		return Array.from(this.processors.keys());
	}

	async process(
		type: string,
		files: GalleryFile[],
		container: HTMLElement,
		app: App,
		options: GalleryRenderOptions
	): Promise<void> {
		const processor = this.get(type);
		if (!processor) {
			const available = this.getSupportedTypes().join(', ');
			throw new Error(
				`No gallery processor registered for type: "${type}". Available: ${available}`
			);
		}
		processor.process(files, container, app, options);
	}

	destroyAll(): void {
		for (const processor of this.processors.values()) {
			processor.destroy?.();
		}
		this.processors.clear();
	}
}