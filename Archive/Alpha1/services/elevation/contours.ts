// src/services/elevation/contours.ts
// Marching Squares algorithm for generating smooth contour lines from elevation grid

import { configurableLogger } from "@services/logging/configurable-logger";
import type { ContourPath, ContourConfig } from "./elevation-types";

const logger = configurableLogger.forModule("contour-generator");

/**
 * Contour line segment (edge between two grid cells)
 */
interface ContourSegment {
	/** Start point (x, y in grid coordinates) */
	start: { x: number; y: number };
	/** End point (x, y in grid coordinates) */
	end: { x: number; y: number };
}

/**
 * Default contour configuration
 */
const DEFAULT_CONTOUR_CONFIG: ContourConfig = {
	interval: 100, // 100m between contours
	majorInterval: 500, // 500m major contours (thicker lines)
	smoothing: 1, // Light smoothing
};

/**
 * Generate contour lines from elevation grid using Marching Squares algorithm
 *
 * **Algorithm:** Marching Squares (classic isolines algorithm)
 * - For each grid cell (2×2 square), check which corners are above/below threshold
 * - Lookup table determines edge crossing pattern (16 cases)
 * - Connect edge crossings to form contour line segments
 * - Trace segments to form complete paths
 *
 * **Performance:** O(N × M × L) where N×M is grid size, L is number of elevation levels
 * - For 200×200 grid, 50 levels: ~2M operations (acceptable, ~20-50ms)
 *
 * @param elevationGrid - Float32Array of elevation values (row-major order)
 * @param gridWidth - Grid width in pixels
 * @param gridHeight - Grid height in pixels
 * @param config - Contour generation configuration
 * @returns Array of contour paths
 *
 * @example
 * ```typescript
 * const grid = elevationStore.getCachedGrid();
 * const contours = generateContours(grid, 200, 200, {
 *   interval: 100,
 *   majorInterval: 500
 * });
 *
 * console.log(`Generated ${contours.length} contour lines`);
 * // contours[0].elevation === 100
 * // contours[0].points.length === 42 (42 points forming the path)
 * // contours[0].closed === true (closed loop)
 * ```
 */
export function generateContours(
	elevationGrid: Float32Array,
	gridWidth: number,
	gridHeight: number,
	config: Partial<ContourConfig> = {}
): ContourPath[] {
	const fullConfig = { ...DEFAULT_CONTOUR_CONFIG, ...config };

	logger.info(`Generating contours with interval ${fullConfig.interval}m`);

	// Find elevation range from grid
	let minElev = Infinity;
	let maxElev = -Infinity;
	for (let i = 0; i < elevationGrid.length; i++) {
		const elev = elevationGrid[i];
		if (elev < minElev) minElev = elev;
		if (elev > maxElev) maxElev = elev;
	}

	// Use configured min/max or fall back to grid range
	const rangeMin = fullConfig.minElevation ?? Math.floor(minElev / fullConfig.interval) * fullConfig.interval;
	const rangeMax = fullConfig.maxElevation ?? Math.ceil(maxElev / fullConfig.interval) * fullConfig.interval;

	logger.debug(
		`Elevation range: ${rangeMin}m to ${rangeMax}m (grid: ${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m)`
	);

	// Generate elevation levels
	const levels: number[] = [];
	for (let level = rangeMin; level <= rangeMax; level += fullConfig.interval) {
		levels.push(level);
	}

	logger.debug(`Generating ${levels.length} contour levels`);

	// Generate contours for each level
	const allContours: ContourPath[] = [];
	for (const level of levels) {
		const segments = marchingSquares(elevationGrid, gridWidth, gridHeight, level);
		const paths = traceContourPaths(segments, level);

		// Apply smoothing if configured
		if (fullConfig.smoothing && fullConfig.smoothing > 0) {
			for (const path of paths) {
				smoothContourPath(path, fullConfig.smoothing);
			}
		}

		allContours.push(...paths);
	}

	logger.info(`Generated ${allContours.length} contour paths from ${levels.length} levels`);

	return allContours;
}

/**
 * Marching Squares algorithm - generate line segments at elevation threshold
 *
 * **16 Cases:** Each grid cell has 4 corners (A, B, C, D). Each corner is either above (1) or below (0) the threshold.
 * This gives 2^4 = 16 possible configurations.
 *
 * **Edge Interpolation:** When a contour crosses an edge, we interpolate the exact crossing point.
 *
 * @param grid - Elevation grid
 * @param width - Grid width
 * @param height - Grid height
 * @param threshold - Elevation threshold
 * @returns Array of line segments
 */
