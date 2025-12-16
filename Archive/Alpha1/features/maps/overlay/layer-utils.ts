// src/features/maps/overlay/layer-utils.ts
// Shared utility functions for overlay layers
//
// Provides common helpers for:
// - Coordinate normalization and bounds checking
// - Opacity calculation (deviation-based, severity-based)
// - Color/string validation
// - Coordinate generation from tile data
//
// CONSOLIDATED: Merged from layer-utils.ts, layer-helpers.ts, overlay-coords.ts

import { coordsInRadius } from "@geometry";
import type { HexCoord } from "../rendering/rendering-types";
import type { TileData } from "../data/tile-repository";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * SVG namespace constant used by all SVG-based overlay layers
 */
export const SVG_NS = "http://www.w3.org/2000/svg";

// =============================================================================
// COORDINATE NORMALIZATION
// =============================================================================

/**
 * Normalize coordinate for consistent handling across overlay layers.
 * Validates that r and c are integers and returns a clean HexCoord object.
 *
 * @param coord - Coordinate to normalize (may be undefined/null)
 * @returns Normalized coordinate, or null if invalid
 *
 * @example
 * ```typescript
 * const coord = normalizeCoord({ q: 5.0, r: 10.0 }); // { q: 5, r: 10 }
 * const invalid = normalizeCoord({ q: NaN, r: 5 }); // null
 * ```
 */
