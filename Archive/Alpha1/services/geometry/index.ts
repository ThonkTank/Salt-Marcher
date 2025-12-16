// src/services/geometry/index.ts
// Central geometry service for hex-based coordinate systems
//
// Provides type-safe coordinate operations for hex grids used throughout Salt Marcher:
// - Coordinate system conversions (Axial ↔ Cube)
// - Distance calculations
// - Neighbor finding
// - Radius/area calculations
// - Line drawing (Bresenham's for hexes)
// - Pixel/hex conversions
// - Coordinate key management (string serialization)

// ============================================================================
// Types
// ============================================================================

export type {
	// Core coordinate types
	AxialCoord,
	CubeCoord,
	// Map dimension types
	HexPixelSize,
	TileRadius
} from "./geometry-types";

export {
	// Type guards
	isAxialCoord,
	isCubeCoord,
	// Builders
	HexPixelSize as HexPixelSizeBuilder,
	TileRadius as TileRadiusBuilder
} from "./geometry-types";

// ============================================================================
// Hex Coordinate Operations
// ============================================================================

export type { CoordKey } from "./hex-coords";
export {
	// Coordinate Keys
	coordToKey,
	keyToCoord,
	isValidKey,
	COORD_KEY_REGEX,
	ORIGIN_KEY,
	// Coordinate Conversions
	axialToCube,
	cubeToAxial,
	// Distance Calculations
	axialDistance,
	// Neighbors
	neighbors,
	neighborInDirection,
	// Radius & Area
	coordsInRadius,
	// Line Drawing
	cubeLerp,
	cubeRound,
	line,
	// Pixel Conversions
	axialToPixel,
	pixelToAxial,
	axialToCanvasPixel,
	// Hex Geometry Dimensions
	hexWidth,
	hexHeight,
	// SVG Rendering
	hexPolygonPoints
} from "./hex-coords";
