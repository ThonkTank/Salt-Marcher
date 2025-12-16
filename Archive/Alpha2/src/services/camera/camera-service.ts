/**
 * Camera Service
 *
 * Manages camera state with subscription pattern.
 * Extends BaseService for consistent subscription pattern.
 * Calls pure functions from utils/render/camera.
 *
 * @module services/camera
 */

import type { CameraState } from '../../utils/render';
import { BaseService } from '../base-service';
import { pan, zoom, resetCamera, DEFAULT_CAMERA_STATE } from '../../utils/render';

// ============================================================================
// CameraService
// ============================================================================

export class CameraService extends BaseService<CameraState> {
	constructor(initialState: CameraState = DEFAULT_CAMERA_STATE) {
		super();
		this.state = { ...initialState };
	}

	// ========================================================================
	// Camera Operations
	// ========================================================================

	/**
	 * Apply pan delta to camera.
	 */
	pan(deltaX: number, deltaY: number): void {
		this.state = pan(this.state, deltaX, deltaY);
		this.notify();
	}

	/**
	 * Apply zoom centered on a point.
	 */
	zoom(delta: number, centerX: number, centerY: number): void {
		this.state = zoom(this.state, delta, centerX, centerY);
		this.notify();
	}

	/**
	 * Reset camera to default state.
	 */
	reset(): void {
		this.state = resetCamera();
		this.notify();
	}

	/**
	 * Set camera state directly.
	 */
	setState(newState: CameraState): void {
		this.state = { ...newState };
		this.notify();
	}
}
