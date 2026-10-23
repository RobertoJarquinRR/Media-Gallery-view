import { GalleryProcessor } from './types';

export type GalleryProcessorFactory = () => GalleryProcessor;

interface GalleryRegistration {
	type: string;
	extensions: readonly string[];
	factory: GalleryProcessorFactory;
}

export class GalleryRegistry {
	private readonly registrations = new Map<string, GalleryRegistration>();

	register(
		type: string,
		extensions: readonly string[],
		factory: GalleryProcessorFactory
	): void {
		const key = type.toLowerCase();
		if (this.registrations.has(key)) {
			console.warn(`[GalleryRegistry] Overwriting processor for type: ${key}`);
		}
		this.registrations.set(key, { type: key, extensions, factory });
	}

	unregister(type: string): boolean {
		return this.registrations.delete(type.toLowerCase());
	}

	create(type: string): GalleryProcessor | undefined {
		return this.registrations.get(type.toLowerCase())?.factory();
	}

	getExtensions(type: string): readonly string[] | undefined {
		return this.registrations.get(type.toLowerCase())?.extensions;
	}

	getSupportedTypes(): string[] {
		return Array.from(this.registrations.keys());
	}

	destroyAll(): void {
		this.registrations.clear();
	}
}
