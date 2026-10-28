import type { OverlayZoomHandle } from './zoomTypes';

interface Point {
	x: number;
	y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.25;
const WHEEL_FACTOR = 0.0015;

export class ImageZoomController implements OverlayZoomHandle {
	private zoom = MIN_ZOOM;
	private panX = 0;
	private panY = 0;
	private zoomMode = false;
	private onChange: (() => void) | null = null;

	private readonly pointers = new Map<number, Point>();
	private dragStart: Point | null = null;
	private dragPan: Point | null = null;
	private pinchDistance = 0;
	private pinchZoom = MIN_ZOOM;

	constructor(
		private readonly stage: HTMLElement,
		private readonly image: HTMLImageElement
	) {
		this.image.addEventListener('pointerdown', this.handlePointerDown);
		this.image.addEventListener('pointermove', this.handlePointerMove);
		this.image.addEventListener('pointerup', this.handlePointerEnd);
		this.image.addEventListener('pointercancel', this.handlePointerEnd);
	}

	getMinZoom(): number {
		return MIN_ZOOM;
	}

	getMaxZoom(): number {
		return MAX_ZOOM;
	}

	getZoom(): number {
		return this.zoom;
	}

	setOnChange(listener: () => void): void {
		this.onChange = listener;
	}

	setMode(enabled: boolean): void {
		this.zoomMode = enabled;
		this.image.classList.toggle('mg-zoom-mode', enabled);
		if (!enabled) {
			this.clearPointers();
		}
	}

	zoomIn(): void {
		this.applyZoom(this.zoom * ZOOM_STEP);
	}

	zoomOut(): void {
		this.applyZoom(this.zoom / ZOOM_STEP);
	}

	reset(): void {
		this.zoom = MIN_ZOOM;
		this.panX = 0;
		this.panY = 0;
		this.applyTransform();
		this.notify();
	}

	handleWheel(event: WheelEvent): boolean {
		if (!this.zoomMode || event.deltaY === 0) return false;

		const factor = Math.exp(-event.deltaY * WHEEL_FACTOR);
		this.applyZoom(
			this.zoom * factor,
			event.clientX,
			event.clientY
		);
		return true;
	}

	private readonly handlePointerDown = (event: PointerEvent): void => {
		if (!this.zoomMode) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		this.pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});

		if (this.pointers.size === 2) {
			this.startPinch();
			return;
		}

		if (this.pointers.size === 1 && this.zoom > MIN_ZOOM) {
			this.dragStart = { x: event.clientX, y: event.clientY };
			this.dragPan = { x: this.panX, y: this.panY };
			this.image.classList.add('mg-zoom-dragging');
			this.image.setPointerCapture(event.pointerId);
		}
	};

	private readonly handlePointerMove = (event: PointerEvent): void => {
		if (!this.pointers.has(event.pointerId)) return;

		this.pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});

		if (this.pointers.size === 2) {
			event.preventDefault();
			this.updatePinch();
			return;
		}

		if (!this.dragStart || !this.dragPan) return;

		event.preventDefault();
		this.panX = this.dragPan.x + event.clientX - this.dragStart.x;
		this.panY = this.dragPan.y + event.clientY - this.dragStart.y;
		this.clampPan();
		this.applyTransform();
	};

	private readonly handlePointerEnd = (event: PointerEvent): void => {
		this.pointers.delete(event.pointerId);

		if (this.pointers.size < 2) {
			this.pinchDistance = 0;
		}
		if (this.pointers.size === 0) {
			this.dragStart = null;
			this.dragPan = null;
			this.image.classList.remove('mg-zoom-dragging');
			if (this.image.hasPointerCapture(event.pointerId)) {
				this.image.releasePointerCapture(event.pointerId);
			}
		}
	};

	private startPinch(): void {
		const points = [...this.pointers.values()];
		const first = points[0];
		const second = points[1];
		if (!first || !second) return;

		this.dragStart = null;
		this.dragPan = null;
		this.image.classList.remove('mg-zoom-dragging');
		this.pinchDistance = this.distance(first, second);
		this.pinchZoom = this.zoom;
	}

	private updatePinch(): void {
		const points = [...this.pointers.values()];
		const first = points[0];
		const second = points[1];
		if (!first || !second || this.pinchDistance === 0) return;

		const distance = this.distance(first, second);
		if (distance === 0) return;

		this.applyZoom(
			this.pinchZoom * (distance / this.pinchDistance),
			(first.x + second.x) / 2,
			(first.y + second.y) / 2
		);
	}

	private applyZoom(nextZoom: number, clientX?: number, clientY?: number): void {
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
		if (Math.abs(next - this.zoom) < 0.001) return;

		if (clientX !== undefined && clientY !== undefined) {
			const rect = this.stage.getBoundingClientRect();
			const centerX = rect.left + this.image.offsetLeft + this.image.offsetWidth / 2;
			const centerY = rect.top + this.image.offsetTop + this.image.offsetHeight / 2;
			const anchorX = clientX - centerX;
			const anchorY = clientY - centerY;
			const scale = next / this.zoom;

			this.panX = anchorX - (anchorX - this.panX) * scale;
			this.panY = anchorY - (anchorY - this.panY) * scale;
		}

		this.zoom = next;
		this.clampPan();
		this.applyTransform();
		this.notify();
	}

	private clampPan(): void {
		const maxX = Math.max(
			0,
			(this.image.offsetWidth * this.zoom - this.stage.clientWidth) / 2
		);
		const maxY = Math.max(
			0,
			(this.image.offsetHeight * this.zoom - this.stage.clientHeight) / 2
		);

		this.panX = Math.min(maxX, Math.max(-maxX, this.panX));
		this.panY = Math.min(maxY, Math.max(-maxY, this.panY));

		if (this.zoom <= MIN_ZOOM + 0.001) {
			this.panX = 0;
			this.panY = 0;
		}
	}

	private applyTransform(): void {
		this.image.setCssProps({
			'--mg-image-zoom': String(this.zoom),
			'--mg-image-pan-x': `${this.panX}px`,
			'--mg-image-pan-y': `${this.panY}px`,
		});
		this.image.classList.toggle('mg-zoomed', this.zoom > MIN_ZOOM + 0.001);
	}

	private clearPointers(): void {
		this.pointers.clear();
		this.dragStart = null;
		this.dragPan = null;
		this.pinchDistance = 0;
		this.image.classList.remove('mg-zoom-dragging');
	}

	private distance(first: Point, second: Point): number {
		return Math.hypot(first.x - second.x, first.y - second.y);
	}

	private notify(): void {
		this.onChange?.();
	}
}
