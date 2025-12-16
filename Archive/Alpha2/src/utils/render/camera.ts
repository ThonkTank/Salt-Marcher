/**
 * Camera Utils
 *
 * Pan and zoom controls for map viewing.
 * Pure state management - no DOM access.
 *
 * @module utils/render/camera
 */

import { clamp } from '../common/math';

// ============================================================================
// Types
// ============================================================================

export type CameraState = {
    /** Pan offset in pixels */
    panX: number;
    panY: number;
    /** Zoom level (1.0 = 100%) */
    zoom: number;
};

export type CameraConfig = {
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
};

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CAMERA_STATE: CameraState = {
    panX: 0,
    panY: 0,
    zoom: 1.0,
};

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
    minZoom: 0.25,
    maxZoom: 4.0,
    zoomStep: 0.1,
};

// ============================================================================
// Camera Functions
// ============================================================================

/**
 * Apply pan delta to camera state.
 */
export function pan(state: CameraState, deltaX: number, deltaY: number): CameraState {
    return {
        ...state,
        panX: state.panX + deltaX,
        panY: state.panY + deltaY,
    };
}

/**
 * Apply zoom centered on a point.
 * @param state Current camera state
 * @param delta Zoom delta (positive = zoom in, negative = zoom out)
 * @param centerX Center point X in screen space
 * @param centerY Center point Y in screen space
 * @param config Camera configuration
 */
export function zoom(
    state: CameraState,
    delta: number,
    centerX: number,
    centerY: number,
    config: CameraConfig = DEFAULT_CAMERA_CONFIG
): CameraState {
    const newZoom = clamp(
        state.zoom + delta * config.zoomStep,
        config.minZoom,
        config.maxZoom
    );

    if (newZoom === state.zoom) return state;

    // Adjust pan to keep the center point fixed
    const zoomRatio = newZoom / state.zoom;
    const newPanX = centerX - (centerX - state.panX) * zoomRatio;
    const newPanY = centerY - (centerY - state.panY) * zoomRatio;

    return {
        panX: newPanX,
        panY: newPanY,
        zoom: newZoom,
    };
}

/**
 * Reset camera to default state.
 */
export function resetCamera(): CameraState {
    return { ...DEFAULT_CAMERA_STATE };
}

/**
 * Convert screen coordinates to world coordinates.
 */
export function screenToWorld(
    screenX: number,
    screenY: number,
    state: CameraState
): { x: number; y: number } {
    return {
        x: (screenX - state.panX) / state.zoom,
        y: (screenY - state.panY) / state.zoom,
    };
}

/**
 * Convert world coordinates to screen coordinates.
 */
export function worldToScreen(
    worldX: number,
    worldY: number,
    state: CameraState
): { x: number; y: number } {
    return {
        x: worldX * state.zoom + state.panX,
        y: worldY * state.zoom + state.panY,
    };
}

