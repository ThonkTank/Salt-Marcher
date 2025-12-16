// src/features/maps/index.ts
// Main feature export - Public API
//
// NOTE: Most internal modules import directly from subdirectories (preferred).
// This barrel file exports only commonly used public APIs for external consumers.
//
// Reduced from 10 wildcard exports to explicit named exports for better tree-shaking.

// ============================================================================
// Domain Types & Utilities
// ============================================================================

// Options
export type { HexOptions } from "./config/options";
export { parseOptions, DEFAULT_HEX_OPTIONS } from "./config/options";

// Terrain Types & Icons
export type {
    TerrainType,
    FloraType,
    MoistureLevel,
    IconDefinition,
} from "./config/terrain";

export {
    TERRAIN_ICONS,
    FLORA_ICONS,
    MOISTURE_LABELS,
    MOISTURE_COLORS,
    TERRAIN_SPEED_MODIFIERS,
    FLORA_SPEED_MODIFIERS,
    getTerrainTypes,
    getFloraTypes,
    getMoistureLevels,
    setBackgroundColorPalette,
    getMovementSpeed,
} from "./config/terrain";

// Region Types & Validation
export type { Region } from "./config/region";
export {
    validateRegion,
    validateRegionList,
    RegionValidationError,
} from "./config/region";

// Faction Colors
export { DEFAULT_FACTION_COLORS, getFactionColor } from "./config/faction-colors";

// ============================================================================
// Data Access Layer (Repositories)
// ============================================================================

export type { TerrainWatcherOptions } from "./state/terrain-store";
export {
    ensureTerrainFile,
    loadTerrains,
    watchTerrains,
    TERRAIN_FILE,
} from "./state/terrain-store";

export {
    ensureRegionsFile,
    loadRegions,
    REGIONS_FILE,
} from "./data/region-repository";

export type { TileData } from "./data/tile-repository";
export {
    loadTile,
    saveTile,
    deleteTile,
    listTilesForMap,
} from "./data/tile-repository";

// MapSession Pattern - Replacement for getTileStore
export type { MapSession } from "./session";
export { getMapSession, disposeMapSession, disposeAllSessions } from "./session";

export type { CreateMapConfig } from "./data/map-repository";
export {
    createHexMapFile,
    deleteMapAndTiles,
    getAllMapFiles,
    getFirstHexBlock,
    pickLatest,
} from "./data/map-repository";

// ============================================================================
// State Management
// ============================================================================

export { getFactionOverlayStore } from "./state/faction-overlay-store";

// Weather Overlay Store
export type {
    WeatherOverlayEntry,
    WeatherOverlayState,
    WeatherOverlayStore,
} from "./state/weather-overlay-store";
export {
    getWeatherOverlayStore,
    setTileCacheProvider,
    resetWeatherOverlayStore,
} from "./state/weather-overlay-store";

// Location Influence Store
export type {
    LocationInfluenceAssignment,
    LocationInfluenceEntry,
    LocationInfluenceState,
    LocationInfluenceStore,
} from "./state/location-influence-store";
export {
    getLocationInfluenceStore,
    resetLocationInfluenceStore,
} from "./state/location-influence-store";

// Location Marker Store
export type {
    LocationMarker,
    LocationMarkerEntry,
    LocationMarkerState,
    LocationMarkerStore,
} from "./state/location-marker-store";
export {
    getLocationMarkerStore,
    resetLocationMarkerStore,
} from "./state/location-marker-store";

// Terrain Feature Store
export type {
    TerrainFeatureType,
    TerrainFeaturePath,
    TerrainFeatureStyle,
    TerrainFeature,
    TerrainFeatureState,
    TerrainFeatureStore,
    FeatureRenderingHints,
} from "./state/terrain-feature-store";
export {
    getTerrainFeatureStore,
    DEFAULT_FEATURE_STYLES,
    generateFeatureId,
    isHexBased,
    isCornerBased,
    getPathCoordinates,
    loadFeaturesFromDisk,
    saveFeaturesToDisk,
    convertHexToCorner,
    validateFeatureForRendering,
    getRenderingHints,
} from "./state/terrain-feature-store";

// ============================================================================
// Overlay System
// ============================================================================

export type {
    SimpleOverlayLayer,
    AnyOverlayLayer,
    OverlayRenderData,
    OverlayRenderFill,
    OverlayRenderSVG,
    OverlayManagerConfig,
    LayerConfig,
    OverlayManager,
} from "./overlay/overlay-types";

export {
    LAYER_REGISTRY,
    LAYER_GROUP,
    LAYER_IDS,
    LAYER_PRIORITY,
    getLayerById,
    getLayersByGroup,
    getVisibleLayers,
    getOverlayIdsForPanel,
    buildPanelToOverlayMap,
    getAllOverlayIds,
} from "./overlay/layer-registry";
export type { LayerId, LayerPanelConfig, LayerDefinition } from "./overlay/layer-registry";

// ============================================================================
// Undo/Redo Manager
// ============================================================================

export type { UndoStackEntry } from "./undo-manager";
export { UndoManager } from "./undo-manager";

// ============================================================================
// Rendering
// ============================================================================

export type { RenderHandles } from "./rendering/hex-render";
export { renderHexMap } from "./rendering/hex-render";
