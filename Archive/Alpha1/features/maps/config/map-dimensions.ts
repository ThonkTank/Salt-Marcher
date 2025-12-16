// src/features/maps/config/map-dimensions.ts
// Value object for map dimension calculations

import { HexPixelSize, TileRadius } from "@services/geometry/geometry-types";
import { MAP_CONSTANTS } from "./constants";

/**
 * Map Dimensions Value Object
 *
 * Combines tile radius (coordinate space) with hex pixel size (rendering space)
 * and provides derived calculations for canvas dimensions.
 *
 * **Two distinct concepts:**
 * - `tileRadius`: Number of hex steps from center (coordinate generation)
 * - `hexPixelSize`: Pixel radius of each hex (rendering)
 *
 * @example
 * ```typescript
 * // Create from travel days (most common)
 * const dims = MapDimensions.fromTravelDays(5);
 * // dims.tileRadius = 15 (5 × 3)
 * // dims.hexPixelSize = 42 (default)
 * // dims.tileCount = 721 (3×15² + 3×15 + 1)
 *
 * // Create with custom hex size
 * const largeDims = MapDimensions.fromTravelDays(5, HexPixelSize.create(60));
 * ```
 */
export interface MapDimensions {
	/** Number of hex steps from center to edge (coordinate space) */
	readonly tileRadius: TileRadius;

	/** Pixel radius of each hex (rendering space) */
	readonly hexPixelSize: HexPixelSize;

	/** Total number of tiles in the hexagonal region */
	readonly tileCount: number;

	/** Canvas width in pixels (including padding) */
	readonly canvasWidth: number;

	/** Canvas height in pixels (including padding) */
	readonly canvasHeight: number;

	/** Width of single hex in pixels */
	readonly hexWidth: number;

	/** Height of single hex in pixels */
	readonly hexHeight: number;
}

/**
 * Calculate hex geometry from pixel size
 */
function calculateHexGeometry(hexPixelSize: HexPixelSize): { width: number; height: number; hStep: number; vStep: number } {
	const size = hexPixelSize as number;
	const width = Math.sqrt(3) * size;  // ~1.732 × size
	const height = 2 * size;
	const hStep = width;
	const vStep = 0.75 * height;
	return { width, height, hStep, vStep };
}

/**
 * Calculate canvas dimensions for a hexagonal map
 */
function calculateCanvasDimensions(
	tileRadius: TileRadius,
	hexPixelSize: HexPixelSize,
	padding: number = MAP_CONSTANTS.DEFAULT_CANVAS_PADDING
): { width: number; height: number } {
	const r = tileRadius as number;
	const { width: hexWidth, height: hexHeight, hStep, vStep } = calculateHexGeometry(hexPixelSize);

	// Hexagonal grid spans from -r to +r in both dimensions
	// Width: (2r + 1) columns + half hex for odd row offset
	const cols = 2 * r + 1;
	const canvasWidth = cols * hStep + hexWidth / 2 + 2 * padding;

	// Height: (2r + 1) rows
	const rows = 2 * r + 1;
	const canvasHeight = rows * vStep + hexHeight / 4 + 2 * padding;

	return { width: Math.ceil(canvasWidth), height: Math.ceil(canvasHeight) };
}

/**
 * MapDimensions factory and utilities
 */
export const MapDimensions = {
	/**
	 * Create MapDimensions from explicit tile radius
	 *
	 * @param tileRadius - Number of hex steps from center
	 * @param hexPixelSize - Pixel size of hexes (default: 42)
	 * @returns MapDimensions value object
	 */
	create(tileRadius: TileRadius, hexPixelSize: HexPixelSize = HexPixelSize.DEFAULT): MapDimensions {
		const tileCount = TileRadius.tileCount(tileRadius);
		const { width: canvasWidth, height: canvasHeight } = calculateCanvasDimensions(tileRadius, hexPixelSize);
		const { width: hexWidth, height: hexHeight } = calculateHexGeometry(hexPixelSize);

		return {
			tileRadius,
			hexPixelSize,
			tileCount,
			canvasWidth,
			canvasHeight,
			hexWidth,
			hexHeight,
		};
	},

	/**
	 * Create MapDimensions from travel days
	 *
	 * This is the most common factory method, converting user-friendly
	 * "days to cross the map" into proper dimensions.
	 *
	 * @param travelDays - Number of travel days from center to edge
	 * @param hexPixelSize - Pixel size of hexes (default: 42)
	 * @returns MapDimensions value object
	 *
	 * @example
	 * ```typescript
	 * const dims = MapDimensions.fromTravelDays(5);
	 * // 5 days × 3 hexes/day = 15 tile radius
	 * // 3×15² + 3×15 + 1 = 721 tiles
	 * ```
	 */
	fromTravelDays(travelDays: number, hexPixelSize: HexPixelSize = HexPixelSize.DEFAULT): MapDimensions {
		const tileRadius = TileRadius.fromTravelDays(travelDays);
		return MapDimensions.create(tileRadius, hexPixelSize);
	},

	/**
	 * Create MapDimensions from raw numbers (for parsing)
	 *
	 * @param tileRadiusValue - Raw tile radius number
	 * @param hexPixelSizeValue - Raw hex pixel size number (default: 42)
	 * @returns MapDimensions value object
	 * @throws {RangeError} If values are out of valid range
	 */
	fromRaw(tileRadiusValue: number, hexPixelSizeValue: number = MAP_CONSTANTS.DEFAULT_HEX_PIXEL_SIZE): MapDimensions {
		const tileRadius = TileRadius.create(tileRadiusValue);
		const hexPixelSize = HexPixelSize.create(hexPixelSizeValue);
		return MapDimensions.create(tileRadius, hexPixelSize);
	},

	/**
	 * Get approximate travel days from tile radius
	 *
	 * @param dims - MapDimensions to convert
	 * @returns Approximate travel days (rounded)
	 */
	toTravelDays(dims: MapDimensions): number {
		return Math.round((dims.tileRadius as number) / MAP_CONSTANTS.HEXES_PER_TRAVEL_DAY);
	},
};
