// src/services/geometry/types.ts

/**
 * Coordinate Types for Hex Grids
 *
 * Simple structural types for hexagonal coordinate systems.
 * - AxialCoord: Two-dimensional (q, r) representation
 * - CubeCoord: Three-dimensional (q, r, s) representation where q + r + s = 0
 */

/* ---- Coordinate Types ---- */

/**
 * Axial Coordinate
 *
 * Two-dimensional hex coordinate using (q, r) axes.
 * Simplifies distance and neighbor calculations.
 */
export type AxialCoord = {
	q: number;
	r: number;
};

/**
 * Cube Coordinate
 *
 * Three-dimensional hex coordinate where q + r + s = 0.
 * Best for geometric operations (distance, rotation, neighbors).
 *
 * Invariant: q + r + s must equal 0
 */
export type CubeCoord = {
	q: number;
	r: number;
	s: number;
};

/* ---- Type Guards ---- */

/**
 * Type guard for Axial coordinates
 *
 * Checks if value is a valid Axial coordinate at runtime.
 *
 * @param coord - Value to check
 * @returns True if coord is a valid AxialCoord
 */
export function isAxialCoord(coord: unknown): coord is AxialCoord {
	return (
		typeof coord === "object" &&
		coord !== null &&
		"q" in coord &&
		"r" in coord &&
		typeof (coord as any).q === "number" &&
		typeof (coord as any).r === "number" &&
		!isNaN((coord as any).q) &&
		!isNaN((coord as any).r) &&
		isFinite((coord as any).q) &&
		isFinite((coord as any).r)
	);
}

/**
 * Type guard for Cube coordinates
 *
 * Checks if value is a valid Cube coordinate at runtime.
 * Validates that q + r + s ≈ 0 (allows floating point error).
 *
 * @param coord - Value to check
 * @returns True if coord is a valid CubeCoord
 */
export function isCubeCoord(coord: unknown): coord is CubeCoord {
	if (
		typeof coord !== "object" ||
		coord === null ||
		!("q" in coord) ||
		!("r" in coord) ||
		!("s" in coord)
	) {
		return false;
	}

	const q = (coord as any).q;
	const r = (coord as any).r;
	const s = (coord as any).s;

	if (
		typeof q !== "number" ||
		typeof r !== "number" ||
		typeof s !== "number" ||
		isNaN(q) ||
		isNaN(r) ||
		isNaN(s) ||
		!isFinite(q) ||
		!isFinite(r) ||
		!isFinite(s)
	) {
		return false;
	}

	// Check cube invariant: q + r + s = 0 (allow floating point error)
	const sum = q + r + s;
	return Math.abs(sum) < 1e-10;
}

/* ---- Map Dimension Types ---- */

/**
 * Hex Pixel Size (Rendering)
 *
 * Branded type representing the pixel radius of a hex (distance from center to corner).
 * Used for rendering calculations.
 *
 * **Constraints:**
 * - Minimum: 12 pixels (readable on screen)
 * - Maximum: 200 pixels (reasonable upper bound)
 * - Default: 42 pixels
 *
 * @example
 * ```typescript
 * const size = HexPixelSize.create(42);  // Standard hex size
 * const defaultSize = HexPixelSize.DEFAULT;  // 42
 * ```
 */
export type HexPixelSize = number & { readonly __brand: "HexPixelSize" };

/**
 * Hex Pixel Size Builder
 */
export const HexPixelSize = {
	/** Default hex pixel size (42 pixels) */
	DEFAULT: 42 as HexPixelSize,

	/** Minimum valid hex pixel size */
	MIN: 12 as HexPixelSize,

	/** Maximum valid hex pixel size */
	MAX: 200 as HexPixelSize,

	/**
	 * Create a hex pixel size
	 *
	 * @param pixels - Size in pixels (12-200)
	 * @returns Branded HexPixelSize
	 * @throws {RangeError} If pixels is outside valid range
	 */
	create(pixels: number): HexPixelSize {
		if (!isFinite(pixels) || isNaN(pixels)) {
			throw new RangeError(`HexPixelSize must be a finite number (got ${pixels})`);
		}
		if (pixels < 12 || pixels > 200) {
			throw new RangeError(`HexPixelSize must be between 12 and 200 (got ${pixels})`);
		}
		return pixels as HexPixelSize;
	},

	/**
	 * Check if a value is a valid HexPixelSize
	 */
	isValid(value: unknown): value is HexPixelSize {
		return typeof value === "number" && isFinite(value) && value >= 12 && value <= 200;
	},
};

/**
 * Tile Radius (Coordinates)
 *
 * Branded type representing the number of hex steps from the center of a map.
 * Used for coordinate generation (how many hexes to create).
 *
 * **Constraints:**
 * - Minimum: 0 (only center hex)
 * - Maximum: 50 (reasonable upper bound, ~7651 tiles)
 *
 * **Relationship to Travel Days:**
 * - 1 travel day = 3 hex steps
 * - Use `TileRadius.fromTravelDays()` for conversion
 *
 * @example
 * ```typescript
 * const radius = TileRadius.create(15);  // 15 hex steps
 * const fromDays = TileRadius.fromTravelDays(5);  // 5 days × 3 = 15
 * ```
 */
export type TileRadius = number & { readonly __brand: "TileRadius" };

/** Number of hex steps per travel day */
const HEXES_PER_TRAVEL_DAY = 3;

/**
 * Tile Radius Builder
 */
export const TileRadius = {
	/** Maximum valid tile radius */
	MAX: 50 as TileRadius,

	/** Hex steps per travel day (conversion factor) */
	HEXES_PER_DAY: HEXES_PER_TRAVEL_DAY,

	/**
	 * Create a tile radius
	 *
	 * @param hexes - Number of hex steps from center (0-50)
	 * @returns Branded TileRadius
	 * @throws {RangeError} If hexes is outside valid range
	 */
	create(hexes: number): TileRadius {
		if (!isFinite(hexes) || isNaN(hexes)) {
			throw new RangeError(`TileRadius must be a finite number (got ${hexes})`);
		}
		const rounded = Math.floor(hexes);
		if (rounded < 0 || rounded > 50) {
			throw new RangeError(`TileRadius must be between 0 and 50 (got ${rounded})`);
		}
		return rounded as TileRadius;
	},

	/**
	 * Create a tile radius from travel days
	 *
	 * @param days - Number of travel days from center to edge
	 * @returns Branded TileRadius (days × 3)
	 */
	fromTravelDays(days: number): TileRadius {
		return TileRadius.create(days * HEXES_PER_TRAVEL_DAY);
	},

	/**
	 * Calculate the number of tiles in a hexagonal region with this radius
	 *
	 * Formula: 3r² + 3r + 1 (for radius r)
	 *
	 * @param radius - The tile radius
	 * @returns Total number of tiles
	 */
	tileCount(radius: TileRadius): number {
		const r = radius as number;
		return 3 * r * r + 3 * r + 1;
	},

	/**
	 * Check if a value is a valid TileRadius
	 */
	isValid(value: unknown): value is TileRadius {
		return typeof value === "number" && isFinite(value) && value >= 0 && value <= 50 && Number.isInteger(value);
	},
};
