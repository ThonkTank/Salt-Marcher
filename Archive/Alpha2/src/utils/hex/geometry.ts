/**
 * Hex Geometry Utilities
 *
 * Pure hex coordinate functions.
 * Uses pointy-top hex orientation.
 *
 * @module utils/hex/geometry
 */

import type { AxialCoord, CubeCoord, CoordKey, Point } from '../../schemas';
import {
    AXIAL_DIRECTIONS,
    COORD_KEY_REGEX,
    ORIGIN_KEY,
    HEX_WIDTH_FACTOR,
} from '../../constants/hex-geometry';
import { lerp } from '../common/math';

// Re-export constants
export { COORD_KEY_REGEX, ORIGIN_KEY };

// ============================================================================
// Coordinate Keys
// ============================================================================

/**
 * Type guard to check if string is valid coordinate key.
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
 * Convert coordinate to string key. Format: "q,r"
 */
export function coordToKey(coord: AxialCoord): CoordKey {
    return `${coord.q},${coord.r}` as CoordKey;
}

/**
 * Parse coordinate key to coordinate object.
 */
export function keyToCoord(key: string): AxialCoord {
    if (!isValidKey(key)) {
        throw new Error(`Invalid coordinate key: "${key}" (expected format "q,r")`);
    }
    const parts = key.split(",");
    return { q: parseInt(parts[0], 10), r: parseInt(parts[1], 10) };
}

// ============================================================================
// Coordinate Conversions
// ============================================================================

/**
 * Convert Axial coordinate to Cube coordinate.
 */
export function axialToCube(coord: AxialCoord): CubeCoord {
    return { q: coord.q, r: coord.r, s: -coord.q - coord.r };
}

/**
 * Convert Cube coordinate to Axial coordinate.
 */
export function cubeToAxial(coord: CubeCoord): AxialCoord {
    return { q: coord.q, r: coord.r };
}

// ============================================================================
// Distance & Neighbors
// ============================================================================

/**
 * Calculate distance between two hexes in axial coordinates.
 */
export function axialDistance(a: AxialCoord, b: AxialCoord): number {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds);
}

/**
 * Get all 6 neighbors of a hex. Returns [E, NE, NW, W, SW, SE].
 */
export function neighbors(coord: AxialCoord): AxialCoord[] {
    return AXIAL_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/**
 * Get specific neighbor by direction (0-5, clockwise from E).
 */
export function neighborInDirection(coord: AxialCoord, direction: number): AxialCoord {
    if (direction < 0 || direction > 5) {
        throw new RangeError(`Direction must be 0-5, got ${direction}`);
    }
    const d = AXIAL_DIRECTIONS[direction % 6];
    return { q: coord.q + d.q, r: coord.r + d.r };
}

/**
 * Get direction index from one hex to its neighbor. Returns null if not neighbors.
 */
export function getDirection(from: AxialCoord, to: AxialCoord): number | null {
    const dq = to.q - from.q;
    const dr = to.r - from.r;
    for (let i = 0; i < 6; i++) {
        if (AXIAL_DIRECTIONS[i].q === dq && AXIAL_DIRECTIONS[i].r === dr) {
            return i;
        }
    }
    return null;
}

// ============================================================================
// Area & Line
// ============================================================================

/**
 * Get all hex coordinates within a given radius (inclusive).
 */
export function coordsInRadius(center: AxialCoord, radius: number): AxialCoord[] {
    const out: AxialCoord[] = [];
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            out.push({ q: center.q + q, r: center.r + r });
        }
    }
    out.sort((a, b) => {
        const distA = axialDistance(center, a);
        const distB = axialDistance(center, b);
        if (distA !== distB) return distA - distB;
        if (a.r !== b.r) return a.r - b.r;
        return a.q - b.q;
    });
    return out;
}

/**
 * Linear interpolation between two cube coordinates.
 */
export function cubeLerp(a: CubeCoord, b: CubeCoord, t: number): CubeCoord {
    return {
        q: lerp(a.q, b.q, t),
        r: lerp(a.r, b.r, t),
        s: lerp(a.s, b.s, t),
    };
}

/**
 * Round fractional cube coordinates to nearest hex.
 */
export function cubeRound(fr: CubeCoord): CubeCoord {
    let q = Math.round(fr.q);
    let r = Math.round(fr.r);
    let s = Math.round(fr.s);

    const qDiff = Math.abs(q - fr.q);
    const rDiff = Math.abs(r - fr.r);
    const sDiff = Math.abs(s - fr.s);

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
 * Get all hexes along a line from a to b (Bresenham's algorithm).
 */
export function line(a: AxialCoord, b: AxialCoord): AxialCoord[] {
    const cubeA = axialToCube(a);
    const cubeB = axialToCube(b);
    const distance = Math.max(
        Math.abs(cubeA.q - cubeB.q),
        Math.abs(cubeA.r - cubeB.r),
        Math.abs(cubeA.s - cubeB.s)
    );

    const results: AxialCoord[] = [];
    for (let i = 0; i <= distance; i++) {
        const t = distance === 0 ? 0 : i / distance;
        results.push(cubeToAxial(cubeRound(cubeLerp(cubeA, cubeB, t))));
    }
    return results;
}

// ============================================================================
// Pixel Conversions
// ============================================================================

/**
 * Convert Axial coordinate to pixel position (center of hex).
 */
export function axialToPixel(coord: AxialCoord, size: number): Point {
    return {
        x: size * (HEX_WIDTH_FACTOR * coord.q + HEX_WIDTH_FACTOR / 2 * coord.r),
        y: size * (3 / 2 * coord.r),
    };
}

/**
 * Convert pixel position to Axial coordinate (nearest hex).
 */
export function pixelToAxial(x: number, y: number, size: number): AxialCoord {
    const qFractional = ((HEX_WIDTH_FACTOR / 3) * x - (1 / 3) * y) / size;
    const rFractional = ((2 / 3) * y) / size;

    const cubeS = -qFractional - rFractional;
    let roundedQ = Math.round(qFractional);
    let roundedR = Math.round(rFractional);
    const roundedS = Math.round(cubeS);

    const qDiff = Math.abs(roundedQ - qFractional);
    const rDiff = Math.abs(roundedR - rFractional);
    const sDiff = Math.abs(roundedS - cubeS);

    if (qDiff > rDiff && qDiff > sDiff) {
        roundedQ = -roundedR - roundedS;
    } else if (rDiff > sDiff) {
        roundedR = -roundedQ - roundedS;
    }
    return { q: roundedQ, r: roundedR };
}

// ============================================================================
// Hex Corners
// ============================================================================

/**
 * Get the 6 corners of a pointy-top hex.
 */
export function getHexCorners(cx: number, cy: number, radius: number): Point[] {
    const corners: Point[] = [];
    for (let i = 0; i < 6; i++) {
        const angleRad = ((60 * i - 90) * Math.PI) / 180;
        corners.push({
            x: cx + radius * Math.cos(angleRad),
            y: cy + radius * Math.sin(angleRad),
        });
    }
    return corners;
}
