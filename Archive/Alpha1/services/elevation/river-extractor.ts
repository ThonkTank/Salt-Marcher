// src/services/elevation/river-extractor.ts
// River network extraction from flow accumulation
//
// Identifies river segments from flow accumulation and direction data.
// Calculates river order (Strahler number) and width for rendering.

import { configurableLogger } from "@services/logging/configurable-logger";
import { coordToKey, keyToCoord, type CoordKey, type AxialCoord } from "@geometry";
import { calculateRiverWidth, getDownstreamNeighbor } from "./flow-analysis";
import type { FlowAccumulationMap, FlowDirectionMap, RiverSegment, RiverNetwork, RiverExtractionConfig } from "./elevation-types";

const logger = configurableLogger.forModule("river-extractor");

const DEFAULT_CONFIG: RiverExtractionConfig = {
	threshold: 5, // At least 5 upstream hexes
	minWidth: 2,
	maxWidth: 20,
	widthFactor: 2,
};

/**
 * Extract river network from flow data.
 *
 * Identifies all river segments above accumulation threshold and calculates
 * stream order and width for rendering.
 *
 * **Algorithm:**
 * 1. Find all river hexes (accumulation >= threshold)
 * 2. Identify river sources (river hexes with no upstream river neighbors)
 * 3. Trace segments from each source to confluence or pour point
 * 4. Calculate Strahler stream order recursively
 * 5. Calculate width based on accumulation
 *
 * **Performance:** O(n + s) where n = number of hexes, s = number of segments
 *
 * @param flowMap - Flow direction map
 * @param accumulationMap - Flow accumulation map
 * @param config - River extraction configuration
 * @returns River network with all segments
 *
 * @example
 * ```typescript
 * const flowDirs = calculateFlowDirections(elevations);
 * const flowAcc = calculateFlowAccumulation(flowDirs);
 * const riverNetwork = extractRiverNetwork(flowDirs, flowAcc, { threshold: 10 });
 *
 * console.log(`Found ${riverNetwork.segments.length} river segments`);
 * console.log(`Max stream order: ${riverNetwork.maxOrder}`);
 * ```
 */
export function extractRiverNetwork(
	flowMap: FlowDirectionMap,
	accumulationMap: FlowAccumulationMap,
	config: Partial<RiverExtractionConfig> = {}
): RiverNetwork {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const startTime = performance.now();

	logger.info(`Extracting river network (threshold: ${cfg.threshold})...`);

	// Step 1: Identify all river hexes
	const riverHexes = new Set<CoordKey>();
	for (const [hexKey, accumulation] of accumulationMap) {
		if (accumulation >= cfg.threshold) {
			riverHexes.add(hexKey);
		}
	}

	logger.info(`Found ${riverHexes.size} river hexes`);

	// Step 2: Find river sources (river hexes with no upstream river neighbors)
	const sources = findRiverSources(riverHexes, flowMap);
	logger.info(`Found ${sources.length} river sources`);

	// Step 3: Trace all river segments
	const segments: RiverSegment[] = [];
	const processedHexes = new Set<CoordKey>();

	for (const source of sources) {
		traceRiverSegments(
			source,
			riverHexes,
			flowMap,
			accumulationMap,
			processedHexes,
			segments,
			cfg
		);
	}

	// Step 4: Calculate stream order (Strahler number)
	calculateStreamOrders(segments);

	// Step 5: Find max order
	const maxOrder = Math.max(...segments.map((s) => s.order), 0);

	const elapsed = performance.now() - startTime;
	logger.info(
		`Extracted ${segments.length} segments (max order: ${maxOrder}) in ${elapsed.toFixed(1)}ms`
	);

	return {
		segments,
		totalRiverHexes: riverHexes.size,
		maxOrder,
		threshold: cfg.threshold,
	};
}

/**
 * Find river sources (river hexes with no upstream river neighbors).
 *
 * @param riverHexes - Set of all river hex keys
 * @param flowMap - Flow direction map
 * @returns Array of source hex coordinates
 */
