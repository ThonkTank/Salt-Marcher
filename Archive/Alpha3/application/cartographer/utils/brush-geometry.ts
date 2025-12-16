/**
 * Brush Geometry Utilities
 *
 * Provides coordinate calculations for brush application.
 * Used only within the Cartographer workmode.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import { hexDistance } from '@core/schemas/coordinates';
import {
  hexesInRadius,
  coordToKey,
  type CoordKey,
} from '@core/schemas/hex-geometry';
import { calculateFalloff, type FalloffType } from './brush-math';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Brush coordinate with falloff factor
 */
export interface BrushCoord {
  coord: HexCoordinate;
  key: CoordKey;
  distance: number;
  falloff: number;
}

// ═══════════════════════════════════════════════════════════════
// Brush Coordinate Calculation
// ═══════════════════════════════════════════════════════════════

/**
 * Get all coordinates affected by a brush stroke
 *
 * @param center - Brush center coordinate
 * @param radius - Brush radius
 * @param falloffType - Falloff curve type
 * @returns Array of coordinates with falloff factors
 */
export function getBrushCoords(
  center: HexCoordinate,
  radius: number,
  falloffType: FalloffType
): BrushCoord[] {
  const coords = hexesInRadius(center, radius);
  const result: BrushCoord[] = [];

  for (const coord of coords) {
    const distance = hexDistance(center, coord);
    const falloff = calculateFalloff(distance, radius, falloffType);

    result.push({
      coord,
      key: coordToKey(coord),
      distance,
      falloff,
    });
  }

  return result;
}

/**
 * Get brush coordinates filtered by existing tiles
 *
 * @param center - Brush center coordinate
 * @param radius - Brush radius
 * @param falloffType - Falloff curve type
 * @param validKeys - Set of valid tile keys
 * @returns Filtered array of brush coordinates
 */
export function getBrushCoordsFiltered(
  center: HexCoordinate,
  radius: number,
  falloffType: FalloffType,
  validKeys: Set<CoordKey>
): BrushCoord[] {
  return getBrushCoords(center, radius, falloffType).filter((bc) =>
    validKeys.has(bc.key)
  );
}

/**
 * Get only the coordinates at the edge of the brush radius
 * Useful for resize tool (adding tiles at the edge)
 *
 * @param center - Brush center coordinate
 * @param radius - Brush radius
 * @returns Array of edge coordinates
 */
export function getBrushEdgeCoords(
  center: HexCoordinate,
  radius: number
): HexCoordinate[] {
  if (radius === 0) {
    return [center];
  }

  const coords = hexesInRadius(center, radius);
  return coords.filter(
    (coord) => hexDistance(center, coord) === radius
  );
}

/**
 * Get coordinates that are in brush range but not in map bounds
 * Useful for resize tool (identifying new tiles to create)
 *
 * @param center - Brush center coordinate
 * @param radius - Brush radius
 * @param existingKeys - Set of existing tile keys
 * @returns Coordinates that would be new
 */
export function getNewTilesInBrush(
  center: HexCoordinate,
  radius: number,
  existingKeys: Set<CoordKey>
): HexCoordinate[] {
  const coords = hexesInRadius(center, radius);
  return coords.filter((coord) => !existingKeys.has(coordToKey(coord)));
}

// ═══════════════════════════════════════════════════════════════
// Neighbor Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Get neighbor coordinates with distances for smooth brush
 *
 * @param coord - Center coordinate
 * @param existingKeys - Set of existing tile keys
 * @returns Neighbor coordinates that exist
 */
export function getExistingNeighbors(
  coord: HexCoordinate,
  existingKeys: Set<CoordKey>
): HexCoordinate[] {
  // Get ring at distance 1
  return hexesInRadius(coord, 1)
    .filter((c) => !(c.q === coord.q && c.r === coord.r))
    .filter((c) => existingKeys.has(coordToKey(c)));
}

// ═══════════════════════════════════════════════════════════════
// Stroke Path Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Deduplicate coordinates in a stroke path
 * Keeps track of already-visited coordinates to avoid double-application
 *
 * @param visited - Set of already visited keys
 * @param newCoords - New coordinates to filter
 * @returns Only coordinates not yet visited
 */
export function filterNewStrokeCoords(
  visited: Set<CoordKey>,
  newCoords: BrushCoord[]
): BrushCoord[] {
  const result: BrushCoord[] = [];

  for (const bc of newCoords) {
    if (!visited.has(bc.key)) {
      visited.add(bc.key);
      result.push(bc);
    }
  }

  return result;
}

/**
 * Create a stroke tracker for accumulating brush coordinates
 */
export function createStrokeTracker(): {
  visited: Set<CoordKey>;
  filter: (coords: BrushCoord[]) => BrushCoord[];
  reset: () => void;
} {
  const visited = new Set<CoordKey>();

  return {
    visited,
    filter: (coords: BrushCoord[]) => filterNewStrokeCoords(visited, coords),
    reset: () => visited.clear(),
  };
}
