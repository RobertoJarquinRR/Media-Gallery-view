export const IMAGE_WORKER_SOURCE = String.raw`
self.onmessage = async (event) => {
	const data = event.data || {};
	const id = data.id;

	try {
		const blob = new Blob([data.buffer], { type: data.mime });
		const maxSize = data.maxSize || 384;
		const quality = typeof data.quality === 'number' ? data.quality : 0.7;

		let bitmap = null;
		try {
			bitmap = await decodeResized(blob, data.mime, maxSize);
		} catch (error) {
			bitmap = await createImageBitmap(blob);
		}

		const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = new OffscreenCanvas(width, height);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas 2D context unavailable');

		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, width, height);
		if (typeof bitmap.close === 'function') bitmap.close();

		const out = await canvas.convertToBlob({ type: 'image/webp', quality });
		const buffer = await out.arrayBuffer();
		self.postMessage({ id, ok: true, buffer, width, height }, [buffer]);
	} catch (error) {
		self.postMessage({
			id,
			ok: false,
			error: (error && error.message) || String(error)
		});
	}
};

async function decodeResized(blob, mime, maxSize) {
	if (typeof ImageDecoder === 'undefined') throw new Error('ImageDecoder unavailable');

	const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: mime });
	try {
		await decoder.tracks.ready;
	} catch (error) {
		if (typeof decoder.close === 'function') decoder.close();
		throw error;
	}

	const track = decoder.tracks.selectedTrack;
	const width = track && track.codedWidth ? track.codedWidth : 0;
	const height = track && track.codedHeight ? track.codedHeight : 0;
	if (typeof decoder.close === 'function') decoder.close();

	if (!width || !height) throw new Error('Unknown image dimensions');

	const scale = Math.min(1, maxSize / Math.max(width, height));
	if (scale >= 1) return createImageBitmap(blob);

	return createImageBitmap(blob, {
		resizeWidth: Math.max(1, Math.round(width * scale)),
		resizeHeight: Math.max(1, Math.round(height * scale)),
		resizeQuality: 'high'
	});
}
`;