function findRiverSources(riverHexes: Set<CoordKey>, flowMap: FlowDirectionMap): AxialCoord[] {
	const sources: AxialCoord[] = [];

	for (const hexKey of riverHexes) {
		const coord = keyToCoord(hexKey);

		// Check if any upstream neighbor is also a river hex
		// (Upstream = hexes that flow INTO this hex)
		let hasUpstreamRiver = false;

		// Check all 6 neighbors to see if they flow into this hex
		for (const [neighborKey, direction] of flowMap) {
			if (direction === undefined) continue;

			const neighborCoord = keyToCoord(neighborKey);
			const downstream = getDownstreamNeighbor(neighborCoord, direction);

			if (downstream && coordToKey(downstream) === hexKey) {
				// This neighbor flows into current hex
				// Check if neighbor is also a river hex
				if (riverHexes.has(neighborKey)) {
					hasUpstreamRiver = true;
					break;
				}
			}
		}

		if (!hasUpstreamRiver) {
			sources.push(coord);
		}
	}

	return sources;
}

/**
 * Trace river segments from a source hex.
 *
 * Follows flow direction downstream, creating new segments at confluences.
 *
 * @param start - Starting hex coordinate
 * @param riverHexes - Set of all river hex keys
 * @param flowMap - Flow direction map
 * @param accumulationMap - Flow accumulation map
 * @param processedHexes - Set of already processed hexes (mutated)
 * @param segments - Array to append new segments to (mutated)
 * @param config - River extraction configuration
 */
function traceRiverSegments(
	start: AxialCoord,
	riverHexes: Set<CoordKey>,
	flowMap: FlowDirectionMap,
	accumulationMap: FlowAccumulationMap,
	processedHexes: Set<CoordKey>,
	segments: RiverSegment[],
	config: RiverExtractionConfig
): void {
	const path: AxialCoord[] = [start];
	let current = start;
	let currentKey = coordToKey(current);

	// Skip if already processed
	if (processedHexes.has(currentKey)) {
		return;
	}

	// Trace downstream until confluence or pour point
	while (true) {
		processedHexes.add(currentKey);

		// Get flow direction
		const direction = flowMap.get(currentKey);
		if (direction === undefined) {
			// Pour point - end segment
			break;
		}

		// Get downstream neighbor
		const downstream = getDownstreamNeighbor(current, direction);
		if (!downstream) {
			// Off-map - end segment
			break;
		}

		const downstreamKey = coordToKey(downstream);

		// Check if downstream is a river hex
		if (!riverHexes.has(downstreamKey)) {
			// River ends here (accumulation drops below threshold)
			break;
		}

		// Check for confluence (multiple rivers flowing into downstream hex)
		const tributaryCount = countTributaries(downstream, riverHexes, flowMap);

		if (tributaryCount > 1) {
			// Confluence - end this segment and process downstream as new source
			path.push(downstream);
			break;
		}

		// Continue tracing
		path.push(downstream);
		current = downstream;
		currentKey = downstreamKey;
	}

	// Create segment
	if (path.length > 0) {
		const startKey = coordToKey(path[0]);
		const endKey = coordToKey(path[path.length - 1]);

		const accStart = accumulationMap.get(startKey) || config.threshold;
		const accEnd = accumulationMap.get(endKey) || config.threshold;

		const segment: RiverSegment = {
			id: `river-${segments.length}`,
			path,
			order: 1, // Will be calculated later
			accumulationStart: accStart,
			accumulationEnd: accEnd,
			widthStart: calculateRiverWidth(accStart, config.minWidth, config.maxWidth, config.widthFactor),
			widthEnd: calculateRiverWidth(accEnd, config.minWidth, config.maxWidth, config.widthFactor),
			tributaryIds: [],
		};

		segments.push(segment);
	}
}

/**
 * Count how many rivers flow into a hex.
 *
 * @param hex - Target hex coordinate
 * @param riverHexes - Set of all river hex keys
 * @param flowMap - Flow direction map
 * @returns Number of upstream river hexes
 */
