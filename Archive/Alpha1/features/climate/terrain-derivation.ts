/**
 * Terrain Derivation Module
 *
 * Calculates terrain type based on elevation RELATIVE to neighbors.
 * This produces more natural transitions (hills between plains and mountains)
 * compared to absolute thresholds alone.
 *
 * Algorithm:
 * 1. Get current hex elevation
 * 2. Calculate average neighbor elevation (skip undefined)
 * 3. Compare difference: myElev - avgNeighbor
 * 4. Apply relative thresholds OR absolute thresholds
 *    - Mountains: 300m above neighbors OR elevation >= 1500m
 *    - Hills: 100m above neighbors OR elevation >= 500m
 *    - Plains: Otherwise
 *
 * Edge case handling:
 * - No neighbors with elevation: Use absolute thresholds only
 * - Manual overrides: Skip tiles with derivations.terrain.source === 'manual'
 *
 * @module features/climate/terrain-derivation
 */

import type { AxialCoord } from "@geometry";
import { neighbors } from "@geometry";
import type { TileData, DerivationSource } from "@services/domain/tile-types";
import type { TerrainType } from "@services/domain/terrain-types";

/* ---- Constants ---- */

/**
 * Minimum elevation difference above neighbors to classify as mountains (meters)
 */
export const MOUNTAIN_RELATIVE_THRESHOLD = 300;

/**
 * Minimum elevation difference above neighbors to classify as hills (meters)
 */
export const HILL_RELATIVE_THRESHOLD = 100;

/**
 * Absolute elevation threshold for mountains (meters)
 * Used as fallback when no neighbor data available
 */
export const MOUNTAIN_ABSOLUTE_THRESHOLD = 1500;

/**
 * Absolute elevation threshold for hills (meters)
 * Used as fallback when no neighbor data available
 */
export const HILL_ABSOLUTE_THRESHOLD = 500;

/* ---- Core Derivation ---- */

/**
 * Derive terrain type based on elevation relative to neighbors.
 *
 * Combines relative and absolute thresholds:
 * - Mountains: 300m above neighbors OR elevation >= 1500m
 * - Hills: 100m above neighbors OR elevation >= 500m
 * - Plains: Otherwise
 *
 * Falls back to absolute thresholds if no neighbors have elevation data.
 *
 * @param coord - Hex coordinate
 * @param getElevation - Function to look up elevation for any coordinate
 * @returns Derived terrain type
 *
 * @example
 * ```typescript
 * const elevationMap = new Map([
 *   ["5,10", 1200],
 *   ["5,11", 800],
 *   ["6,10", 900],
 * ]);
 *
 * const getTileElev = (c: AxialCoord) => elevationMap.get(`${c.q},${c.r}`);
 * const terrain = deriveTerrain({ q: 5, r: 10 }, getTileElev);
 * // => "mountains" (1200m, 350m above neighbors)
 * ```
 */
export function deriveTerrain(
	coord: AxialCoord,
	getElevation: (c: AxialCoord) => number | undefined
): TerrainType {
	const myElevation = getElevation(coord);

	// No elevation data: default to plains
	if (myElevation === undefined) {
		return "plains";
	}

	// Get neighbor elevations
	const neighborCoords = neighbors(coord);
	const neighborElevations = neighborCoords
		.map((n) => getElevation(n))
		.filter((elev): elev is number => elev !== undefined);

	// No neighbors with elevation: use absolute thresholds only
	if (neighborElevations.length === 0) {
		if (myElevation >= MOUNTAIN_ABSOLUTE_THRESHOLD) return "mountains";
		if (myElevation >= HILL_ABSOLUTE_THRESHOLD) return "hills";
		return "plains";
	}

	// Calculate average neighbor elevation
	const avgNeighborElevation =
		neighborElevations.reduce((sum, elev) => sum + elev, 0) / neighborElevations.length;

	const difference = myElevation - avgNeighborElevation;

	// Apply combined relative + absolute thresholds
	if (difference > MOUNTAIN_RELATIVE_THRESHOLD || myElevation >= MOUNTAIN_ABSOLUTE_THRESHOLD) {
		return "mountains";
	}
	if (difference > HILL_RELATIVE_THRESHOLD || myElevation >= HILL_ABSOLUTE_THRESHOLD) {
		return "hills";
	}
	return "plains";
}

/* ---- Batch Operations ---- */

/**
 * Input for single-tile terrain derivation
 */
export interface TerrainDerivationInput {
	coord: AxialCoord;
	tile: TileData;
}

/**
 * Result of single-tile terrain derivation
 */
export interface TerrainDerivationResult {
	coord: AxialCoord;
	terrain?: { value: TerrainType; source: "auto" };
}

/**
 * Derive terrain for a single tile (respects manual overrides).
 *
 * @param input - Coordinate and tile data
 * @param getElevation - Function to look up elevation for any coordinate
 * @returns Derivation result with auto-generated terrain (or undefined if skipped)
 *
 * @example
 * ```typescript
 * const result = deriveTerrainForTile(
 *   { coord: { q: 5, r: 10 }, tile: { elevation: 1200 } },
 *   getTileElev
 * );
 * // => { coord: { q: 5, r: 10 }, terrain: { value: "mountains", source: "auto" } }
 * ```
 */
