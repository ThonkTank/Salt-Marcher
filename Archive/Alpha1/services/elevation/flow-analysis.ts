// src/services/elevation/flow-analysis.ts
// Flow direction and accumulation calculations for river generation
//
// This module combines two related algorithms:
// 1. Flow Direction: Determines which direction water flows from each hex
// 2. Flow Accumulation: Calculates how many hexes drain through each hex

import { configurableLogger } from "@services/logging/configurable-logger";
import { coordToKey, keyToCoord, neighbors, type CoordKey, type AxialCoord } from "@geometry";
import type { FlowDirectionMap, FlowDirectionConfig, FlowAccumulationMap, FlowAccumulationConfig } from "./elevation-types";

const logger = configurableLogger.forModule("flow-analysis");

// ============================================================================
// Flow Direction
// ============================================================================

const DEFAULT_FLOW_DIRECTION_CONFIG: FlowDirectionConfig = {
	minSlope: 0.1, // 10cm minimum slope
	defaultElevation: 0, // Sea level
	useRandomWalkForFlats: true,
	randomSeed: undefined, // Use Math.random() if not provided
};

/**
 * Calculate flow directions from elevation data.
 *
 * Determines which direction water flows from each hex using D8 algorithm:
 * - Choose neighbor with steepest descent
 * - If no downslope neighbor, mark as local minimum (pour point)
 * - Handle flat areas with optional random walk
 *
 * **Algorithm:**
 * 1. For each hex: Compare elevation to all 6 neighbors
 * 2. Find neighbor with maximum descent (lowest elevation)
 * 3. If descent > minSlope, store direction to that neighbor
 * 4. Otherwise, mark as undefined (no flow)
 *
 * **Performance:** O(n) where n = number of hexes
 *
 * @param elevationMap - Elevation per hex (sparse, only painted hexes)
 * @param config - Flow direction configuration
 * @returns Map of hex → flow direction (0-5, or undefined for no flow)
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
 * const flowDirs = calculateFlowDirections(elevations);
 * flowDirs.get("0,0") // => direction to "1,0" (downslope)
 * flowDirs.get("4,0") // => undefined (pour point, no downslope)
 * ```
 */
export function calculateFlowDirections(
	elevationMap: ReadonlyMap<CoordKey, number>,
	config: Partial<FlowDirectionConfig> = {}
): FlowDirectionMap {
	const cfg = { ...DEFAULT_FLOW_DIRECTION_CONFIG, ...config };
	const startTime = performance.now();

	logger.info(`Calculating flow directions for ${elevationMap.size} hexes...`);

	const flowMap = new Map<CoordKey, number | undefined>();
	const rng = cfg.randomSeed !== undefined ? createSeededRNG(cfg.randomSeed) : Math.random;

	for (const [key, elevation] of elevationMap) {
		const coord = keyToCoord(key);
		const neighborCoords = neighbors(coord);

		// Find neighbor with steepest descent
		let steepestDir: number | undefined = undefined;
		let maxDescent = cfg.minSlope; // Must exceed minimum slope

		for (let dir = 0; dir < 6; dir++) {
			const neighbor = neighborCoords[dir];
			const neighborKey = coordToKey(neighbor);
			const neighborElevation = elevationMap.get(neighborKey) ?? cfg.defaultElevation;

			const descent = elevation - neighborElevation;

			if (descent > maxDescent) {
				maxDescent = descent;
				steepestDir = dir;
			} else if (descent === maxDescent && steepestDir !== undefined && cfg.useRandomWalkForFlats) {
				// Tie-breaking: Random walk for flat areas
				if (rng() < 0.5) {
					steepestDir = dir;
				}
			}
		}

		flowMap.set(key, steepestDir);
	}

	const elapsed = performance.now() - startTime;
	const flowCount = Array.from(flowMap.values()).filter((dir) => dir !== undefined).length;
	logger.info(
		`Calculated ${flowCount}/${elevationMap.size} flow directions in ${elapsed.toFixed(1)}ms`
	);

	return flowMap;
}