function countTributaries(hex: AxialCoord, riverHexes: Set<CoordKey>, flowMap: FlowDirectionMap): number {
	const hexKey = coordToKey(hex);
	let count = 0;

	// Check all neighbors to see if they flow into this hex
	for (const [neighborKey, direction] of flowMap) {
		if (direction === undefined) continue;
		if (!riverHexes.has(neighborKey)) continue;

		const neighborCoord = keyToCoord(neighborKey);
		const downstream = getDownstreamNeighbor(neighborCoord, direction);

		if (downstream && coordToKey(downstream) === hexKey) {
			count++;
		}
	}

	return count;
}

/**
 * Calculate Strahler stream order for all segments.
 *
 * Strahler order rules:
 * - Headwater segments: order = 1
 * - When two streams of different order meet: order = max(orders)
 * - When two streams of same order meet: order = order + 1
 *
 * @param segments - Array of river segments (mutated in-place)
 */
function calculateStreamOrders(segments: RiverSegment[]): void {
	// Build segment graph (which segments flow into which)
	const downstreamMap = new Map<CoordKey, string>(); // end coord → segment ID

	for (const segment of segments) {
		const endKey = coordToKey(segment.path[segment.path.length - 1]);
		downstreamMap.set(endKey, segment.id);
	}

	// Find tributaries for each segment
	for (const segment of segments) {
		const startKey = coordToKey(segment.path[0]);
		const downstreamSegmentId = downstreamMap.get(startKey);

		if (downstreamSegmentId) {
			const downstreamSegment = segments.find((s) => s.id === downstreamSegmentId);
			if (downstreamSegment) {
				downstreamSegment.tributaryIds.push(segment.id);
			}
		}
	}

	// Calculate orders recursively (depth-first from sources)
	const orderCache = new Map<string, number>();

	function getOrder(segment: RiverSegment): number {
		// Check cache
		if (orderCache.has(segment.id)) {
			return orderCache.get(segment.id)!;
		}

		// If no tributaries, this is a headwater (order 1)
		if (segment.tributaryIds.length === 0) {
			orderCache.set(segment.id, 1);
			return 1;
		}

		// Get orders of all tributaries
		const tributaryOrders = segment.tributaryIds.map((id) => {
			const trib = segments.find((s) => s.id === id);
			return trib ? getOrder(trib) : 1;
		});

		// Apply Strahler rules
		const maxOrder = Math.max(...tributaryOrders);
		const maxCount = tributaryOrders.filter((o) => o === maxOrder).length;

		const order = maxCount >= 2 ? maxOrder + 1 : maxOrder;

		orderCache.set(segment.id, order);
		return order;
	}

	// Calculate all orders
	for (const segment of segments) {
		segment.order = getOrder(segment);
	}
}

/**
 * Get river network statistics.
 *
 * @param network - River network from extractRiverNetwork()
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getRiverNetworkStats(network);
 * console.log(`${stats.segmentCount} segments`);
 * console.log(`${stats.headwaterCount} headwaters`);
 * console.log(`${stats.mainStemCount} main stems (order ${network.maxOrder})`);
 * ```
 */
export function getRiverNetworkStats(network: RiverNetwork): {
	segmentCount: number;
	totalRiverHexes: number;
	maxOrder: number;
	headwaterCount: number;
	confluenceCount: number;
	mainStemCount: number;
	averageSegmentLength: number;
	longestSegmentLength: number;
} {
	const headwaterCount = network.segments.filter((s) => s.order === 1).length;
	const confluenceCount = network.segments.filter((s) => s.tributaryIds.length > 1).length;
	const mainStemCount = network.segments.filter((s) => s.order === network.maxOrder).length;

	const segmentLengths = network.segments.map((s) => s.path.length);
	const averageLength = segmentLengths.reduce((a, b) => a + b, 0) / segmentLengths.length;
	const longestLength = Math.max(...segmentLengths, 0);

	return {
		segmentCount: network.segments.length,
		totalRiverHexes: network.totalRiverHexes,
		maxOrder: network.maxOrder,
		headwaterCount,
		confluenceCount,
		mainStemCount,
		averageSegmentLength: averageLength,
		longestSegmentLength: longestLength,
	};
}
