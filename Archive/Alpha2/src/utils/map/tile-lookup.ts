/**
 * Tile Lookup Utilities
 *
 * Helper functions for looking up tile data from coordinate maps.
 * Centralizes the common pattern of position → key → tile lookup.
 *
 * @module utils/map/tile-lookup
 */

import type { AxialCoord, CoordKey } from '../../schemas';
import type { TileData } from '../../schemas/map';
import { coordToKey } from '../hex';

/**
 * Get tile at a specific coordinate.
 * @param coord - The axial coordinate to look up
 * @param tiles - The tile map to search
 * @returns The tile data or undefined if not found
 */
export function getTileAt(
	coord: AxialCoord,
	tiles: Map<CoordKey, TileData>
): TileData | undefined {
	return tiles.get(coordToKey(coord));
}

/**
 * Get terrain type at a specific coordinate.
 * @param coord - The axial coordinate to look up
 * @param tiles - The tile map to search
 * @param fallback - Fallback terrain type if tile not found (default: 'grassland')
 * @returns The terrain type string
 */
export function getTerrainAt(
	coord: AxialCoord,
	tiles: Map<CoordKey, TileData>,
	fallback = 'grassland'
): string {
	return getTileAt(coord, tiles)?.terrain ?? fallback;
}
