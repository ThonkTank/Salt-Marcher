/**
 * Map Feature service.
 *
 * Provides map operations: loading, tile queries, terrain lookups.
 * Implements MapFeaturePort interface.
 */

import type {
  Result,
  AppError,
  MapId,
  Option,
} from '@core/index';
import {
  ok,
  err,
  some,
  none,
  isNone,
  isSome,
  createError,
  coordToKey,
} from '@core/index';
import type {
  OverworldMap,
  OverworldTile,
  HexCoordinate,
  TerrainDefinition,
} from '@core/schemas';
import type {
  MapFeaturePort,
  MapStoragePort,
  TerrainStoragePort,
} from './types';
import type { MapStore } from './map-store';

// ============================================================================
// Default Movement Cost
// ============================================================================

/** Default movement cost if terrain not found */
const DEFAULT_MOVEMENT_COST = 1.0;

// ============================================================================
// Map Service
// ============================================================================

export interface MapServiceDeps {
  store: MapStore;
  mapStorage: MapStoragePort;
  terrainStorage: TerrainStoragePort;
}

/**
 * Create the map service (implements MapFeaturePort).
 */
export function createMapService(deps: MapServiceDeps): MapFeaturePort {
  const { store, mapStorage, terrainStorage } = deps;

  return {
    // =========================================================================
    // State Queries
    // =========================================================================

    getCurrentMap(): Option<OverworldMap> {
      const map = store.getState().currentMap;
      return map ? some(map) : none();
    },

    getTile(coord: HexCoordinate): Option<OverworldTile> {
      const key = coordToKey(coord);
      const tile = store.getTile(key);
      return tile ? some(tile) : none();
    },

    getTerrainAt(coord: HexCoordinate): Option<TerrainDefinition> {
      const key = coordToKey(coord);
      const tile = store.getTile(key);
      if (!tile) return none();

      return terrainStorage.get(tile.terrain);
    },

    getMovementCost(coord: HexCoordinate): number {
      const key = coordToKey(coord);
      const tile = store.getTile(key);
      if (!tile) return DEFAULT_MOVEMENT_COST;

      const terrain = terrainStorage.get(tile.terrain);
      if (isNone(terrain)) return DEFAULT_MOVEMENT_COST;

      return terrain.value.movementCost;
    },

    isValidCoordinate(coord: HexCoordinate): boolean {
      const map = store.getState().currentMap;
      if (!map) return false;

      // Check if coordinate is within map bounds
      // For offset-based bounds checking (rectangular map)
      if (coord.q < 0 || coord.q >= map.dimensions.width) return false;
      if (coord.r < 0 || coord.r >= map.dimensions.height) return false;

      // Also check if tile actually exists (sparse maps)
      const key = coordToKey(coord);
      return store.hasTile(key);
    },

    // =========================================================================
    // Map Operations
    // =========================================================================

    async loadMap(id: MapId): Promise<Result<OverworldMap, AppError>> {
      const result = await mapStorage.load(id);

      if (!result.ok) {
        return result;
      }

      const map = result.value;

      // Validate map type
      if (map.type !== 'overworld') {
        return err(
          createError(
            'INVALID_MAP_TYPE',
            `Expected overworld map, got ${map.type}`
          )
        );
      }

      // Update store
      store.setCurrentMap(map);

      return ok(map);
    },

    unloadMap(): void {
      store.clear();
    },
  };
}
