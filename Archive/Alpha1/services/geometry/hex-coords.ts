// src/services/geometry/hex-coords.ts
// Hex coordinate operations for Axial coordinate system
//
// This file provides all hex coordinate functions using AxialCoord as the primary type.
// Uses pointy-top hex orientation.

import type { AxialCoord, CubeCoord } from "./geometry-types";

// ============================================================================
// Coordinate Keys (String Serialization)
// ============================================================================

/**
 * Opaque type for coordinate keys.
 *
 * Ensures type safety - prevents mixing plain strings with coordinate keys.
 * Use coordToKey() to create, keyToCoord() to parse.
 */
export type CoordKey = string & { readonly __brand: "CoordKey" };

/**
 * Type guard to check if string is valid coordinate key.
 *
 * Validates format: "q,r" where q and r are integers.
 */
export function isValidKey(key: string): key is CoordKey {
    const parts = key.split(",");
    if (parts.length !== 2) return false;

    const q = parseInt(parts[0], 10);
    const r = parseInt(parts[1], 10);

    return (
        !isNaN(q) &&
        !isNaN(r) &&
        parts[0] === q.toString() &&
        parts[1] === r.toString()
    );
}

/**
 * Convert coordinate to string key.
 *
 * Format: "q,r" (comma-separated)
 */
export function coordToKey(coord: AxialCoord): CoordKey {
    return `${coord.q},${coord.r}` as CoordKey;
}

/**
 * Parse coordinate key to coordinate object.
 *
 * Inverse of coordToKey(). Handles "q,r" format.
 * Throws error if key format is invalid.
 */
export function keyToCoord(key: string): AxialCoord {
    if (!isValidKey(key)) {
        throw new Error(`Invalid coordinate key: "${key}" (expected format "q,r")`);
    }

    const parts = key.split(",");
    const q = parseInt(parts[0], 10);
    const r = parseInt(parts[1], 10);

    return { q, r };
}

/**
 * Regular expression for validating coordinate keys.
 */
export const COORD_KEY_REGEX = /^-?\d+,-?\d+$/;

/**
 * Origin coordinate key (0,0).
 */
export const ORIGIN_KEY: CoordKey = "0,0" as CoordKey;

// ============================================================================
// Coordinate Conversions
// ============================================================================

/**
 * Convert Axial coordinate to Cube coordinate
 */
export function axialToCube(coord: AxialCoord): CubeCoord {
    const s = -coord.q - coord.r;
    return { q: coord.q, r: coord.r, s };
}

/**
 * Convert Cube coordinate to Axial coordinate
 */
export function cubeToAxial(coord: CubeCoord): AxialCoord {
    return { q: coord.q, r: coord.r };
}

// ============================================================================
// Distance Calculations
// ============================================================================

/**
 * Calculate distance between two hexes in axial coordinates
 *
 * Uses cube coordinate distance formula.
 */
export function axialDistance(a: AxialCoord, b: AxialCoord): number {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds);
}

// ============================================================================
// Neighbors
// ============================================================================

/**
 * Neighbor offset tables for Axial coordinate system.
 *
 * Direction indices (clockwise from East):
 * 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 */
const AXIAL_DIRECTIONS: ReadonlyArray<AxialCoord> = [
    { q: 1, r: 0 },   // 0: E
    { q: 1, r: -1 },  // 1: NE
    { q: 0, r: -1 },  // 2: NW
    { q: -1, r: 0 },  // 3: W
    { q: -1, r: 1 },  // 4: SW
    { q: 0, r: 1 },   // 5: SE
] as const;

/**
 * Get all 6 neighbors of a hex in Axial coordinates.
 *
 * Returns neighbors in clockwise order starting from East:
 * [E, NE, NW, W, SW, SE]
 */
