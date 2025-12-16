/**
 * Hex coordinate utilities for axial coordinate system.
 * Clean-room implementation based on Red Blob Games hex grid theory.
 *
 * Uses flat-top hexagons with axial coordinates (q, r).
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Axial hex coordinate (q = column, r = row).
 * The third coordinate s is implicit: s = -q - r
 */
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

/**
 * 2D point in pixel space.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

// ============================================================================
// Direction Constants
// ============================================================================

/**
 * The 6 axial direction vectors for flat-top hexagons.
 * Ordered clockwise starting from East.
 */
const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
] as const;

// ============================================================================
// Coordinate Operations
// ============================================================================

/**
 * Create a hex coordinate.
 */
export function hex(q: number, r: number): HexCoord {
  return { q, r };
}

/**
 * Check if two hex coordinates are equal.
 */
export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Add two hex coordinates.
 */
export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

/**
 * Subtract hex coordinate b from a.
 */
export function hexSubtract(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q - b.q, r: a.r - b.r };
}

/**
 * Scale a hex coordinate by a factor.
 */
export function hexScale(coord: HexCoord, factor: number): HexCoord {
  return { q: coord.q * factor, r: coord.r * factor };
}

// ============================================================================
// Distance and Neighbors
// ============================================================================

/**
 * Calculate the distance between two hex coordinates.
 * Uses the cube coordinate formula: max(|dq|, |dr|, |ds|) where s = -q - r
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(-a.q - a.r - (-b.q - b.r)); // |as - bs|
  return Math.max(dq, dr, ds);
}

/**
 * Get the 6 neighboring hex coordinates.
 * Returns neighbors in clockwise order starting from East.
 */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => hexAdd(coord, dir));
}

/**
 * Get a specific neighbor by direction index (0-5, clockwise from East).
 */
export function hexNeighbor(coord: HexCoord, direction: number): HexCoord {
  const dir = AXIAL_DIRECTIONS[((direction % 6) + 6) % 6];
  return hexAdd(coord, dir);
}

/**
 * Check if two hexes are adjacent (distance = 1).
 */
export function hexAdjacent(a: HexCoord, b: HexCoord): boolean {
  return hexDistance(a, b) === 1;
}

/**
 * Get all hex coordinates within a given radius (inclusive).
 * Returns hexes in a spiral pattern from center outward.
 */
export function hexesInRadius(center: HexCoord, radius: number): HexCoord[] {
  if (radius < 0) return [];
  if (radius === 0) return [center];

  const results: HexCoord[] = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push(hexAdd(center, { q, r }));
    }
  }

  return results;
}

/**
 * Get hexes on the ring at exactly the given distance from center.
 */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius < 0) return [];
  if (radius === 0) return [center];

  const results: HexCoord[] = [];

  // Start at the hex radius steps in direction 4 (SW)
  let current = hexAdd(center, hexScale(AXIAL_DIRECTIONS[4], radius));

  // Walk around the ring
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(current);
      current = hexNeighbor(current, i);
    }
  }

  return results;
}

// ============================================================================
// Coordinate Conversion (String Keys)
// ============================================================================

/**
 * Convert hex coordinate to a unique string key.
 * Format: "q,r"
 */
export function coordToKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Parse a string key back to hex coordinate.
 * Returns null if the key is invalid.
 */
export function keyToCoord(key: string): HexCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;

  const q = parseInt(parts[0], 10);
  const r = parseInt(parts[1], 10);

  if (isNaN(q) || isNaN(r)) return null;

  return { q, r };
}

// ============================================================================
// Pixel Conversion (Flat-Top Hexagons)
// ============================================================================

/**
 * Convert axial hex coordinate to pixel position (center of hex).
 * Uses flat-top orientation.
 *
 * @param coord - Hex coordinate
 * @param size - Distance from center to corner (hex radius)
 * @returns Pixel position of hex center
 */
export function axialToPixel(coord: HexCoord, size: number): Point {
  // Flat-top hex: x depends on q, y depends on both q and r
  const x = size * ((3 / 2) * coord.q);
  const y = size * ((Math.sqrt(3) / 2) * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

/**
 * Convert pixel position to axial hex coordinate.
 * Uses flat-top orientation with rounding to nearest hex.
 *
 * @param point - Pixel position
 * @param size - Distance from center to corner (hex radius)
 * @returns Nearest hex coordinate
 */
export function pixelToAxial(point: Point, size: number): HexCoord {
  // Convert to fractional axial coordinates
  const q = ((2 / 3) * point.x) / size;
  const r = ((-1 / 3) * point.x + (Math.sqrt(3) / 3) * point.y) / size;

  // Round to nearest hex using cube coordinate rounding
  return axialRound({ q, r });
}

/**
 * Round fractional axial coordinates to the nearest hex.
 * Converts to cube coordinates, rounds, and converts back.
 */
export function axialRound(coord: { q: number; r: number }): HexCoord {
  const s = -coord.q - coord.r;

  let rq = Math.round(coord.q);
  let rr = Math.round(coord.r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - coord.q);
  const rDiff = Math.abs(rr - coord.r);
  const sDiff = Math.abs(rs - s);

  // Reset the component with largest rounding error
  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  // If sDiff is largest, q and r are already correct

  // Normalize -0 to 0 (JavaScript quirk: -0 !== 0 in Object.is)
  return { q: rq || 0, r: rr || 0 };
}

// ============================================================================
// Hex Geometry (for rendering)
// ============================================================================

/**
 * Get the 6 corner points of a hex in pixel coordinates.
 * Uses flat-top orientation, corners ordered clockwise from right.
 *
 * @param center - Pixel position of hex center
 * @param size - Distance from center to corner
 * @returns Array of 6 corner points
 */
export function hexCorners(center: Point, size: number): Point[] {
  const corners: Point[] = [];

  for (let i = 0; i < 6; i++) {
    // Flat-top: first corner at 0 degrees (right)
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }

  return corners;
}

/**
 * Get the width of a flat-top hex.
 */
export function hexWidth(size: number): number {
  return size * 2;
}

/**
 * Get the height of a flat-top hex.
 */
export function hexHeight(size: number): number {
  return size * Math.sqrt(3);
}

/**
 * Get horizontal spacing between hex centers (flat-top).
 */
export function hexHorizontalSpacing(size: number): number {
  return size * (3 / 2);
}

/**
 * Get vertical spacing between hex centers (flat-top).
 */
export function hexVerticalSpacing(size: number): number {
  return size * Math.sqrt(3);
}
