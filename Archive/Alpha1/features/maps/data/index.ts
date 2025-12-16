// src/features/maps/data/index.ts
// Barrel export for maps data layer

// ============================================================================
// Tile Repository - Public API for tile storage
// ============================================================================

export {
    // Main functions (existing, stable API)
    listTilesForMap,
    loadTile,
    saveTile,
    deleteTile,
    initTilesForNewMap,
    resetTileStore,

    // Validation
    validateTileData,
    TileValidationError,
} from "./tile-repository";

// Re-export types for backward compatibility
export type { TileData } from "./tile-repository";
export type { AxialCoord as TileCoord } from "@geometry";

// ============================================================================
// Tile Cache - Unified cache implementation
// ============================================================================

export {
    createTileCache,
    type TileCache,
    type TileCacheState,
    type TileRecord,
} from "./tile-cache";

// ============================================================================
// Map Repository - Map-level operations
// ============================================================================

export {
    getMapRepository,
    type MapRepository,
} from "./map-repository";

// ============================================================================
// Tile JSON I/O - Low-level JSON format and file operations
// ============================================================================

export {
    createEmptyTileJSON,
    getTileFromJSON,
    setTileInJSON,
    validateTileDataLightweight,
    loadTileJSONFromDisk,
    saveTileJSONToDisk,
    type TileJSONFormat,
} from "./tile-json-io";