export function neighbors(coord: AxialCoord): AxialCoord[] {
    return AXIAL_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/**
 * Get specific neighbor by direction (0-5, clockwise from E).
 *
 * @param coord - Axial coordinate
 * @param direction - Direction index (0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE)
 * @throws {RangeError} If direction is not in range 0-5
 */
export function neighborInDirection(coord: AxialCoord, direction: number): AxialCoord {
    if (direction < 0 || direction > 5) {
        throw new RangeError(`Direction must be 0-5, got ${direction}`);
    }

    const d = AXIAL_DIRECTIONS[direction % 6];
    return { q: coord.q + d.q, r: coord.r + d.r };
}

// ============================================================================
// Radius & Area
// ============================================================================

/**
 * Get all hex coordinates within a given radius (inclusive) in Axial grid
 *
 * Returns coordinates sorted by distance → row → column (stable order for tests).
 */
export function coordsInRadius(center: AxialCoord, radius: number): AxialCoord[] {
    const out: AxialCoord[] = [];

    // Use axial coordinate algorithm from Red Blob Games:
    // For each q from -N to +N, r ranges from max(-N, -q-N) to min(+N, -q+N)
    // This produces a proper hexagonal region, not a rectangle
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);

        for (let r = r1; r <= r2; r++) {
            out.push({ q: center.q + q, r: center.r + r });
        }
    }

    // Sort by distance → row → column (stable order for tests)
    out.sort((a, b) => {
        const distA = axialDistance(center, a);
        const distB = axialDistance(center, b);

        if (distA !== distB) return distA - distB;
        if (a.r !== b.r) return a.r - b.r;
        return a.q - b.q;
    });

    return out;
}

// ============================================================================
// Line Drawing
// ============================================================================

/**
 * Linear interpolation between two cube coordinates.
 */
export function cubeLerp(a: CubeCoord, b: CubeCoord, t: number): CubeCoord {
    return {
        q: a.q + (b.q - a.q) * t,
        r: a.r + (b.r - a.r) * t,
        s: a.s + (b.s - a.s) * t,
    };
}

/**
 * Round fractional cube coordinates to nearest hex.
 *
 * Ensures cube invariant (q + r + s = 0) is preserved by adjusting
 * the coordinate with the largest rounding error.
 */
export function cubeRound(fr: CubeCoord): CubeCoord {
    let q = Math.round(fr.q);
    let r = Math.round(fr.r);
    let s = Math.round(fr.s);

    const qDiff = Math.abs(q - fr.q);
    const rDiff = Math.abs(r - fr.r);
    const sDiff = Math.abs(s - fr.s);

    // Reset the coordinate with the largest rounding error
    // to preserve cube invariant (q + r + s = 0)
    if (qDiff > rDiff && qDiff > sDiff) {
        q = -r - s;
    } else if (rDiff > sDiff) {
        r = -q - s;
    } else {
        s = -q - r;
    }

    return { q, r, s };
}

/**
 * Get all hexes along a line from a to b (Bresenham's algorithm for hexes).
 *
 * Uses cube coordinate interpolation and rounding to find the exact
 * hexes that would be crossed by a straight line from a to b.
 *
 * Includes both endpoints in the result.
 */
export function line(a: AxialCoord, b: AxialCoord): AxialCoord[] {
    // Convert to cube coordinates for accurate interpolation
    const cubeA = axialToCube(a);
    const cubeB = axialToCube(b);

    // Calculate number of steps needed
    const distance = Math.max(
        Math.abs(cubeA.q - cubeB.q),
        Math.abs(cubeA.r - cubeB.r),
        Math.abs(cubeA.s - cubeB.s)
    );

    // Interpolate and round at each step
    const results: AxialCoord[] = [];
    for (let i = 0; i <= distance; i++) {
        const t = distance === 0 ? 0 : i / distance;
        const interpolated = cubeLerp(cubeA, cubeB, t);
        const rounded = cubeRound(interpolated);
        results.push(cubeToAxial(rounded));
    }

    return results;
}

// ============================================================================
// Pixel Conversions
// ============================================================================

/**
 * Hex geometry constants for pointy-top hexes.
 */