function marchingSquares(
	grid: Float32Array,
	width: number,
	height: number,
	threshold: number
): ContourSegment[] {
	const segments: ContourSegment[] = [];

	// Iterate over all grid cells (each cell is a 2×2 square)
	for (let y = 0; y < height - 1; y++) {
		for (let x = 0; x < width - 1; x++) {
			// Get corner elevations
			const a = grid[y * width + x]; // Top-left
			const b = grid[y * width + (x + 1)]; // Top-right
			const c = grid[(y + 1) * width + (x + 1)]; // Bottom-right
			const d = grid[(y + 1) * width + x]; // Bottom-left

			// Calculate cell configuration (4-bit binary)
			let cellCase = 0;
			if (a >= threshold) cellCase |= 1; // 0001
			if (b >= threshold) cellCase |= 2; // 0010
			if (c >= threshold) cellCase |= 4; // 0100
			if (d >= threshold) cellCase |= 8; // 1000

			// Get line segments for this configuration
			const cellSegments = getCellSegments(cellCase, x, y, a, b, c, d, threshold);
			segments.push(...cellSegments);
		}
	}

	return segments;
}

/**
 * Get line segments for a cell based on marching squares case
 *
 * **Edge Numbering:**
 * - Edge 0: Top (a → b)
 * - Edge 1: Right (b → c)
 * - Edge 2: Bottom (d → c)
 * - Edge 3: Left (a → d)
 *
 * @param cellCase - 4-bit configuration (0-15)
 * @param x - Cell X coordinate
 * @param y - Cell Y coordinate
 * @param a - Top-left elevation
 * @param b - Top-right elevation
 * @param c - Bottom-right elevation
 * @param d - Bottom-left elevation
 * @param threshold - Elevation threshold
 * @returns Array of segments for this cell
 */
function getCellSegments(
	cellCase: number,
	x: number,
	y: number,
	a: number,
	b: number,
	c: number,
	d: number,
	threshold: number
): ContourSegment[] {
	// Edge midpoint calculation with linear interpolation
	const interpolate = (v1: number, v2: number): number => {
		if (Math.abs(v2 - v1) < 0.001) return 0.5; // Avoid division by zero
		return (threshold - v1) / (v2 - v1);
	};

	// Edge midpoints (interpolated based on elevation values)
	const edges = {
		top: { x: x + interpolate(a, b), y: y }, // Edge 0: a → b
		right: { x: x + 1, y: y + interpolate(b, c) }, // Edge 1: b → c
		bottom: { x: x + interpolate(d, c), y: y + 1 }, // Edge 2: d → c
		left: { x: x, y: y + interpolate(a, d) }, // Edge 3: a → d
	};

	const segments: ContourSegment[] = [];

	// Marching Squares lookup table
	// Each case defines which edges to connect
	switch (cellCase) {
		case 0: // 0000 - All below
		case 15: // 1111 - All above
			// No contour
			break;

		case 1: // 0001 - Only a above
			segments.push({ start: edges.left, end: edges.top });
			break;
		case 14: // 1110 - Only a below
			segments.push({ start: edges.top, end: edges.left });
			break;

		case 2: // 0010 - Only b above
			segments.push({ start: edges.top, end: edges.right });
			break;
		case 13: // 1101 - Only b below
			segments.push({ start: edges.right, end: edges.top });
			break;

		case 3: // 0011 - a and b above
			segments.push({ start: edges.left, end: edges.right });
			break;
		case 12: // 1100 - a and b below
			segments.push({ start: edges.right, end: edges.left });
			break;

		case 4: // 0100 - Only c above
			segments.push({ start: edges.right, end: edges.bottom });
			break;
		case 11: // 1011 - Only c below
			segments.push({ start: edges.bottom, end: edges.right });
			break;

		case 5: // 0101 - a and c above (saddle point - ambiguous)
			// Saddle case: use midpoint to decide
			const midElev = (a + b + c + d) / 4;
			if (midElev >= threshold) {
				// Connect top-left and bottom-right
				segments.push({ start: edges.left, end: edges.top });
				segments.push({ start: edges.right, end: edges.bottom });
			} else {
				// Connect top-right and bottom-left
				segments.push({ start: edges.left, end: edges.bottom });
				segments.push({ start: edges.top, end: edges.right });
			}
			break;
		case 10: // 1010 - a and c below (inverse saddle)
			const midElev2 = (a + b + c + d) / 4;
			if (midElev2 >= threshold) {
				segments.push({ start: edges.top, end: edges.left });
				segments.push({ start: edges.bottom, end: edges.right });
			} else {
				segments.push({ start: edges.bottom, end: edges.left });
				segments.push({ start: edges.right, end: edges.top });
			}
			break;

		case 6: // 0110 - b and c above
			segments.push({ start: edges.top, end: edges.bottom });
			break;
		case 9: // 1001 - b and c below
			segments.push({ start: edges.bottom, end: edges.top });
			break;

		case 7: // 0111 - Only d below
			segments.push({ start: edges.left, end: edges.bottom });
			break;
		case 8: // 1000 - Only d above
			segments.push({ start: edges.bottom, end: edges.left });
			break;
	}

	return segments;
}

