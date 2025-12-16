/**
 * Hex Geometry - Math utilities for hexagonal grids
 *
 * Uses axial coordinates (q, r) as primary system.
 * Cube coordinates (q, r, s) used internally for geometry operations.
 * Pointy-top orientation (standard for fantasy maps).
 *
 * Based on Red Blob Games hex grid reference:
 * https://www.redblobgames.com/grids/hexagons/
 */

import type { HexCoordinate } from './coordinates';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Coordinate key for Map storage
 * Format: "q,r" (e.g., "1,-2")
 */
export type CoordKey = `${number},${number}`;

/**
 * Cube coordinate for geometric operations
 * Invariant: q + r + s = 0
 */
export interface CubeCoordinate {
  q: number;
  r: number;
  s: number;
}

/**
 * Hex direction index (0-5, clockwise from East)
 */
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/**
 * Direction offsets for pointy-top hexes
 * Clockwise from East: E, NE, NW, W, SW, SE
 */
export const HEX_DIRECTIONS: readonly HexCoordinate[] = [
  { q: 1, r: 0 },   // 0: E
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: W
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
] as const;

/**
 * Direction names for debugging/display
 */
export const HEX_DIRECTION_NAMES = ['E', 'NE', 'NW', 'W', 'SW', 'SE'] as const;

/**
 * Square root of 3 - used in pixel conversions
 */
const SQRT3 = Math.sqrt(3);

// ═══════════════════════════════════════════════════════════════
// Coordinate Key Conversions
// ═══════════════════════════════════════════════════════════════

/**
 * Convert HexCoordinate to string key for Map storage
 */
export function coordToKey(coord: HexCoordinate): CoordKey {
  return `${coord.q},${coord.r}`;
}

/**
 * Parse string key back to HexCoordinate
 */
export function keyToCoord(key: CoordKey): HexCoordinate {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

/**
 * Check if a string is a valid CoordKey
 */
export function isValidCoordKey(key: string): key is CoordKey {
  return /^-?\d+,-?\d+$/.test(key);
}

// ═══════════════════════════════════════════════════════════════
// Cube Coordinate Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Convert axial to cube coordinates
 */
export function hexToCube(hex: HexCoordinate): CubeCoordinate {
  return {
    q: hex.q,
    r: hex.r,
    s: -hex.q - hex.r,
  };
}

/**
 * Convert cube to axial coordinates
 */
export function cubeToHex(cube: CubeCoordinate): HexCoordinate {
  return { q: cube.q, r: cube.r };
}

/**
 * Round floating-point cube coordinates to nearest hex
 * Preserves the q + r + s = 0 invariant
 */
export function cubeRound(cube: CubeCoordinate): CubeCoordinate {
  let q = Math.round(cube.q);
  let r = Math.round(cube.r);
  let s = Math.round(cube.s);

  const qDiff = Math.abs(q - cube.q);
  const rDiff = Math.abs(r - cube.r);
  const sDiff = Math.abs(s - cube.s);

  // Reset the component with largest rounding error
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
 * Linear interpolation between two cube coordinates
 */
function cubeLerp(a: CubeCoordinate, b: CubeCoordinate, t: number): CubeCoordinate {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

// ═══════════════════════════════════════════════════════════════
// Neighbor Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Get all 6 neighbors of a hex
 */
export function hexNeighbors(coord: HexCoordinate): HexCoordinate[] {
  return HEX_DIRECTIONS.map((dir) => ({
    q: coord.q + dir.q,
    r: coord.r + dir.r,
  }));
}

/**
 * Get neighbor in a specific direction
 */
export function hexNeighborInDirection(
  coord: HexCoordinate,
  direction: HexDirection
): HexCoordinate {
  const dir = HEX_DIRECTIONS[direction];
  return {
    q: coord.q + dir.q,
    r: coord.r + dir.r,
  };
}

// ═══════════════════════════════════════════════════════════════
// Area Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Get all hexes within a radius of center (inclusive)
 * Returns coordinates sorted by distance, then by q, then by r
 *
 * @param center Center coordinate
 * @param radius Maximum distance (0 = only center, 1 = center + 6 neighbors, etc.)
 */
export function hexesInRadius(
  center: HexCoordinate,
  radius: number
): HexCoordinate[] {
  const results: HexCoordinate[] = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);

    for (let r = r1; r <= r2; r++) {
      results.push({
        q: center.q + q,
        r: center.r + r,
      });
    }
  }

  return results;
}

/**
 * Calculate number of hexes in a given radius
 * Formula: 3r^2 + 3r + 1
 */
export function hexCountInRadius(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

// ═══════════════════════════════════════════════════════════════
// Line Drawing
// ═══════════════════════════════════════════════════════════════

/**
 * Draw a line between two hexes (Bresenham-style for hexes)
 * Includes both endpoints
 */
export function hexLine(
  from: HexCoordinate,
  to: HexCoordinate
): HexCoordinate[] {
  const cubeA = hexToCube(from);
  const cubeB = hexToCube(to);

  // Calculate distance
  const n = Math.max(
    Math.abs(cubeA.q - cubeB.q),
    Math.abs(cubeA.r - cubeB.r),
    Math.abs(cubeA.s - cubeB.s)
  );

  if (n === 0) {
    return [from];
  }

  const results: HexCoordinate[] = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cube = cubeRound(cubeLerp(cubeA, cubeB, t));
    results.push(cubeToHex(cube));
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Pixel Conversions (for Rendering)
// ═══════════════════════════════════════════════════════════════

/**
 * Convert hex coordinate to pixel position (center of hex)
 * Uses pointy-top orientation
 *
 * @param coord Hex coordinate
 * @param size Hex size (distance from center to corner, in pixels)
 */
export function hexToPixel(
  coord: HexCoordinate,
  size: number
): { x: number; y: number } {
  const x = size * (SQRT3 * coord.q + (SQRT3 / 2) * coord.r);
  const y = size * (1.5 * coord.r);
  return { x, y };
}

/**
 * Convert pixel position to hex coordinate
 * Uses pointy-top orientation
 *
 * @param x Pixel X position
 * @param y Pixel Y position
 * @param size Hex size (distance from center to corner, in pixels)
 */
export function pixelToHex(
  x: number,
  y: number,
  size: number
): HexCoordinate {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;

  // Round to nearest hex using cube coordinates
  const cube = cubeRound({ q, r, s: -q - r });
  return cubeToHex(cube);
}

/**
 * Get the 6 corner points of a hex as an SVG polygon string
 * Pointy-top orientation (corners at top and bottom)
 *
 * @param cx Center X in pixels
 * @param cy Center Y in pixels
 * @param size Hex size (center to corner)
 */
export function hexPolygonPoints(
  cx: number,
  cy: number,
  size: number
): string {
  const points: string[] = [];

  for (let i = 0; i < 6; i++) {
    // Pointy-top: start at -90 degrees (top)
    const angle = (Math.PI / 180) * (60 * i - 90);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }

  return points.join(' ');
}

/**
 * Get hex width for pointy-top orientation
 */
export function hexWidth(size: number): number {
  return SQRT3 * size;
}

/**
 * Get hex height for pointy-top orientation
 */
export function hexHeight(size: number): number {
  return 2 * size;
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Check if two hex coordinates are equal
 */
export function hexEquals(a: HexCoordinate, b: HexCoordinate): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Create a hex coordinate
 */
export function hexCoord(q: number, r: number): HexCoordinate {
  return { q, r };
}

/**
 * Origin hex (0, 0)
 */
export const HEX_ORIGIN: HexCoordinate = { q: 0, r: 0 };
