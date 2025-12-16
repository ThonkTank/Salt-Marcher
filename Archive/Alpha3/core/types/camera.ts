/**
 * Camera Types
 *
 * Shared camera/viewport state types used by Cartographer and SessionRunner.
 */

// ═══════════════════════════════════════════════════════════════
// Camera State
// ═══════════════════════════════════════════════════════════════

/**
 * Camera/viewport state for pan and zoom
 */
export interface CameraState {
  /** Pan offset X (pixels) */
  panX: number;

  /** Pan offset Y (pixels) */
  panY: number;

  /** Zoom level (0.25 - 4.0) */
  zoom: number;
}

/**
 * Default camera state (centered, no zoom)
 */
export const DEFAULT_CAMERA: CameraState = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

// ═══════════════════════════════════════════════════════════════
// Camera Constants
// ═══════════════════════════════════════════════════════════════

/** Minimum zoom level */
export const MIN_ZOOM = 0.25;

/** Maximum zoom level */
export const MAX_ZOOM = 4.0;

/** Zoom sensitivity for wheel events */
export const ZOOM_SENSITIVITY = 0.001;
