/**
 * Hex Geometry Constants
 *
 * Constants for hexagonal grid operations.
 * Uses pointy-top hex orientation.
 */

// ============================================================================
// Direction Constants
// ============================================================================

/**
 * Axial direction offsets for hex neighbors.
 *
 * Direction indices (clockwise from East):
 * 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 */
export const AXIAL_DIRECTIONS = [
    { q: 1, r: 0 },   // 0: E
    { q: 1, r: -1 },  // 1: NE
    { q: 0, r: -1 },  // 2: NW
    { q: -1, r: 0 },  // 3: W
    { q: -1, r: 1 },  // 4: SW
    { q: 0, r: 1 },   // 5: SE
] as const;

/**
 * Direction names for reference.
 */
export const DIRECTION_NAMES = ["E", "NE", "NW", "W", "SW", "SE"] as const;

// ============================================================================
// Coordinate Key Constants
// ============================================================================

/**
 * Regular expression for validating coordinate keys.
 * Format: "q,r" where q and r are integers (may be negative).
 */
export const COORD_KEY_REGEX = /^-?\d+,-?\d+$/;

/**
 * Origin coordinate key (0,0).
 */
export const ORIGIN_KEY = "0,0";

// ============================================================================
// Hex Geometry Factors
// ============================================================================

/**
 * Width factor for pointy-top hexes (sqrt(3)).
 */
export const HEX_WIDTH_FACTOR = Math.sqrt(3);

/**
 * Height factor for pointy-top hexes.
 */
export const HEX_HEIGHT_FACTOR = 2;

// ============================================================================
// Size Constraints
// ============================================================================

/**
 * Hex pixel size constraints (radius from center to corner).
 */
export const HEX_PIXEL_SIZE = {
    MIN: 12,
    MAX: 200,
    DEFAULT: 42,
} as const;

/**
 * Tile radius constraints (number of hex steps from center).
 */
export const TILE_RADIUS = {
    MIN: 0,
    MAX: 50,
} as const;

// Travel constants moved to travel.ts for consolidation
// Re-export for backward compatibility
export { HEXES_PER_TRAVEL_DAY, MAP_RADIUS_PER_TRAVEL_DAY } from './travel';
