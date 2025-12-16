/**
 * Hex Hit Testing
 *
 * Pure hit-detection algorithms for hex grid interaction.
 *
 * @module utils/hex/hit-testing
 */

import type { AxialCoord, CoordKey, Point } from '../../schemas';
import type { CameraState } from '../render/camera';
import { screenToWorld } from '../render/camera';
import { pixelToAxial, getHexCorners, coordToKey } from './geometry';
import { axialToCanvasPixel } from './mapper';
import { euclideanDistance, distanceSquared } from '../common/math';

// ============================================================================
// Distance Utilities
// ============================================================================

/**
 * Calculate the shortest distance from a point to a line segment.
 */
export function distanceToLineSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
): number {
    const dx = px - x1, dy = py - y1;
    const segmentDx = x2 - x1, segmentDy = y2 - y1;
    const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy;

    if (segmentLengthSquared === 0) return euclideanDistance({ x: px, y: py }, { x: x1, y: y1 });

    const t = Math.max(0, Math.min(1, (dx * segmentDx + dy * segmentDy) / segmentLengthSquared));
    const closestX = x1 + t * segmentDx;
    const closestY = y1 + t * segmentDy;
    return euclideanDistance({ x: px, y: py }, { x: closestX, y: closestY });
}

// ============================================================================
// Corner Hit Testing
// ============================================================================

/**
 * Find the nearest corner from a list of corner positions.
 * Returns the index of the nearest corner, or null if none within threshold.
 */
export function findNearestCornerIndex(
    mouseX: number,
    mouseY: number,
    corners: Point[],
    threshold: number = 30
): number | null {
    let nearestIndex: number | null = null;
    const thresholdSquared = threshold * threshold;
    let nearestDistanceSquared = thresholdSquared;
    const mousePoint = { x: mouseX, y: mouseY };

    for (let i = 0; i < corners.length; i++) {
        const distSq = distanceSquared(mousePoint, corners[i]);
        if (distSq < nearestDistanceSquared) {
            nearestDistanceSquared = distSq;
            nearestIndex = i;
        }
    }
    return nearestIndex;
}

// ============================================================================
// Edge Hit Testing
// ============================================================================

/**
 * Find which edge is near a given point.
 * Returns [startCornerIndex, endCornerIndex] or null if none within threshold.
 * Assumes corners array represents a closed polygon.
 */
export function findEdgeNearPoint(
    mouseX: number,
    mouseY: number,
    corners: Point[],
    threshold: number = 15
): [number, number] | null {
    let nearestEdge: [number, number] | null = null;
    let nearestDistance = threshold;

    for (let i = 0; i < corners.length; i++) {
        const nextI = (i + 1) % corners.length;
        const distance = distanceToLineSegment(
            mouseX, mouseY,
            corners[i].x, corners[i].y,
            corners[nextI].x, corners[nextI].y
        );
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestEdge = [i, nextI];
        }
    }
    return nearestEdge;
}

// ============================================================================
// Polygon Hit Testing
// ============================================================================

/**
 * Check if a point is inside a polygon using ray casting algorithm.
 */
export function isPointInPolygon(x: number, y: number, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// ============================================================================
// High-Level Hex Hit Testing (with camera support)
// ============================================================================

export type HitTestOptions = {
    center: AxialCoord;
    hexSize: number;
    padding: number;
    camera?: CameraState;
};

/**
 * Find which hex coordinate is at a given pixel position.
 * Accounts for camera pan and zoom if provided.
 */
export function hitTestHex(
    mouseX: number,
    mouseY: number,
    options: HitTestOptions
): AxialCoord {
    const { center, hexSize, padding, camera } = options;

    // Transform screen coordinates to world coordinates if camera is present
    let worldX = mouseX;
    let worldY = mouseY;
    if (camera) {
        const world = screenToWorld(mouseX, mouseY, camera);
        worldX = world.x;
        worldY = world.y;
    }

    // Convert world position to hex coordinate
    const adjustedX = worldX - padding;
    const adjustedY = worldY - padding - hexSize;
    const coord = pixelToAxial(adjustedX, adjustedY, hexSize);
    return { q: coord.q + center.q, r: coord.r + center.r };
}

/**
 * Find the nearest corner to a mouse position for a specific hex.
 * Returns the corner index (0-5) or null if none within threshold.
 */
export function hitTestHexCorner(
    mouseX: number,
    mouseY: number,
    hexCoord: AxialCoord,
    options: Pick<HitTestOptions, 'center' | 'hexSize' | 'padding'>,
    threshold: number = 15
): number | null {
    const { center, hexSize, padding } = options;
    const pixel = axialToCanvasPixel(hexCoord, hexSize, center, padding);
    const corners = getHexCorners(pixel.x, pixel.y, hexSize);
    return findNearestCornerIndex(mouseX, mouseY, corners, threshold);
}

/**
 * Find the nearest edge to a mouse position for a specific hex.
 * Returns [startCornerIndex, endCornerIndex] or null if none within threshold.
 */
export function hitTestHexEdge(
    mouseX: number,
    mouseY: number,
    hexCoord: AxialCoord,
    options: Pick<HitTestOptions, 'center' | 'hexSize' | 'padding'>,
    threshold: number = 15
): [number, number] | null {
    const { center, hexSize, padding } = options;
    const pixel = axialToCanvasPixel(hexCoord, hexSize, center, padding);
    const corners = getHexCorners(pixel.x, pixel.y, hexSize);
    return findEdgeNearPoint(mouseX, mouseY, corners, threshold);
}

/**
 * Check if a point is inside a specific hex.
 */
export function isPointInHex(
    mouseX: number,
    mouseY: number,
    hexCoord: AxialCoord,
    options: Pick<HitTestOptions, 'center' | 'hexSize' | 'padding'>
): boolean {
    const { center, hexSize, padding } = options;
    const pixel = axialToCanvasPixel(hexCoord, hexSize, center, padding);
    const corners = getHexCorners(pixel.x, pixel.y, hexSize);
    return isPointInPolygon(mouseX, mouseY, corners);
}

// ============================================================================
// Event-Based Hit Testing (for Views)
// ============================================================================

/**
 * Get mouse position relative to a container element.
 * Use this to extract coordinates from MouseEvent for hit testing.
 */
export function getMousePosition(e: MouseEvent, container: HTMLElement): Point {
    const rect = container.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

/**
 * Hit test a hex from a mouse event with tile validation.
 * Combines mouse position extraction, hit testing, and tile existence check.
 *
 * @param e - The mouse event
 * @param container - The container element for mouse position calculation
 * @param options - Hit test options (center, hexSize, padding, camera)
 * @param tiles - Map of valid tile coordinates to check against
 * @returns The hex coordinate if valid, null otherwise
 */
export function hitTestHexFromEvent(
    e: MouseEvent,
    container: HTMLElement,
    options: HitTestOptions,
    tiles: Map<CoordKey, unknown>
): AxialCoord | null {
    const { x: mouseX, y: mouseY } = getMousePosition(e, container);
    const coord = hitTestHex(mouseX, mouseY, options);
    const key = coordToKey(coord);
    return tiles.has(key) ? coord : null;
}
