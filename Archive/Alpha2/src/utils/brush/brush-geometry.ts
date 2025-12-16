/**
 * Brush Geometry Utilities
 *
 * Coordinate calculations for brush operations.
 *
 * @module utils/brush/brush-geometry
 */

import type { AxialCoord, CoordKey } from '../../schemas';
import { coordsInRadius, axialDistance, coordToKey } from '../hex';

/**
 * Get all coordinates affected by brush at center.
 *
 * @param center - Center coordinate of brush
 * @param radius - Brush radius in hexes
 * @returns Array of coordinates within brush radius
 */
export function getBrushCoords(
    center: AxialCoord,
    radius: number
): AxialCoord[] {
    return coordsInRadius(center, radius);
}

/**
 * Get distances from center for each coordinate.
 *
 * @param center - Center coordinate
 * @param coords - Coordinates to calculate distances for
 * @returns Map of coordinate keys to their distances from center
 */
export function getBrushDistances(
    center: AxialCoord,
    coords: AxialCoord[]
): Map<CoordKey, number> {
    const distances = new Map<CoordKey, number>();
    for (const coord of coords) {
        distances.set(coordToKey(coord), axialDistance(center, coord));
    }
    return distances;
}

/**
 * Get preview data for brush indicator.
 *
 * @param center - Center coordinate
 * @param radius - Brush radius
 * @returns Coords and distances for rendering brush indicator
 */
export function getBrushPreview(
    center: AxialCoord,
    radius: number
): { coords: AxialCoord[]; distances: Map<CoordKey, number> } {
    const coords = getBrushCoords(center, radius);
    const distances = getBrushDistances(center, coords);
    return { coords, distances };
}