const HEX_WIDTH_FACTOR = Math.sqrt(3);
const HEX_HEIGHT_FACTOR = 2;

/**
 * Convert Axial coordinate to pixel position (center of hex).
 *
 * Uses pointy-top hex orientation.
 */
export function axialToPixel(coord: AxialCoord, size: number): { x: number; y: number } {
    const x = size * (HEX_WIDTH_FACTOR * coord.q + HEX_WIDTH_FACTOR / 2 * coord.r);
    const y = size * (3 / 2 * coord.r);
    return { x, y };
}

/**
 * Convert pixel position to Axial coordinate (nearest hex).
 *
 * Inverse of axialToPixel with cube rounding for accurate hex selection.
 */
export function pixelToAxial(x: number, y: number, size: number): AxialCoord {
    // Inverse formula from Red Blob Games
    const qFractional = ((HEX_WIDTH_FACTOR / 3) * x - (1 / 3) * y) / size;
    const rFractional = ((2 / 3) * y) / size;

    // Round to nearest hex using cube coordinates
    const cubeQ = qFractional;
    const cubeR = rFractional;
    const cubeS = -qFractional - rFractional;

    let roundedQ = Math.round(cubeQ);
    let roundedR = Math.round(cubeR);
    let roundedS = Math.round(cubeS);

    const qDiff = Math.abs(roundedQ - cubeQ);
    const rDiff = Math.abs(roundedR - cubeR);
    const sDiff = Math.abs(roundedS - cubeS);

    // Reset coordinate with largest rounding error to preserve cube invariant
    if (qDiff > rDiff && qDiff > sDiff) {
        roundedQ = -roundedR - roundedS;
    } else if (rDiff > sDiff) {
        roundedR = -roundedQ - roundedS;
    }

    return { q: roundedQ, r: roundedR };
}

/**
 * Convert Axial coordinate to SVG canvas pixel position.
 *
 * This accounts for:
 * - Base coordinate offset (maps centered on different hexes)
 * - SVG canvas padding (visual breathing room)
 *
 * Use this for SVG rendering.
 */
export function axialToCanvasPixel(
    coord: AxialCoord,
    size: number,
    base: AxialCoord,
    padding: number
): { x: number; y: number } {
    // Calculate relative position from base
    const offset = axialToPixel({ q: coord.q - base.q, r: coord.r - base.r }, size);

    // Apply padding and center offset
    return {
        x: padding + offset.x,
        y: padding + offset.y + size
    };
}

// ============================================================================
// Hex Geometry Dimensions
// ============================================================================

/**
 * Calculate hex width (flat-to-flat distance) for pointy-top hexes.
 *
 * @param radius - Hex pixel size (radius from center to corner)
 * @returns Width in pixels
 */
export function hexWidth(radius: number): number {
    return Math.sqrt(3) * radius;
}

/**
 * Calculate hex height (point-to-point distance) for pointy-top hexes.
 *
 * @param radius - Hex pixel size (radius from center to corner)
 * @returns Height in pixels
 */
export function hexHeight(radius: number): number {
    return 2 * radius;
}

// ============================================================================
// SVG Rendering
// ============================================================================

/**
 * Generate SVG polygon points string for a pointy-top hex.
 *
 * Creates 6 vertices starting from the top point, going clockwise.
 * Output is suitable for SVG <polygon points="..."> attribute.
 *
 * @param cx - Center x pixel coordinate
 * @param cy - Center y pixel coordinate
 * @param radius - Hex pixel size (radius from center to corner)
 * @returns SVG points string (e.g., "100,50 143,75 143,125 100,150 57,125 57,75")
 */
export function hexPolygonPoints(cx: number, cy: number, radius: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
        // -90° offset puts first vertex at top (pointy-top orientation)
        const ang = ((60 * i - 90) * Math.PI) / 180;
        pts.push(`${cx + radius * Math.cos(ang)},${cy + radius * Math.sin(ang)}`);
    }
    return pts.join(" ");
}
