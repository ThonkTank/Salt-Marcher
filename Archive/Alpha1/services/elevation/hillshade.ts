// src/services/elevation/hillshade.ts
// Hillshade calculation using slope and aspect from elevation grid

import { configurableLogger } from "@services/logging/configurable-logger";
import type { HillshadeConfig } from "./elevation-types";

const logger = configurableLogger.forModule("hillshade-calculator");

/**
 * Default hillshade configuration (Northwest light source at 45° altitude)
 */
const DEFAULT_CONFIG: HillshadeConfig = {
	azimuth: 315, // Northwest
	altitude: 45, // 45° above horizon
	zFactor: 1.0,
};

/**
 * Calculate hillshade intensity grid from elevation data
 *
 * **Algorithm:** Burrough & McDonnell (1998) hillshade formula
 * - Calculate slope and aspect at each grid point using Sobel filter
 * - Apply lighting equation based on light direction
 * - Output grayscale intensity (0-255)
 *
 * **Performance:** O(N×M) where N×M is grid size
 * - For 200×200 grid: 40k operations (~10-20ms)
 *
 * @param elevationGrid - Float32Array of elevation values (row-major order)
 * @param gridWidth - Grid width in pixels
 * @param gridHeight - Grid height in pixels
 * @param config - Hillshade configuration
 * @returns Uint8ClampedArray of intensity values (0-255)
 *
 * @example
 * ```typescript
 * const grid = elevationStore.getCachedGrid();
 * const hillshade = calculateHillshade(grid, 200, 200, {
 *   azimuth: 315,  // Northwest
 *   altitude: 45   // 45° above horizon
 * });
 *
 * // hillshade[0] = 180 (brightness 0-255)
 * ```
 */
export function calculateHillshade(
	elevationGrid: Float32Array,
	gridWidth: number,
	gridHeight: number,
	config: Partial<HillshadeConfig> = {}
): Uint8ClampedArray {
	const fullConfig = { ...DEFAULT_CONFIG, ...config };

	logger.info(
		`Calculating hillshade (azimuth: ${fullConfig.azimuth}°, altitude: ${fullConfig.altitude}°)`
	);

	const hillshade = new Uint8ClampedArray(gridWidth * gridHeight);

	// Convert degrees to radians
	const azimuthRad = (fullConfig.azimuth * Math.PI) / 180;
	const altitudeRad = (fullConfig.altitude * Math.PI) / 180;
	const zFactor = fullConfig.zFactor || 1.0;

	// Pre-calculate light direction components
	const zenithRad = (Math.PI / 2) - altitudeRad;
	const cosZenith = Math.cos(zenithRad);
	const sinZenith = Math.sin(zenithRad);

	// Iterate over all grid cells
	for (let y = 0; y < gridHeight; y++) {
		for (let x = 0; x < gridWidth; x++) {
			const idx = y * gridWidth + x;

			// Calculate slope and aspect using Sobel filter
			const { slope, aspect } = calculateSlopeAspect(
				elevationGrid,
				gridWidth,
				gridHeight,
				x,
				y,
				zFactor
			);

			// Calculate hillshade intensity using standard formula
			const intensity = calculateHillshadeIntensity(
				slope,
				aspect,
				cosZenith,
				sinZenith,
				azimuthRad
			);

			hillshade[idx] = intensity;
		}
	}

	logger.debug(`Generated hillshade grid (${gridWidth}×${gridHeight})`);

	return hillshade;
}

/**
 * Calculate slope and aspect at a grid point using Sobel filter
 *
 * **Algorithm:** Sobel gradient operator (3×3 kernel)
 * - dz/dx: [-1 0 +1] weighted by distance
 * - dz/dy: [-1 0 +1] weighted by distance
 * - slope = atan(sqrt(dzdx² + dzdy²))
 * - aspect = atan2(dzdy, -dzdx)
 *
 * @param grid - Elevation grid
 * @param width - Grid width
 * @param height - Grid height
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param zFactor - Vertical exaggeration factor
 * @returns Slope (radians) and aspect (radians)
 */