/**
 * Get the neighbor coordinate in the flow direction.
 *
 * @param coord - Starting hex
 * @param direction - Flow direction (0-5, or undefined)
 * @returns Neighbor coordinate, or undefined if no flow
 *
 * @example
 * ```typescript
 * const flowDirs = calculateFlowDirections(elevations);
 * const direction = flowDirs.get("5,10");
 *
 * if (direction !== undefined) {
 *   const downstream = getDownstreamNeighbor({ q: 5, r: 10 }, direction);
 *   console.log("Water flows to:", downstream);
 * }
 * ```
 */
export function getDownstreamNeighbor(coord: AxialCoord, direction: number | undefined): AxialCoord | undefined {
	if (direction === undefined || direction < 0 || direction > 5) {
		return undefined;
	}

	const neighborCoords = neighbors(coord);
	return neighborCoords[direction];
}

/**
 * Trace flow path from a starting hex to a pour point.
 *
 * Follows flow directions downslope until reaching:
 * - A pour point (no flow direction)
 * - Maximum path length (cycle detection)
 * - Off-map edge
 *
 * @param start - Starting hex coordinate
 * @param flowMap - Flow direction map
 * @param maxSteps - Maximum path length (prevents infinite loops)
 * @returns Array of coordinates from start to pour point
 *
 * @example
 * ```typescript
 * const flowDirs = calculateFlowDirections(elevations);
 * const path = traceFlowPath({ q: 0, r: 0 }, flowDirs);
 * // => [{ q: 0, r: 0 }, { q: 1, r: 0 }, ..., { q: 4, r: 0 }]
 * console.log(`River flows ${path.length} hexes to sea`);
 * ```
 */
export function traceFlowPath(
	start: AxialCoord,
	flowMap: FlowDirectionMap,
	maxSteps: number = 1000
): AxialCoord[] {
	const path: AxialCoord[] = [start];
	let current = start;

	for (let step = 0; step < maxSteps; step++) {
		const currentKey = coordToKey(current);
		const direction = flowMap.get(currentKey);

		// Stop if no flow direction (pour point)
		if (direction === undefined) {
			break;
		}

		// Get downstream neighbor
		const downstream = getDownstreamNeighbor(current, direction);

		// Stop if off-map
		if (downstream === undefined) {
			break;
		}

		// Cycle detection: Check if we've visited this hex before
		const downstreamKey = coordToKey(downstream);
		if (path.some((coord) => coordToKey(coord) === downstreamKey)) {
			logger.warn(`Cycle detected at ${downstreamKey}`);
			break;
		}

		path.push(downstream);
		current = downstream;
	}

	return path;
}

/**
 * Get flow direction statistics.
 *
 * @param flowMap - Flow direction map
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getFlowDirectionStats(flowMap);
 * console.log(`${stats.pourPointCount} pour points`);
 * console.log(`${stats.flowingHexCount} flowing hexes`);
 * ```
 */
export function getFlowDirectionStats(flowMap: FlowDirectionMap): {
	totalHexes: number;
	flowingHexCount: number;
	pourPointCount: number;
	directionDistribution: number[];
} {
	const directionCounts = [0, 0, 0, 0, 0, 0]; // 6 directions
	let pourPointCount = 0;
	let flowingHexCount = 0;

	for (const direction of flowMap.values()) {
		if (direction === undefined) {
			pourPointCount++;
		} else {
			flowingHexCount++;
			directionCounts[direction]++;
		}
	}

	return {
		totalHexes: flowMap.size,
		flowingHexCount,
		pourPointCount,
		directionDistribution: directionCounts,
	};
}

/**
 * Create seeded random number generator (Mulberry32).
 *
 * Provides deterministic randomness for reproducible results.
 *
 * @param seed - Seed value (32-bit integer)
 * @returns RNG function (0.0 to 1.0)
 */
