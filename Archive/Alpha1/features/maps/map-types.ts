/**
 * Public type definitions for Maps feature
 *
 * Consolidates all public types from the maps feature into a single export.
 * This file serves as the type interface for external consumers.
 */

// ============================================================================
// Coordinate Types
// ============================================================================

export type {
	AxialCoord,
	CubeCoord,
} from "./config/coordinates";

// ============================================================================
// Terrain & Flora Types
// ============================================================================

export type {
	TerrainType,
	FloraType,
	MoistureLevel,
	IconDefinition,
} from "./config/terrain";

// ============================================================================
// Map Configuration Types
// ============================================================================

export type {
	MapClimateSettings,
	HexOptions,
} from "./config/options";

export type { MapDimensions } from "./config/map-dimensions";
export { MapDimensions as MapDimensionsBuilder } from "./config/map-dimensions";
export { MAP_CONSTANTS } from "./config/constants";
export type { CreateMapConfig } from "./data/map-repository";

// ============================================================================
// Region & Area Types
// ============================================================================

export type {
	Region,
} from "./config/region";

export type {
	AreaType,
} from "@services/domain";

// ============================================================================
// Tile Data Types
// ============================================================================

export type {
	TileCoord,
	TileDataInterface,
	FactionOverlayAssignment,
	TileRecord,
	TileStoreStateInterface,
} from "./config/store-interfaces";

export type {
	TileData,
	TileJSONFormat,
} from "./data/tile-json-io";

// ============================================================================
// Store Interface Types
// ============================================================================

export type {
	IFactionOverlayStore,
	ILocationMarkerStore,
	ILocationInfluenceStore,
} from "./config/store-interfaces";

// ============================================================================
// Repository Types
// ============================================================================

export type {
	ElevationJSON,
} from "./data/elevation-repository";

export type {
	RegionDataSource,
	RegionEntry,
} from "./data/region-data-source";
