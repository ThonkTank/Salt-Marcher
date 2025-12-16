/**
 * Hit Testing Utilities
 *
 * Provides screen-to-hex coordinate conversion with camera transforms.
 * Used by Cartographer and SessionRunner for map interactions.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import {
  pixelToHex,
  coordToKey,
  type CoordKey,
} from '@core/schemas/hex-geometry';
import {
  type CameraState,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SENSITIVITY,
} from '@core/types/camera';

// Re-export CameraState for convenience
export type { CameraState } from '@core/types/camera';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Hit test result
 */
export interface HitTestResult {
  coord: HexCoordinate;
  key: CoordKey;
  worldX: number;
  worldY: number;
}

// ═══════════════════════════════════════════════════════════════
// Coordinate Transformation
// ═══════════════════════════════════════════════════════════════

/**
 * Convert screen coordinates to world coordinates
 *
 * @param screenX - X position in screen/viewport space
 * @param screenY - Y position in screen/viewport space
 * @param camera - Current camera state
 * @param viewportCenterX - Center X of the viewport
 * @param viewportCenterY - Center Y of the viewport
 * @returns World coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: CameraState,
  viewportCenterX: number,
  viewportCenterY: number
): { x: number; y: number } {
  // Reverse the camera transform:
  // Screen = (World * zoom) + pan + viewportCenter
  // World = (Screen - viewportCenter - pan) / zoom
  const x = (screenX - viewportCenterX - camera.panX) / camera.zoom;
  const y = (screenY - viewportCenterY - camera.panY) / camera.zoom;

  return { x, y };
}

/**
 * Convert world coordinates to screen coordinates
 *
 * @param worldX - X position in world space
 * @param worldY - Y position in world space
 * @param camera - Current camera state
 * @param viewportCenterX - Center X of the viewport
 * @param viewportCenterY - Center Y of the viewport
 * @returns Screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: CameraState,
  viewportCenterX: number,
  viewportCenterY: number
): { x: number; y: number } {
  const x = worldX * camera.zoom + camera.panX + viewportCenterX;
  const y = worldY * camera.zoom + camera.panY + viewportCenterY;

  return { x, y };
}

// ═══════════════════════════════════════════════════════════════
// Hit Testing
// ═══════════════════════════════════════════════════════════════

/**
 * Hit test: Convert screen position to hex coordinate
 *
 * @param screenX - X position in screen space (e.g., from mouse event)
 * @param screenY - Y position in screen space
 * @param camera - Current camera state
 * @param hexSize - Size of hexes (center to corner)
 * @param viewportCenterX - Center X of the viewport
 * @param viewportCenterY - Center Y of the viewport
 * @returns Hit test result with hex coordinate
 */
export function hitTestHex(
  screenX: number,
  screenY: number,
  camera: CameraState,
  hexSize: number,
  viewportCenterX: number,
  viewportCenterY: number
): HitTestResult {
  const { x, y } = screenToWorld(
    screenX,
    screenY,
    camera,
    viewportCenterX,
    viewportCenterY
  );

  const coord = pixelToHex(x, y, hexSize);

  return {
    coord,
    key: coordToKey(coord),
    worldX: x,
    worldY: y,
  };
}

/**
 * Hit test with bounds checking
 *
 * @param screenX - X position in screen space
 * @param screenY - Y position in screen space
 * @param camera - Current camera state
 * @param hexSize - Size of hexes
 * @param viewportCenterX - Center X of the viewport
 * @param viewportCenterY - Center Y of the viewport
 * @param validKeys - Set of valid tile keys (for bounds checking)
 * @returns Hit test result or null if outside map bounds
 */
export function hitTestHexBounded(
  screenX: number,
  screenY: number,
  camera: CameraState,
  hexSize: number,
  viewportCenterX: number,
  viewportCenterY: number,
  validKeys: Set<CoordKey>
): HitTestResult | null {
  const result = hitTestHex(
    screenX,
    screenY,
    camera,
    hexSize,
    viewportCenterX,
    viewportCenterY
  );

  return validKeys.has(result.key) ? result : null;
}

// ═══════════════════════════════════════════════════════════════
// Mouse Event Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Get mouse position relative to an element
 *
 * @param event - Mouse event
 * @param element - Target element
 * @returns Position relative to element's top-left corner
 */
export function getMousePosition(
  event: MouseEvent,
  element: Element
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Get touch position relative to an element
 *
 * @param touch - Touch object
 * @param element - Target element
 * @returns Position relative to element's top-left corner
 */
export function getTouchPosition(
  touch: Touch,
  element: Element
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

// ═══════════════════════════════════════════════════════════════
// Zoom Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate new camera position after zooming at a specific point
 * Keeps the point under the cursor stationary
 *
 * @param camera - Current camera state
 * @param newZoom - New zoom level
 * @param anchorScreenX - X position to zoom around (screen space)
 * @param anchorScreenY - Y position to zoom around (screen space)
 * @param viewportCenterX - Center X of the viewport
 * @param viewportCenterY - Center Y of the viewport
 * @returns New camera state
 */
export function zoomAtPoint(
  camera: CameraState,
  newZoom: number,
  anchorScreenX: number,
  anchorScreenY: number,
  viewportCenterX: number,
  viewportCenterY: number
): CameraState {
  // Get the world position under the cursor
  const { x: worldX, y: worldY } = screenToWorld(
    anchorScreenX,
    anchorScreenY,
    camera,
    viewportCenterX,
    viewportCenterY
  );

  // Calculate new pan to keep the world position under the cursor
  const newPanX = anchorScreenX - viewportCenterX - worldX * newZoom;
  const newPanY = anchorScreenY - viewportCenterY - worldY * newZoom;

  return {
    panX: newPanX,
    panY: newPanY,
    zoom: newZoom,
  };
}

/**
 * Clamp zoom level to valid range
 *
 * @param zoom - Zoom level to clamp
 * @param minZoom - Minimum zoom (default from constants)
 * @param maxZoom - Maximum zoom (default from constants)
 * @returns Clamped zoom level
 */
export function clampZoom(
  zoom: number,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM
): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Calculate zoom change from wheel delta
 *
 * @param delta - Wheel delta (positive = zoom out, negative = zoom in)
 * @param currentZoom - Current zoom level
 * @param sensitivity - Zoom sensitivity (default from constants)
 * @returns New zoom level (unclamped)
 */
export function calculateWheelZoom(
  delta: number,
  currentZoom: number,
  sensitivity = ZOOM_SENSITIVITY
): number {
  // Exponential zoom for smooth feel
  const factor = 1 - delta * sensitivity;
  return currentZoom * factor;
}
