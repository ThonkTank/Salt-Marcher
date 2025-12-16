/**
 * Pan State Utility
 *
 * Shared state management for map panning interactions.
 * Encapsulates pan tracking logic used across map views.
 *
 * @module adapters/shared/pan-state
 */

/**
 * Pan delta result from updatePan.
 */
export type PanDelta = {
	deltaX: number;
	deltaY: number;
};

/**
 * Manages pan state for map interactions.
 * Tracks whether panning is active and calculates deltas.
 */
export class PanState {
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;

	/**
	 * Start panning from a mouse position.
	 */
	startPan(clientX: number, clientY: number): void {
		this.isPanning = true;
		this.lastX = clientX;
		this.lastY = clientY;
	}

	/**
	 * Update pan position and return delta.
	 * Returns null if not currently panning.
	 */
	updatePan(clientX: number, clientY: number): PanDelta | null {
		if (!this.isPanning) {
			return null;
		}

		const deltaX = clientX - this.lastX;
		const deltaY = clientY - this.lastY;
		this.lastX = clientX;
		this.lastY = clientY;

		return { deltaX, deltaY };
	}

	/**
	 * End panning.
	 */
	endPan(): void {
		this.isPanning = false;
	}

	/**
	 * Check if currently panning.
	 */
	get active(): boolean {
		return this.isPanning;
	}
}
