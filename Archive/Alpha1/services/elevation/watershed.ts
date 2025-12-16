// src/services/elevation/watershed.ts
// Watershed calculation for river generation
//
// Implements watershed analysis to identify drainage basins - regions where
// all water flows to a common pour point (outlet).

import { configurableLogger } from "@services/logging/configurable-logger";
import { coordToKey, keyToCoord, neighbors, type CoordKey, type AxialCoord } from "@geometry";
import type { WatershedMap, WatershedConfig } from "./elevation-types";

const logger = configurableLogger.forModule("watershed-calculator");

const DEFAULT_CONFIG: WatershedConfig = {
	minElevationDiff: 0.1, // 10cm minimum slope
	defaultElevation: 0, // Sea level
};

/**
 * Calculate watersheds from elevation data.
 *
 * Identifies drainage basins where all water flows to a common outlet.
 * Uses flood-fill algorithm starting from pour points (local minima).
 *
 * **Algorithm:**
 * 1. Identify pour points: Hexes with no downslope neighbors
 * 2. Flood-fill from each pour point upslope (priority queue by elevation)
 * 3. Assign watershed IDs to all hexes in each basin
 *
 * **Performance:** O(n log n) where n = number of hexes
 * - Finding pour points: O(n)
 * - Flood-fill with priority queue: O(n log n)
 *
 * @param elevationMap - Elevation per hex (sparse, only painted hexes)
 * @param config - Watershed configuration
 * @returns Map of hex → watershed ID
 *
 * @example
 * ```typescript
 * const elevations = new Map([
 *   ["0,0", 100],  // Mountain peak
 *   ["1,0", 80],   // Upper slope
 *   ["2,0", 50],   // Mid slope
 *   ["3,0", 10],   // Lower slope
 *   ["4,0", 0],    // Pour point (sea level)
 * ]);
 *
 * const watersheds = calculateWatersheds(elevations);
 * // All hexes get same watershed ID (single drainage basin)
 * watersheds.get("0,0") === watersheds.get("4,0") // true
 * ```
 */
export function calculateWatersheds(
	elevationMap: ReadonlyMap<CoordKey, number>,
	config: Partial<WatershedConfig> = {}
): WatershedMap {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const startTime = performance.now();

	logger.info(`[watershed] Calculating watersheds for ${elevationMap.size} hexes...`);

	// Step 1: Find pour points (local minima)
	const pourPoints = findPourPoints(elevationMap, cfg);
	logger.info(`[watershed] Found ${pourPoints.length} pour points`);

	if (pourPoints.length === 0) {
		logger.warn("[watershed] No pour points found - all hexes at same elevation?");
		return new Map();
	}

	// Step 2: Flood-fill from each pour point
	const watershedMap = new Map<CoordKey, string>();

	for (let i = 0; i < pourPoints.length; i++) {
		const pourPoint = pourPoints[i];
		const watershedId = `watershed-${i}`;

		floodFillWatershed(pourPoint, watershedId, elevationMap, watershedMap, cfg);
	}

	const elapsed = performance.now() - startTime;
	logger.info(
		`[watershed] Calculated ${watershedMap.size} hexes in ${elapsed.toFixed(1)}ms (${pourPoints.length} watersheds)`
	);

	return watershedMap;
}

/**
 * Find pour points (local elevation minima).
 *
 * A pour point is a hex where water can exit the system:
 * - No downslope neighbors (all neighbors are higher)
 * - OR edge of painted area (water flows off-map)
 *
 * @param elevationMap - Elevation per hex
 * @param config - Watershed configuration
 * @returns Array of pour point coordinates
 */
function findPourPoints(elevationMap: ReadonlyMap<CoordKey, number>, config: WatershedConfig): AxialCoord[] {
	const pourPoints: AxialCoord[] = [];

	for (const [key, elevation] of elevationMap) {
		const coord = keyToCoord(key);
		const neighborCoords = neighbors(coord);

		// Check if any neighbor is lower (downslope)
		let hasDownslopeNeighbor = false;

		for (const neighbor of neighborCoords) {
			const neighborKey = coordToKey(neighbor);
			const neighborElevation = elevationMap.get(neighborKey);

			if (neighborElevation === undefined) {
				// Neighbor is unpainted - assume default elevation (sea level)
				// If current hex is above sea level, this counts as downslope
				if (elevation > config.defaultElevation + config.minElevationDiff) {
					hasDownslopeNeighbor = true;
					break;
				}
			} else {
				// Check if neighbor is significantly lower
				if (neighborElevation < elevation - config.minElevationDiff) {
					hasDownslopeNeighbor = true;
					break;
				}
			}
		}

		// If no downslope neighbor, this is a pour point
		if (!hasDownslopeNeighbor) {
			pourPoints.push(coord);
		}
	}

	return pourPoints;
}

