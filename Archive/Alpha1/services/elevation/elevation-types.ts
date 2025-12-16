// src/services/elevation/types.ts
// Shared types for elevation service

import type { AxialCoord, CoordKey } from "@geometry";

// ============================================================================
// Elevation Field Types
// ============================================================================

/**
 * Control Point for elevation field
 *
 * Represents a point with known elevation that influences surrounding area.
 * Multiple control points are interpolated to create a continuous elevation surface.
 */
export interface ControlPoint {
	/** Unique identifier */
	id: string;
	/** Pixel X coordinate */
	x: number;
	/** Pixel Y coordinate */
	y: number;
	/** Elevation in meters (-100 to +5000) */
	elevation: number;
	/** Point type for metadata (painted, peak, ridge, valley, etc.) */
	type: "painted" | "falloff" | "peak" | "ridge" | "valley" | "manual";
}

/**
 * Configuration for elevation field
 */
export interface ElevationFieldConfig {
	/** Grid resolution for caching (pixels) */
	resolution: number;
	/** Interpolation method */
	interpolation: "rbf" | "idw" | "bicubic";
	/** RBF sigma parameter (controls smoothness) */
	sigma?: number;
	/** IDW power parameter (controls weight falloff) */
	power?: number;
}

// ============================================================================
// Contour Types
// ============================================================================

/**
 * Contour path (connected sequence of segments)
 */
export interface ContourPath {
	/** Elevation level (meters) */
	elevation: number;
	/** Sequence of points forming the contour */
	points: Array<{ x: number; y: number }>;
	/** Whether this contour forms a closed loop */
	closed: boolean;
}

/**
 * Contour generation configuration
 */
export interface ContourConfig {
	/** Contour interval in meters (e.g., 100m) */
	interval: number;
	/** Major contour interval in meters (e.g., 500m for thicker lines) */
	majorInterval: number;
	/** Minimum elevation to generate contours for */
	minElevation?: number;
	/** Maximum elevation to generate contours for */
	maxElevation?: number;
	/** Smoothing iterations (0 = no smoothing, 1-3 recommended) */
	smoothing?: number;
}

// ============================================================================
// Hillshade Types
// ============================================================================

/**
 * Hillshade configuration
 */
export interface HillshadeConfig {
	/** Light azimuth in degrees (0-360, 0=North, 90=East, 180=South, 270=West) */
	azimuth: number;
	/** Light altitude in degrees (0-90, 0=horizontal, 90=overhead) */
	altitude: number;
	/** Z-factor for vertical exaggeration (default: 1.0) */
	zFactor?: number;
}

// ============================================================================
// Flow Direction Types
// ============================================================================

/**
 * Flow Direction Map
 *
 * Maps each hex to the direction (0-5) where water flows.
 * Direction indices (clockwise from East): 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 *
 * undefined = No flow (local minimum, flat area, or unpainted)
 */
export type FlowDirectionMap = ReadonlyMap<CoordKey, number | undefined>;

/**
 * Flow direction configuration
 */
export interface FlowDirectionConfig {
	/** Minimum slope to consider flow (prevents noise artifacts in flat areas) */
	minSlope: number;
	/** Default elevation for unpainted hexes (assumed sea level) */
	defaultElevation: number;
	/** Use noise-based random walk for flat areas (breaks ties randomly) */
	useRandomWalkForFlats: boolean;
	/** Seed for random walk (deterministic if provided) */
	randomSeed?: number;
}

// ============================================================================
// Flow Accumulation Types
// ============================================================================

/**
 * Flow Accumulation Map
 *
 * Maps each hex to the number of upstream hexes that drain through it.
 * Includes the hex itself (minimum value is 1).
 *
 * Higher values indicate more water flow (larger rivers).
 */
export type FlowAccumulationMap = ReadonlyMap<CoordKey, number>;

/**
 * Flow accumulation configuration
 */
export interface FlowAccumulationConfig {
	/** Include precipitation/climate multiplier per hex (future enhancement) */
	includePrecipitation: boolean;
	/** Base precipitation per hex (uniform if includePrecipitation = false) */
	basePrecipitation: number;
}

// ============================================================================
// River Extraction Types
// ============================================================================

/**
 * River Segment
 *
 * Represents a continuous section of river with consistent properties.
 * Rivers are split into segments at confluences (where tributaries join).
 */
export interface RiverSegment {
	/** Unique identifier */
	id: string;
	/** Ordered path of hex coordinates (upstream → downstream) */
	path: AxialCoord[];
	/** Strahler stream order (1 = headwater, higher = larger river) */
	order: number;
	/** Flow accumulation at segment start (upstream end) */
	accumulationStart: number;
	/** Flow accumulation at segment end (downstream end) */
	accumulationEnd: number;
	/** Calculated width in pixels (for rendering) */
	widthStart: number;
	/** Calculated width in pixels (for rendering) */
	widthEnd: number;
	/** IDs of tributary segments that flow into this segment */
	tributaryIds: string[];
}

/**
 * River Network
 *
 * Complete collection of all river segments in a watershed.
 */
export interface RiverNetwork {
	/** All river segments */
	segments: RiverSegment[];
	/** Total number of river hexes */
	totalRiverHexes: number;
	/** Maximum stream order in network */
	maxOrder: number;
	/** Threshold used for river extraction */
	threshold: number;
}

/**
 * River extraction configuration
 */
export interface RiverExtractionConfig {
	/** Minimum accumulation to consider a hex as part of a river */
	threshold: number;
	/** Minimum river width (pixels) */
	minWidth: number;
	/** Maximum river width (pixels) */
	maxWidth: number;
	/** Width scaling factor (higher = wider rivers) */
	widthFactor: number;
}

// ============================================================================
// Watershed Types
// ============================================================================

/**
 * Watershed Map
 *
 * Maps each hex to its watershed ID.
 * Hexes with the same ID drain to the same pour point.
 */
export type WatershedMap = ReadonlyMap<CoordKey, string>;

/**
 * Watershed Configuration
 */
export interface WatershedConfig {
	/** Minimum elevation difference to consider a neighbor as downslope (prevents noise artifacts) */
	minElevationDiff: number;
	/** Default elevation for unpainted hexes (assumed sea level) */
	defaultElevation: number;
}