function calculateSlopeAspect(
	grid: Float32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	zFactor: number
): { slope: number; aspect: number } {
	// Helper to get elevation at (x, y) with boundary handling
	const getElev = (dx: number, dy: number): number => {
		const nx = Math.max(0, Math.min(width - 1, x + dx));
		const ny = Math.max(0, Math.min(height - 1, y + dy));
		return grid[ny * width + nx];
	};

	// Sobel filter kernels (3×3)
	// dz/dx: horizontal gradient
	const a = getElev(-1, -1);
	const b = getElev(0, -1);
	const c = getElev(1, -1);
	const d = getElev(-1, 0);
	// e = center (not used in gradient)
	const f = getElev(1, 0);
	const g = getElev(-1, 1);
	const h = getElev(0, 1);
	const i = getElev(1, 1);

	// Calculate gradients (Sobel operator)
	// dz/dx = ((c + 2f + i) - (a + 2d + g)) / 8
	const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / 8;

	// dz/dy = ((g + 2h + i) - (a + 2b + c)) / 8
	const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / 8;

	// Apply z-factor for vertical exaggeration
	const dzdxScaled = dzdx * zFactor;
	const dzdyScaled = dzdy * zFactor;

	// Calculate slope magnitude (radians)
	const slope = Math.atan(Math.sqrt(dzdxScaled * dzdxScaled + dzdyScaled * dzdyScaled));

	// Calculate aspect (direction of steepest descent, radians from east)
	// Note: aspect = atan2(dzdy, -dzdx) because we want direction of slope, not gradient
	const aspect = Math.atan2(dzdyScaled, -dzdxScaled);

	return { slope, aspect };
}

/**
 * Calculate hillshade intensity using lighting equation
 *
 * **Formula:** Burrough & McDonnell (1998)
 * ```
 * Hillshade = 255 × (
 *   (cos(Zenith) × cos(Slope)) +
 *   (sin(Zenith) × sin(Slope) × cos(Azimuth - Aspect))
 * )
 * ```
 *
 * @param slope - Slope in radians
 * @param aspect - Aspect in radians
 * @param cosZenith - Pre-calculated cos(zenith)
 * @param sinZenith - Pre-calculated sin(zenith)
 * @param azimuth - Light azimuth in radians
 * @returns Intensity (0-255)
 */
function calculateHillshadeIntensity(
	slope: number,
	aspect: number,
	cosZenith: number,
	sinZenith: number,
	azimuth: number
): number {
	const cosSlope = Math.cos(slope);
	const sinSlope = Math.sin(slope);

	// Hillshade formula
	const hillshade =
		cosZenith * cosSlope + sinZenith * sinSlope * Math.cos(azimuth - aspect);

	// Scale to 0-255 and clamp
	const intensity = 255 * hillshade;
	return Math.max(0, Math.min(255, Math.round(intensity)));
}

/**
 * Calculate slope magnitude only (useful for visualizing steepness)
 *
 * @param elevationGrid - Float32Array of elevation values
 * @param gridWidth - Grid width
 * @param gridHeight - Grid height
 * @param zFactor - Vertical exaggeration factor
 * @returns Float32Array of slope values (radians)
 */
export function calculateSlopeGrid(
	elevationGrid: Float32Array,
	gridWidth: number,
	gridHeight: number,
	zFactor: number = 1.0
): Float32Array {
	const slopes = new Float32Array(gridWidth * gridHeight);

	for (let y = 0; y < gridHeight; y++) {
		for (let x = 0; x < gridWidth; x++) {
			const { slope } = calculateSlopeAspect(
				elevationGrid,
				gridWidth,
				gridHeight,
				x,
				y,
				zFactor
			);
			slopes[y * gridWidth + x] = slope;
		}
	}

	return slopes;
}

/**
 * Calculate aspect (direction) only (useful for visualizing slope direction)
 *
 * @param elevationGrid - Float32Array of elevation values
 * @param gridWidth - Grid width
 * @param gridHeight - Grid height
 * @param zFactor - Vertical exaggeration factor
 * @returns Float32Array of aspect values (radians)
 */
export function calculateAspectGrid(
	elevationGrid: Float32Array,
	gridWidth: number,
	gridHeight: number,
	zFactor: number = 1.0
): Float32Array {
	const aspects = new Float32Array(gridWidth * gridHeight);

	for (let y = 0; y < gridHeight; y++) {
		for (let x = 0; x < gridWidth; x++) {
			const { aspect } = calculateSlopeAspect(
				elevationGrid,
				gridWidth,
				gridHeight,
				x,
				y,
				zFactor
			);
			aspects[y * gridWidth + x] = aspect;
		}
	}

	return aspects;
}