export function deriveTerrainForTile(
	input: TerrainDerivationInput,
	getElevation: (c: AxialCoord) => number | undefined
): TerrainDerivationResult {
	const { coord, tile } = input;

	// Skip if manually set
	if (tile.derivations?.terrain?.source === "manual") {
		return { coord };
	}

	// Skip if no elevation data
	if (tile.elevation === undefined) {
		return { coord };
	}

	const terrainType = deriveTerrain(coord, getElevation);

	return {
		coord,
		terrain: { value: terrainType, source: "auto" },
	};
}

/**
 * Derive terrain for all tiles in a map (batch operation).
 *
 * Respects manual overrides and skips tiles without elevation data.
 *
 * @param tiles - Map of tile data (key = coordinate string)
 * @param coordKeyFn - Optional function to generate coordinate keys (default: "r,c")
 * @returns Array of derivation results (only tiles that were processed)
 *
 * @example
 * ```typescript
 * const tiles = new Map([
 *   ["5,10", { elevation: 1200 }],
 *   ["5,11", { elevation: 800 }],
 * ]);
 *
 * const results = deriveTerrainForMap(tiles);
 * // => [
 * //   { coord: { q: 5, r: 10 }, terrain: { value: "mountains", source: "auto" } },
 * //   { coord: { q: 5, r: 11 }, terrain: { value: "hills", source: "auto" } }
 * // ]
 * ```
 */
export function deriveTerrainForMap(
	tiles: Map<string, TileData>,
	coordKeyFn: (coord: AxialCoord) => string = coordKey
): TerrainDerivationResult[] {
	// Build elevation lookup from map
	const getElevation = (coord: AxialCoord): number | undefined => {
		const key = coordKeyFn(coord);
		return tiles.get(key)?.elevation;
	};

	// Process all tiles
	const results: TerrainDerivationResult[] = [];

	for (const [key, tile] of tiles.entries()) {
		// Parse coordinate from key (assumes "r,c" format)
		const coord = parseCoordKey(key);
		if (!coord) continue; // Skip invalid keys

		const result = deriveTerrainForTile({ coord, tile }, getElevation);

		// Only include tiles that were actually processed
		if (result.terrain !== undefined) {
			results.push(result);
		}
	}

	return results;
}

/* ---- Analysis Functions ---- */

/**
 * Detailed analysis of terrain derivation for a single hex.
 *
 * Useful for debugging, UI tooltips, or understanding why a terrain was chosen.
 */
export interface TerrainAnalysis {
	coord: AxialCoord;
	elevation: number;
	neighborCount: number;
	avgNeighborElevation: number;
	difference: number;
	derivedTerrain: TerrainType;
}

/**
 * Analyze terrain derivation for a single hex (returns detailed statistics).
 *
 * @param coord - Hex coordinate
 * @param getElevation - Function to look up elevation for any coordinate
 * @returns Analysis data (or null if no elevation data)
 *
 * @example
 * ```typescript
 * const analysis = analyzeTerrainDerivation({ q: 10, r: 5 }, getTileElev);
 * // => {
 * //   coord: { q: 10, r: 5 },
 * //   elevation: 1200,
 * //   neighborCount: 4,
 * //   avgNeighborElevation: 850,
 * //   difference: 350,
 * //   derivedTerrain: "mountains"
 * // }
 * ```
 */
export function analyzeTerrainDerivation(
	coord: AxialCoord,
	getElevation: (c: AxialCoord) => number | undefined
): TerrainAnalysis | null {
	const elevation = getElevation(coord);

	if (elevation === undefined) {
		return null;
	}

	// Get neighbor elevations
	const neighborCoords = neighbors(coord);
	const neighborElevations = neighborCoords
		.map((n) => getElevation(n))
		.filter((elev): elev is number => elev !== undefined);

	const neighborCount = neighborElevations.length;
	const avgNeighborElevation =
		neighborCount > 0
			? neighborElevations.reduce((sum, elev) => sum + elev, 0) / neighborCount
			: 0;

	const difference = elevation - avgNeighborElevation;
	const derivedTerrain = deriveTerrain(coord, getElevation);

	return {
		coord,
		elevation,
		neighborCount,
		avgNeighborElevation,
		difference,
		derivedTerrain,
	};
}

/* ---- Utility Functions ---- */

/**
 * Standard coordinate key format (q,r)
 */
function coordKey(coord: AxialCoord): string {
	return `${coord.q},${coord.r}`;
}

/**
 * Parse coordinate from key string (q,r format)
 *
 * @param key - Coordinate key string
 * @returns Parsed coordinate (or null if invalid)
 */
function parseCoordKey(key: string): AxialCoord | null {
	const parts = key.split(",");
	if (parts.length !== 2) return null;

	const q = parseInt(parts[0], 10);
	const r = parseInt(parts[1], 10);

	if (isNaN(q) || isNaN(r)) return null;

	return { q, r };
}
