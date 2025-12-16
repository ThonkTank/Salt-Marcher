/**
 * Hex Mapper
 *
 * Converts hex tile schemas to render primitives.
 * Pure function: no side effects, no DOM access.
 *
 * @module utils/hex/mapper
 */

import type { AxialCoord, CoordKey, Point, TileData, RenderBatch, PolygonPrimitive } from '../../schemas';
import { axialToPixel, getHexCorners } from './geometry';

// ============================================================================
// Types
// ============================================================================

export type HexMapperOptions = {
    center: AxialCoord;
    hexSize: number;
    padding: number;
    colorFn: (tile: TileData, coord: AxialCoord) => string;
    strokeColor?: string;
    strokeWidth?: number;
};

// ============================================================================
// Canvas/SVG Utilities
// ============================================================================

/**
 * Convert Axial coordinate to SVG canvas pixel position.
 */
export function axialToCanvasPixel(
    coord: AxialCoord,
    size: number,
    base: AxialCoord,
    padding: number
): Point {
    const offset = axialToPixel({ q: coord.q - base.q, r: coord.r - base.r }, size);
    return { x: padding + offset.x, y: padding + offset.y + size };
}

/**
 * Calculate hex width (flat-to-flat distance).
 */
export function hexWidth(radius: number): number {
    return Math.sqrt(3) * radius;
}

/**
 * Calculate hex height (point-to-point distance).
 */
export function hexHeight(radius: number): number {
    return 2 * radius;
}

/**
 * Generate SVG polygon points string for a pointy-top hex.
 * Uses getHexCorners internally for consistent corner calculation.
 */
export function hexPolygonPoints(cx: number, cy: number, radius: number): string {
    const corners = getHexCorners(cx, cy, radius);
    return corners.map(p => `${p.x},${p.y}`).join(" ");
}

// ============================================================================
// Mapper
// ============================================================================

/**
 * Convert hex tiles to a render batch.
 */
export function mapHexTilesToBatch(
    tiles: Map<CoordKey, TileData>,
    coords: AxialCoord[],
    options: HexMapperOptions
): RenderBatch {
    const { center, hexSize, padding, colorFn, strokeColor, strokeWidth } = options;

    // Calculate canvas dimensions
    const { width, height } = calculateCanvasSize(coords, hexSize, padding, center);

    // Map tiles to polygons
    const polygons: PolygonPrimitive[] = [];

    for (const coord of coords) {
        const key = `${coord.q},${coord.r}` as CoordKey;
        const tile = tiles.get(key);

        if (!tile) continue;

        const pixel = axialToCanvasPixel(coord, hexSize, center, padding);
        const points = hexPolygonPoints(pixel.x, pixel.y, hexSize);
        const fill = colorFn(tile, coord);

        polygons.push({
            points,
            fill,
            stroke: strokeColor,
            strokeWidth,
        });
    }

    return { width, height, polygons };
}

/**
 * Calculate canvas size to fit all coordinates.
 */
function calculateCanvasSize(
    coords: AxialCoord[],
    hexSize: number,
    padding: number,
    center: AxialCoord
): { width: number; height: number } {
    if (coords.length === 0) {
        return { width: padding * 2, height: padding * 2 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const coord of coords) {
        const pixel = axialToCanvasPixel(coord, hexSize, center, padding);
        minX = Math.min(minX, pixel.x);
        maxX = Math.max(maxX, pixel.x);
        minY = Math.min(minY, pixel.y);
        maxY = Math.max(maxY, pixel.y);
    }

    const w = hexWidth(hexSize);
    const h = hexHeight(hexSize);

    return {
        width: maxX - minX + w + padding * 2,
        height: maxY - minY + h + padding * 2,
    };
}