function createSeededRNG(seed: number): () => number {
	let state = seed;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ============================================================================
// Flow Accumulation
// ============================================================================

const DEFAULT_FLOW_ACCUMULATION_CONFIG: FlowAccumulationConfig = {
	includePrecipitation: false,
	basePrecipitation: 1.0, // Each hex contributes 1 unit of flow
};

/**
 * Calculate flow accumulation from flow directions.
 *
 * Determines how many upstream hexes drain through each hex.
 * Uses topological sort to process hexes from headwaters to outlets.
 *
 * **Algorithm:**
 * 1. Build reverse flow graph (which hexes flow INTO this hex)
 * 2. Topological sort: Process hexes from sources (no inflow) to sinks (pour points)
 * 3. For each hex: accumulation = 1 (self) + sum(upstream accumulations)
 *
 * **Performance:** O(n) where n = number of hexes
 *
 * @param flowMap - Flow direction map
 * @param config - Flow accumulation configuration
 * @returns Map of hex → accumulated flow
 *
 * @example
 * ```typescript
 * const flowDirs = calculateFlowDirections(elevations);
 * const flowAcc = calculateFlowAccumulation(flowDirs);
 *
 * flowAcc.get("0,0") // => 1 (headwater, only self)
 * flowAcc.get("4,0") // => 5 (pour point, entire watershed drains here)
 * ```
 */
export function calculateFlowAccumulation(
	flowMap: FlowDirectionMap,
	config: Partial<FlowAccumulationConfig> = {}
): FlowAccumulationMap {
	const cfg = { ...DEFAULT_FLOW_ACCUMULATION_CONFIG, ...config };
	const startTime = performance.now();

	logger.info(`Calculating flow accumulation for ${flowMap.size} hexes...`);

	// Step 1: Build reverse flow graph (inflow edges)
	const inflowMap = buildInflowMap(flowMap);

	// Step 2: Topological sort (sources → sinks)
	const sortedHexes = topologicalSort(flowMap, inflowMap);

	// Step 3: Accumulate flow from upstream to downstream
	const accumulationMap = new Map<CoordKey, number>();

	for (const hexKey of sortedHexes) {
		// Start with base precipitation (self contribution)
		let accumulation = cfg.basePrecipitation;

		// Add contributions from all upstream neighbors
		const inflowKeys = inflowMap.get(hexKey) || [];
		for (const inflowKey of inflowKeys) {
			const upstreamAccumulation = accumulationMap.get(inflowKey) || 0;
			accumulation += upstreamAccumulation;
		}

		accumulationMap.set(hexKey, accumulation);
	}

	const elapsed = performance.now() - startTime;
	logger.info(`Calculated accumulation in ${elapsed.toFixed(1)}ms`);

	return accumulationMap;
}

/**
 * Build reverse flow graph (inflow edges).
 *
 * For each hex, store which hexes flow INTO it.
 *
 * @param flowMap - Flow direction map
 * @returns Map of hex → array of upstream hex keys
 */
function buildInflowMap(flowMap: FlowDirectionMap): Map<CoordKey, CoordKey[]> {
	const inflowMap = new Map<CoordKey, CoordKey[]>();

	// Initialize all hexes with empty inflow arrays
	for (const hexKey of flowMap.keys()) {
		inflowMap.set(hexKey, []);
	}

	// Build reverse edges
	for (const [hexKey, direction] of flowMap) {
		if (direction === undefined) {
			// Pour point - no outflow
			continue;
		}

		const hexCoord = keyToCoord(hexKey);
		const downstream = getDownstreamNeighbor(hexCoord, direction);

		if (downstream) {
			const downstreamKey = coordToKey(downstream);

			// Add this hex as inflow to downstream neighbor
			if (!inflowMap.has(downstreamKey)) {
				inflowMap.set(downstreamKey, []);
			}
			inflowMap.get(downstreamKey)!.push(hexKey);
		}
	}

	return inflowMap;
}

/**
 * Topological sort of hexes (sources → sinks).
 *
 * Processes hexes in upstream-to-downstream order using Kahn's algorithm:
 * 1. Start with all source hexes (no inflow)
 * 2. Process each source: Remove it and decrement downstream in-degree
 * 3. When downstream in-degree reaches 0, it becomes a source
 * 4. Repeat until all hexes processed
 *
 * @param flowMap - Flow direction map
 * @param inflowMap - Reverse flow graph
 * @returns Array of hex keys in topological order
 */
function topologicalSort(flowMap: FlowDirectionMap, inflowMap: Map<CoordKey, CoordKey[]>): CoordKey[] {
	// Calculate in-degree for each hex (number of upstream neighbors)
	const inDegree = new Map<CoordKey, number>();

	for (const [hexKey, inflows] of inflowMap) {
		inDegree.set(hexKey, inflows.length);
	}

	// Find all source hexes (in-degree = 0)
	const queue: CoordKey[] = [];
	for (const [hexKey, degree] of inDegree) {
		if (degree === 0) {
			queue.push(hexKey);
		}
	}

	// Process hexes in topological order
	const sorted: CoordKey[] = [];

	while (queue.length > 0) {
		const current = queue.shift()!;
		sorted.push(current);

		// Get downstream neighbor
		const direction = flowMap.get(current);
		if (direction !== undefined) {
			const currentCoord = keyToCoord(current);
			const downstream = getDownstreamNeighbor(currentCoord, direction);

			if (downstream) {
				const downstreamKey = coordToKey(downstream);

				// Decrement in-degree
				const currentDegree = inDegree.get(downstreamKey) || 0;
				inDegree.set(downstreamKey, currentDegree - 1);

				// If in-degree reaches 0, add to queue
				if (currentDegree - 1 === 0) {
					queue.push(downstreamKey);
				}
			}
		}
	}

	// Cycle detection: If not all hexes were sorted, there's a cycle
	if (sorted.length < flowMap.size) {
		logger.warn(
			`Cycle detected - only sorted ${sorted.length}/${flowMap.size} hexes`
		);
	}

	return sorted;
}

/**
 * Get flow accumulation statistics.
 *
 * @param accumulationMap - Flow accumulation map
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getFlowAccumulationStats(accumulationMap);
 * console.log(`Max accumulation: ${stats.maxAccumulation}`);
 * console.log(`Average: ${stats.averageAccumulation.toFixed(1)}`);
 * ```
 */
export function getFlowAccumulationStats(accumulationMap: FlowAccumulationMap): {
	totalHexes: number;
	minAccumulation: number;
	maxAccumulation: number;
	averageAccumulation: number;
	maxAccumulationHex: CoordKey | null;
} {
	let min = Infinity;
	let max = 0;
	let sum = 0;
	let maxHex: CoordKey | null = null;

	for (const [hexKey, accumulation] of accumulationMap) {
		if (accumulation < min) min = accumulation;
		if (accumulation > max) {
			max = accumulation;
			maxHex = hexKey;
		}
		sum += accumulation;
	}

	return {
		totalHexes: accumulationMap.size,
		minAccumulation: min === Infinity ? 0 : min,
		maxAccumulation: max,
		averageAccumulation: sum / accumulationMap.size,
		maxAccumulationHex: maxHex,
	};
}

/**
 * Get all hexes with accumulation above threshold.
 *
 * Useful for river network extraction.
 *
 * @param accumulationMap - Flow accumulation map
 * @param threshold - Minimum accumulation to include
 * @returns Array of hex coordinates
 *
 * @example
 * ```typescript
 * const riverHexes = getHexesAboveThreshold(accumulationMap, 10);
 * console.log(`Found ${riverHexes.length} river hexes`);
 * ```
 */
export function getHexesAboveThreshold(
	accumulationMap: FlowAccumulationMap,
	threshold: number
): AxialCoord[] {
	const hexes: AxialCoord[] = [];

	for (const [hexKey, accumulation] of accumulationMap) {
		if (accumulation >= threshold) {
			hexes.push(keyToCoord(hexKey));
		}
	}

	return hexes;
}

/**
 * Calculate river width from accumulation.
 *
 * Uses logarithmic scaling for realistic river width progression.
 *
 * @param accumulation - Flow accumulation value
 * @param minWidth - Minimum river width (pixels)
 * @param maxWidth - Maximum river width (pixels)
 * @param widthFactor - Scaling factor (higher = wider rivers)
 * @returns River width in pixels
 *
 * @example
 * ```typescript
 * calculateRiverWidth(1, 2, 20, 2)   // => 2 (headwater)
 * calculateRiverWidth(10, 2, 20, 2)  // => ~8.6 (small stream)
 * calculateRiverWidth(100, 2, 20, 2) // => ~15.3 (river)
 * calculateRiverWidth(1000, 2, 20, 2) // => ~20 (major river, capped)
 * ```
 */
export function calculateRiverWidth(
	accumulation: number,
	minWidth: number = 2,
	maxWidth: number = 20,
	widthFactor: number = 2
): number {
	// Logarithmic scaling: width = minWidth + log2(accumulation) * widthFactor
	const width = minWidth + Math.log2(Math.max(1, accumulation)) * widthFactor;

	// Clamp to min/max
	return Math.min(Math.max(width, minWidth), maxWidth);
}