/**
 * Trace segments into complete contour paths
 *
 * Segments are disconnected - we need to connect them into continuous paths.
 *
 * @param segments - Array of line segments
 * @param elevation - Elevation level for these contours
 * @returns Array of contour paths
 */
function traceContourPaths(segments: ContourSegment[], elevation: number): ContourPath[] {
	if (segments.length === 0) return [];

	const paths: ContourPath[] = [];
	const used = new Set<number>();

	// Try to build paths starting from each unused segment
	for (let i = 0; i < segments.length; i++) {
		if (used.has(i)) continue;

		const path: Array<{ x: number; y: number }> = [];
		let current = i;
		path.push({ ...segments[current].start });
		path.push({ ...segments[current].end });
		used.add(current);

		let searchEnd = { ...segments[current].end };

		// Follow the path by finding connecting segments
		let foundConnection = true;
		while (foundConnection) {
			foundConnection = false;

			for (let j = 0; j < segments.length; j++) {
				if (used.has(j)) continue;

				const seg = segments[j];

				// Check if this segment connects to the current end point
				const startMatch = pointsEqual(seg.start, searchEnd);
				const endMatch = pointsEqual(seg.end, searchEnd);

				if (startMatch) {
					// Add segment in forward direction
					path.push({ ...seg.end });
					searchEnd = seg.end;
					used.add(j);
					foundConnection = true;
					break;
				} else if (endMatch) {
					// Add segment in reverse direction
					path.push({ ...seg.start });
					searchEnd = seg.start;
					used.add(j);
					foundConnection = true;
					break;
				}
			}
		}

		// Check if path forms a closed loop
		const closed = pointsEqual(path[0], path[path.length - 1]);

		paths.push({
			elevation,
			points: path,
			closed,
		});
	}

	return paths;
}

/**
 * Check if two points are equal (within tolerance)
 */
function pointsEqual(p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
	const tolerance = 0.01;
	return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}

/**
 * Smooth contour path using Chaikin's algorithm
 *
 * **Algorithm:** Chaikin's corner cutting
 * - For each edge, insert two new points at 1/4 and 3/4 positions
 * - Remove original intermediate points
 * - Repeat for N iterations
 *
 * @param path - Contour path to smooth
 * @param iterations - Number of smoothing iterations (1-3 recommended)
 */
function smoothContourPath(path: ContourPath, iterations: number): void {
	for (let iter = 0; iter < iterations; iter++) {
		const smoothed: Array<{ x: number; y: number }> = [];
		const points = path.points;

		for (let i = 0; i < points.length - 1; i++) {
			const p1 = points[i];
			const p2 = points[i + 1];

			// Insert two points at 1/4 and 3/4 positions
			smoothed.push({
				x: 0.75 * p1.x + 0.25 * p2.x,
				y: 0.75 * p1.y + 0.25 * p2.y,
			});
			smoothed.push({
				x: 0.25 * p1.x + 0.75 * p2.x,
				y: 0.25 * p1.y + 0.75 * p2.y,
			});
		}

		// For closed paths, connect last point to first
		if (path.closed && points.length > 2) {
			const p1 = points[points.length - 1];
			const p2 = points[0];
			smoothed.push({
				x: 0.75 * p1.x + 0.25 * p2.x,
				y: 0.75 * p1.y + 0.25 * p2.y,
			});
			smoothed.push({
				x: 0.25 * p1.x + 0.75 * p2.x,
				y: 0.25 * p1.y + 0.75 * p2.y,
			});
		}

		path.points = smoothed;
	}
}