export function normalizeCoord(coord: HexCoord | undefined | null): HexCoord | null {
    if (!coord) return null;
    const q = Number(coord.q);
    const r = Number(coord.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
    return { q, r };
}

// =============================================================================
// OPACITY UTILITIES
// =============================================================================

/**
 * Clamp opacity to valid CSS range [0, 1].
 * Ensures opacity values are always valid for rendering.
 *
 * @param opacity - Opacity value to clamp
 * @returns Opacity clamped to [0, 1]
 *
 * @example
 * ```typescript
 * clampOpacity(1.5); // 1.0
 * clampOpacity(-0.2); // 0.0
 * clampOpacity(0.5); // 0.5
 * ```
 */
export function clampOpacity(opacity: number): number {
    return Math.max(0, Math.min(1, opacity));
}

/**
 * Calculate opacity based on value deviation from baseline.
 * Useful for visualizing data where deviation from a baseline is significant.
 *
 * The opacity scales linearly with the absolute deviation from baseline,
 * clamped between minOpacity and maxOpacity.
 *
 * @param value - Current value
 * @param baseline - Baseline value (e.g., sea level, average temperature)
 * @param maxDeviation - Maximum expected deviation (for scaling)
 * @param minOpacity - Minimum opacity (default: 0.2)
 * @param maxOpacity - Maximum opacity (default: 0.6)
 * @returns Opacity value in [minOpacity, maxOpacity]
 *
 * @example
 * ```typescript
 * // Elevation: sea level = 0, max deviation = 3000m
 * deviationOpacity(1500, 0, 3000); // 0.4 (50% deviation)
 * deviationOpacity(3000, 0, 3000); // 0.6 (100% deviation)
 * deviationOpacity(0, 0, 3000);    // 0.2 (no deviation)
 * ```
 */
export function deviationOpacity(
    value: number,
    baseline: number,
    maxDeviation: number,
    minOpacity: number = 0.2,
    maxOpacity: number = 0.6
): number {
    const deviation = Math.abs(value - baseline);
    const ratio = Math.min(deviation / maxDeviation, 1.0);
    const opacity = minOpacity + (ratio * (maxOpacity - minOpacity));
    return clampOpacity(opacity);
}

/**
 * Calculate opacity based on severity/intensity value.
 * Maps a normalized severity value [0, 1] to an opacity range.
 *
 * @param severity - Severity value in [0, 1]
 * @param minOpacity - Minimum opacity (default: 0.4)
 * @param maxOpacity - Maximum opacity (default: 0.8)
 * @returns Opacity value in [minOpacity, maxOpacity]
 *
 * @example
 * ```typescript
 * // Weather severity
 * severityOpacity(0.0); // 0.4 (mild)
 * severityOpacity(0.5); // 0.6 (moderate)
 * severityOpacity(1.0); // 0.8 (severe)
 * ```
 */
export function severityOpacity(
    severity: number,
    minOpacity: number = 0.4,
    maxOpacity: number = 0.8
): number {
    const clamped = clampOpacity(severity);
    const opacity = minOpacity + (clamped * (maxOpacity - minOpacity));
    return clampOpacity(opacity);
}

// =============================================================================
// STRING/COLOR NORMALIZATION
// =============================================================================

/**
 * Normalize color string to valid CSS format.
 * Trims whitespace and returns fallback if invalid.
 *
 * @param color - Color string to normalize (may be undefined)
 * @param fallback - Fallback color if invalid
 * @returns Normalized color string
 *
 * @example
 * ```typescript
 * normalizeColor("  #FF0000  ", "#000000"); // "#FF0000"
 * normalizeColor("", "#000000"); // "#000000"
 * normalizeColor(undefined, "#000000"); // "#000000"
 * ```
 */
export function normalizeColor(color: string | undefined, fallback: string): string {
    if (!color) return fallback;
    const trimmed = color.trim();
    if (!trimmed) return fallback;
    return trimmed;
}

/**
 * Normalize string by trimming whitespace.
 * Returns empty string if input is invalid.
 *
 * @param str - String to normalize (may be undefined/null)
 * @returns Normalized string (never null/undefined)
 *
 * @example
 * ```typescript
 * normalizeString("  hello  "); // "hello"
 * normalizeString(undefined); // ""
 * normalizeString(null); // ""
 * ```
 */
export function normalizeString(str: string | undefined | null): string {
    return typeof str === "string" ? str.trim() : "";
}

// =============================================================================
// VIEWPORT BOUNDS
// =============================================================================

/**
 * Defines the rectangular bounds in hex coordinate space.
 */
export interface ViewportBounds {
    /** Minimum row (inclusive) */
    minR: number;
    /** Maximum row (inclusive) */
    maxR: number;
    /** Minimum q coordinate (inclusive) */
    minQ: number;
    /** Maximum q coordinate (inclusive) */
    maxQ: number;
}

/**
 * Calculate viewport bounds from an array of coordinates.
 * Finds the minimum and maximum row/column values.
 *
 * @param coords - Array of hex coordinates
 * @returns Bounds containing all coordinates, or null if array is empty
 *
 * @example
 * ```typescript
 * const coords = [{ q: 0, r: 0 }, { q: 10, r: 5 }, { q: 3, r: -2 }];
 * const bounds = calculateBounds(coords);
 * // { minR: -2, maxR: 5, minQ: 0, maxQ: 10 }
 * ```
 */
export function calculateBounds(
    coords: readonly HexCoord[]
): ViewportBounds | null {
    if (coords.length === 0) {
        return null;
    }

    let minR = coords[0].r;
    let maxR = coords[0].r;
    let minQ = coords[0].q;
    let maxQ = coords[0].q;

    for (const coord of coords) {
        if (coord.r < minR) minR = coord.r;
        if (coord.r > maxR) maxR = coord.r;
        if (coord.q < minQ) minQ = coord.q;
        if (coord.q > maxQ) maxQ = coord.q;
    }

    return { minR, maxR, minQ, maxQ };
}

/**
 * Check if a coordinate is within viewport bounds.
 *
 * @param coord - Hex coordinate to test
 * @param bounds - Viewport bounds to test against
 * @returns true if coordinate is within bounds (inclusive)
 *
 * @example
 * ```typescript
 * const bounds = { minR: 0, maxR: 10, minQ: 0, maxQ: 10 };
 * coordInBounds({ q: 5, r: 5 }, bounds); // true
 * coordInBounds({ q: 5, r: 15 }, bounds); // false
 * ```
 */
export function coordInBounds(
    coord: HexCoord,
    bounds: ViewportBounds
): boolean {
    return (
        coord.r >= bounds.minR &&
        coord.r <= bounds.maxR &&
        coord.q >= bounds.minQ &&
        coord.q <= bounds.maxQ
    );
}

// =============================================================================
// COORDINATE GENERATION FROM TILES
// =============================================================================

/**
 * Generate all hex coordinates from existing tile data.
 *
 * This returns ONLY the coordinates that have actual tile data,
 * preserving the hexagonal shape of the map. Climate/environmental
 * overlay layers use this to render data for all hexes in the map.
 *
 * IMPORTANT: This function returns the actual tile coordinates, NOT a
 * rectangular bounding box. This ensures overlays render in the same
 * hexagonal shape as the underlying tile data.
 *
 * @param tiles - Map of tile data keyed by coordinate string
 * @returns Array of hex coordinates that have tile data
 *
 * @example
 * ```typescript
 * const state = tileStore.state.get();
 * const coords = getHexCoordsFromTiles(state.tiles);
 * // Returns coordinates with data: [{q:0,r:0}, {q:-1,r:0}, ...]
 * // Shape matches the hexagonal map, NOT a rectangular bounding box
 * ```
 */
export function getHexCoordsFromTiles(tiles: Map<string, { coord: HexCoord; data: TileData }>): HexCoord[] {
    // Return only coordinates that have actual tile data
    // This preserves the hexagonal shape of the map
    const coords: HexCoord[] = [];

    for (const record of tiles.values()) {
        coords.push(record.coord);
    }

    return coords;
}

/**
 * Generate hex coordinates with fallback to radius-based generation.
 *
 * Useful for layers that want to show data even when no tiles are loaded yet.
 *
 * @param tiles - Map of tile data
 * @param fallbackCenter - Center coordinate for radius fallback (default: {q:0, r:0})
 * @param fallbackRadius - Radius for fallback generation (default: 10)
 * @returns Array of hex coordinates
 *
 * @example
 * ```typescript
 * const coords = getHexCoordsWithFallback(state.tiles, {q: 5, r: 5}, 15);
 * // If tiles exist: uses actual tile coordinates
 * // If no tiles: generates radius 15 around (5,5)
 * ```
 */
export function getHexCoordsWithFallback(
    tiles: Map<string, { coord: HexCoord; data: TileData }>,
    fallbackCenter: HexCoord = { q: 0, r: 0 },
    fallbackRadius: number = 10
): HexCoord[] {
    // Try tile coordinates first
    const coords = getHexCoordsFromTiles(tiles);

    // If no tiles, use radius fallback
    if (coords.length === 0) {
        return coordsInRadius(fallbackCenter, fallbackRadius);
    }

    return coords;
}