/**
 * Flood-fill watershed from pour point upslope.
 *
 * Uses priority queue to expand from lowest to highest elevation.
 * Ensures each hex is assigned to the nearest pour point (by elevation).
 *
 * @param pourPoint - Starting point (lowest elevation in watershed)
 * @param watershedId - ID to assign to all hexes in this watershed
 * @param elevationMap - Elevation per hex
 * @param watershedMap - Output map (mutated in-place)
 * @param config - Watershed configuration
 */
function floodFillWatershed(
	pourPoint: AxialCoord,
	watershedId: string,
	elevationMap: ReadonlyMap<CoordKey, number>,
	watershedMap: Map<CoordKey, string>,
	config: WatershedConfig
): void {
	// Priority queue: [elevation, coord]
	// Process lowest elevation first (expand upslope)
	const queue: Array<[number, AxialCoord]> = [];

	const pourPointKey = coordToKey(pourPoint);
	const pourPointElevation = elevationMap.get(pourPointKey);

	if (pourPointElevation === undefined) {
		logger.warn(`[watershed] Pour point ${pourPointKey} has no elevation data - skipping`);
		return;
	}

	// Start at pour point
	queue.push([pourPointElevation, pourPoint]);
	watershedMap.set(pourPointKey, watershedId);

	// Flood-fill upslope
	while (queue.length > 0) {
		// Get lowest elevation hex from queue (simple sort - can optimize with heap later)
		queue.sort((a, b) => a[0] - b[0]);
		const [currentElevation, current] = queue.shift()!;
		const currentKey = coordToKey(current);

		// Check all neighbors
		const neighborCoords = neighbors(current);

		for (const neighbor of neighborCoords) {
			const neighborKey = coordToKey(neighbor);

			// Skip if already assigned to a watershed
			if (watershedMap.has(neighborKey)) {
				continue;
			}

			// Skip if no elevation data (unpainted)
			const neighborElevation = elevationMap.get(neighborKey);
			if (neighborElevation === undefined) {
				continue;
			}

			// Skip if neighbor is significantly lower (would be a different watershed)
			// This prevents crossing watershed boundaries
			if (neighborElevation < currentElevation - config.minElevationDiff) {
				continue;
			}

			// Assign to this watershed
			watershedMap.set(neighborKey, watershedId);

			// Add to queue for further expansion
			queue.push([neighborElevation, neighbor]);
		}
	}
}

/**
 * Get statistics about calculated watersheds.
 *
 * @param watershedMap - Watershed map from calculateWatersheds()
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getWatershedStats(watershedMap);
 * console.log(`${stats.watershedCount} watersheds`);
 * console.log(`Largest: ${stats.largestWatershedSize} hexes`);
 * ```
 */
export function getWatershedStats(watershedMap: WatershedMap): {
	watershedCount: number;
	totalHexes: number;
	largestWatershedId: string | null;
	largestWatershedSize: number;
	smallestWatershedId: string | null;
	smallestWatershedSize: number;
	averageWatershedSize: number;
} {
	const watershedSizes = new Map<string, number>();

	// Count hexes per watershed
	for (const watershedId of watershedMap.values()) {
		watershedSizes.set(watershedId, (watershedSizes.get(watershedId) || 0) + 1);
	}

	// Find largest and smallest
	let largestId: string | null = null;
	let largestSize = 0;
	let smallestId: string | null = null;
	let smallestSize = Infinity;

	for (const [id, size] of watershedSizes) {
		if (size > largestSize) {
			largestSize = size;
			largestId = id;
		}
		if (size < smallestSize) {
			smallestSize = size;
			smallestId = id;
		}
	}

	return {
		watershedCount: watershedSizes.size,
		totalHexes: watershedMap.size,
		largestWatershedId: largestId,
		largestWatershedSize: largestSize,
		smallestWatershedId: smallestId,
		smallestWatershedSize: smallestSize === Infinity ? 0 : smallestSize,
		averageWatershedSize: watershedMap.size / watershedSizes.size,
	};
}

/**
 * Get all hexes in a specific watershed.
 *
 * @param watershedMap - Watershed map from calculateWatersheds()
 * @param watershedId - ID of watershed to extract
 * @returns Array of coordinates in the watershed
 *
 * @example
 * ```typescript
 * const hexes = getHexesInWatershed(watershedMap, "watershed-0");
 * console.log(`Watershed contains ${hexes.length} hexes`);
 * ```
 */
export function getHexesInWatershed(watershedMap: WatershedMap, watershedId: string): AxialCoord[] {
	const hexes: AxialCoord[] = [];

	for (const [key, id] of watershedMap) {
		if (id === watershedId) {
			hexes.push(keyToCoord(key));
		}
	}

	return hexes;
}
