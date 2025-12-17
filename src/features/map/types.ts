/**
 * Map Feature types and interfaces.
 */

import type { Result, AppError, MapId, TerrainId, Option } from '@core/index';
import type {
  OverworldMap,
  OverworldTile,
  HexCoordinate,
  TerrainDefinition,
} from '@core/schemas';

// ============================================================================
// Storage Port (Interface for Infrastructure Layer)
// ============================================================================

/**
 * Storage port interface for map persistence.
 * Implemented by VaultAdapter in Infrastructure layer.
 */
export interface MapStoragePort {
  /** Load a map by ID */
  load(id: MapId): Promise<Result<OverworldMap, AppError>>;

  /** Save a map */
  save(map: OverworldMap): Promise<Result<void, AppError>>;

  /** List all available map IDs */
  listIds(): Promise<Result<MapId[], AppError>>;

  /** Check if a map exists */
  exists(id: MapId): Promise<boolean>;
}

/**
 * Storage port interface for terrain definitions.
 */
export interface TerrainStoragePort {
  /** Get a terrain definition by ID */
  get(id: TerrainId): Option<TerrainDefinition>;

  /** Get all terrain definitions */
  getAll(): TerrainDefinition[];
}

// ============================================================================
// Map Feature Port (Public API)
// ============================================================================

/**
 * Public interface for the Map Feature.
 * Used by ViewModels and other Features.
 */
export interface MapFeaturePort {
  // === State Queries ===

  /** Get the currently loaded map */
  getCurrentMap(): Option<OverworldMap>;

  /** Get a tile at the given coordinate */
  getTile(coord: HexCoordinate): Option<OverworldTile>;

  /** Get terrain definition for a tile */
  getTerrainAt(coord: HexCoordinate): Option<TerrainDefinition>;

  /** Get movement cost for a tile (terrain.movementCost) */
  getMovementCost(coord: HexCoordinate): number;

  /** Check if a coordinate is within map bounds */
  isValidCoordinate(coord: HexCoordinate): boolean;

  // === Map Operations ===

  /** Load a map by ID */
  loadMap(id: MapId): Promise<Result<OverworldMap, AppError>>;

  /** Unload the current map */
  unloadMap(): void;

  // === Lifecycle ===

  /** Clean up subscriptions and resources */
  dispose(): void;
}

// ============================================================================
// Map State
// ============================================================================

/**
 * Internal state for the Map Feature.
 */
export interface MapState {
  /** Currently loaded map (if any) */
  currentMap: OverworldMap | null;

  /** Tile lookup cache (built from map.tiles) */
  tileLookup: Map<string, OverworldTile>;
}

/**
 * Create initial map state.
 */
export function createInitialMapState(): MapState {
  return {
    currentMap: null,
    tileLookup: new Map(),
  };
}
