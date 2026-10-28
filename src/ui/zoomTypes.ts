export interface OverlayZoomHandle {
	getMinZoom(): number;
	getMaxZoom(): number;
	getZoom(): number;
	zoomIn(): void;
	zoomOut(): void;
	reset(): void;
	setMode(enabled: boolean): void;
	setOnChange?(listener: () => void): void;
	handleWheel?(event: WheelEvent): boolean;
}
