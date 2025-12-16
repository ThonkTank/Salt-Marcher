/**
 * Hex Geometry Types
 *
 * Coordinate types for hexagonal grids.
 *
 * @module schemas/geometry/hex-geometry
 */

import {
    HEX_PIXEL_SIZE,
    TILE_RADIUS,
    HEXES_PER_TRAVEL_DAY,
} from '../../constants/hex-geometry';
import type { BrandedNumber, BrandedString } from '../common/type-helpers';

// ============================================================================
// Coordinate Types
// ============================================================================

/**
 * Axial Coordinate
 *
 * Two-dimensional hex coordinate using (q, r) axes.
 */
export type AxialCoord = {
    q: number;
    r: number;
};

/**
 * Cube Coordinate
 *
 * Three-dimensional hex coordinate where q + r + s = 0.
 * Best for geometric operations (distance, rotation, neighbors).
 */
export type CubeCoord = {
    q: number;
    r: number;
    s: number;
};

/**
 * Pixel position.
 */
export type Point = {
    x: number;
    y: number;
};

// ============================================================================
// Coordinate Key Type
// ============================================================================

/**
 * Opaque type for coordinate keys.
 *
 * Ensures type safety - prevents mixing plain strings with coordinate keys.
 * Use coordToKey() to create, keyToCoord() to parse.
 */
export type CoordKey = BrandedString<'CoordKey'>;

// ============================================================================
// Corner Coordinate Type
// ============================================================================

/**
 * Corner coordinate - identifies a specific corner of a hex.
 *
 * Corners are numbered 0-5 clockwise starting from top (pointy-top hexes):
 *       0 (-90°)
 *      /    \
 *   5 /      \ 1
 *    |        |
 *   4 \      / 2
 *      \    /
 *       3 (90°)
 */
export type CornerCoord = {
    q: number;
    r: number;
    corner: 0 | 1 | 2 | 3 | 4 | 5;
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Axial coordinates.
 */
export function isAxialCoord(coord: unknown): coord is AxialCoord {
    return (
        typeof coord === "object" &&
        coord !== null &&
        "q" in coord &&
        "r" in coord &&
        typeof (coord as AxialCoord).q === "number" &&
        typeof (coord as AxialCoord).r === "number" &&
        !isNaN((coord as AxialCoord).q) &&
        !isNaN((coord as AxialCoord).r) &&
        isFinite((coord as AxialCoord).q) &&
        isFinite((coord as AxialCoord).r)
    );
}

/**
 * Type guard for Cube coordinates.
 * Validates that q + r + s ≈ 0 (allows floating point error).
 */
export function isCubeCoord(coord: unknown): coord is CubeCoord {
    if (
        typeof coord !== "object" ||
        coord === null ||
        !("q" in coord) ||
        !("r" in coord) ||
        !("s" in coord)
    ) {
        return false;
    }

    const { q, r, s } = coord as CubeCoord;

    if (
        typeof q !== "number" ||
        typeof r !== "number" ||
        typeof s !== "number" ||
        isNaN(q) || isNaN(r) || isNaN(s) ||
        !isFinite(q) || !isFinite(r) || !isFinite(s)
    ) {
        return false;
    }

    return Math.abs(q + r + s) < 1e-10;
}

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Hex Pixel Size (Rendering)
 *
 * Branded type representing the pixel radius of a hex.
 */
export type HexPixelSize = BrandedNumber<'HexPixelSize'>;

export const HexPixelSizeUtil = {
    DEFAULT: HEX_PIXEL_SIZE.DEFAULT as HexPixelSize,
    MIN: HEX_PIXEL_SIZE.MIN as HexPixelSize,
    MAX: HEX_PIXEL_SIZE.MAX as HexPixelSize,

    create(pixels: number): HexPixelSize {
        if (!isFinite(pixels) || isNaN(pixels)) {
            throw new RangeError(`HexPixelSize must be a finite number (got ${pixels})`);
        }
        if (pixels < HEX_PIXEL_SIZE.MIN || pixels > HEX_PIXEL_SIZE.MAX) {
            throw new RangeError(
                `HexPixelSize must be between ${HEX_PIXEL_SIZE.MIN} and ${HEX_PIXEL_SIZE.MAX} (got ${pixels})`
            );
        }
        return pixels as HexPixelSize;
    },

    isValid(value: unknown): value is HexPixelSize {
        return (
            typeof value === "number" &&
            isFinite(value) &&
            value >= HEX_PIXEL_SIZE.MIN &&
            value <= HEX_PIXEL_SIZE.MAX
        );
    },
};

/**
 * Tile Radius (Coordinates)
 *
 * Branded type representing the number of hex steps from center.
 */
export type TileRadius = BrandedNumber<'TileRadius'>;

export const TileRadiusUtil = {
    MAX: TILE_RADIUS.MAX as TileRadius,
    HEXES_PER_DAY: HEXES_PER_TRAVEL_DAY,

    create(hexes: number): TileRadius {
        if (!isFinite(hexes) || isNaN(hexes)) {
            throw new RangeError(`TileRadius must be a finite number (got ${hexes})`);
        }
        const rounded = Math.floor(hexes);
        if (rounded < TILE_RADIUS.MIN || rounded > TILE_RADIUS.MAX) {
            throw new RangeError(
                `TileRadius must be between ${TILE_RADIUS.MIN} and ${TILE_RADIUS.MAX} (got ${rounded})`
            );
        }
        return rounded as TileRadius;
    },

    fromTravelDays(days: number): TileRadius {
        return TileRadiusUtil.create(days * HEXES_PER_TRAVEL_DAY);
    },

    tileCount(radius: TileRadius): number {
        const r = radius as number;
        return 3 * r * r + 3 * r + 1;
    },

    isValid(value: unknown): value is TileRadius {
        return (
            typeof value === "number" &&
            isFinite(value) &&
            value >= TILE_RADIUS.MIN &&
            value <= TILE_RADIUS.MAX &&
            Number.isInteger(value)
        );
    },
};
