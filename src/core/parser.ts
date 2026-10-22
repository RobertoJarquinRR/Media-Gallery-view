import { ParsedGallerySource, GalleryConfig } from './types';

const PATH_KEY = 'path:';
const TYPE_KEY = 'type:';

export function parseGallerySource(source: string): ParsedGallerySource {
	const lines = source.split(/\r?\n/);
	const config: GalleryConfig = { path: '', type: '' };

	for (const line of lines) {
		const trimmed = line.trim();
		const lower = trimmed.toLowerCase();

		if (lower.startsWith(PATH_KEY)) {
			const value = trimmed.substring(PATH_KEY.length).trim();
			config.path = value;
		} else if (lower.startsWith(TYPE_KEY)) {
			const value = trimmed.substring(TYPE_KEY.length).trim().toLowerCase();
			config.type = value;
		}
	}

	return { config, rawSource: source };
}

export function validateConfig(config: GalleryConfig): string[] {
	const errors: string[] = [];

	if (!config.path || config.path.trim() === '') {
		errors.push('Path is required');
	}

	return errors;
}