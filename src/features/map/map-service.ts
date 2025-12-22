/**
 * Map Feature service.
 *
 * Provides map operations: loading, tile queries, terrain lookups.
 * Publishes map:loaded, map:load-failed, map:state-changed events.
 * Handles map:load-requested command events.
 * Implements MapFeaturePort interface.
 */

import type {
  Result,
  AppError,
  MapId,
  Option,
  EventBus,
  Unsubscribe,
} from '@core/index';
import {
  ok,
  err,
  some,
  none,
  isNone,
  createError,
  coordToKey,
  createEvent,
  newCorrelationId,
  now,
  EventTypes,
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
import type {
  MapLoadedPayload,
  MapLoadFailedPayload,
  MapStateChangedPayload,
  MapUnloadedPayload,
  MapLoadRequestedPayload,
  MapNavigateRequestedPayload,
  MapNavigatedPayload,
} from '@core/events/domain-events';

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
  eventBus?: EventBus; // Optional during migration
}

/**
 * Create the map service (implements MapFeaturePort).
 */
export function createMapService(deps: MapServiceDeps): MapFeaturePort {
  const { store, mapStorage, terrainStorage, eventBus } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // ===========================================================================
  // Event Publishing Helpers
  // ===========================================================================

  function publishLoaded(map: OverworldMap, correlationId?: string): void {
    if (!eventBus) return;

    const payload: MapLoadedPayload = {
      mapId: map.id,
      mapType: 'hex', // OverworldMap is always hex type
    };

    eventBus.publish(
      createEvent(EventTypes.MAP_LOADED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'map-feature',
      })
    );
  }

  function publishLoadFailed(
    mapId: string,
    error: AppError,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: MapLoadFailedPayload = {
      mapId,
      reason: error.message,
    };

    eventBus.publish(
      createEvent(EventTypes.MAP_LOAD_FAILED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'map-feature',
      })
    );
  }

  function publishStateChanged(correlationId?: string): void {
    if (!eventBus) return;

    const state = store.getState();
    const payload: MapStateChangedPayload = {
      state,
    };

    eventBus.publish(
      createEvent(EventTypes.MAP_STATE_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'map-feature',
      })
    );
  }

  function publishUnloaded(mapId: string, correlationId?: string): void {
    if (!eventBus) return;

    const payload: MapUnloadedPayload = {
      mapId,
    };

    eventBus.publish(
      createEvent(EventTypes.MAP_UNLOADED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'map-feature',
      })
    );
  }

  function publishNavigated(
    previousMapId: string,
    newMapId: string,
    spawnPosition: HexCoordinate,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: MapNavigatedPayload = {
      previousMapId,
      newMapId,
      spawnPosition,
    };

    eventBus.publish(
      createEvent(EventTypes.MAP_NAVIGATED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'map-feature',
      })
    );
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  function setupEventHandlers(): void {
    if (!eventBus) return;

    // Handle map:load-requested
    subscriptions.push(
      eventBus.subscribe<MapLoadRequestedPayload>(
        EventTypes.MAP_LOAD_REQUESTED,
        async (event) => {
          const { mapId } = event.payload;
          const correlationId = event.correlationId;

          const result = await mapStorage.load(mapId as MapId);

          if (!result.ok) {
            publishLoadFailed(mapId, result.error, correlationId);
            return;
          }

          const map = result.value;

          // Validate map type
          if (map.type !== 'overworld') {
            const error = createError(
              'INVALID_MAP_TYPE',
              `Expected overworld map, got ${map.type}`
            );
            publishLoadFailed(mapId, error, correlationId);
            return;
          }

          // Update store
          store.setCurrentMap(map);

          // Publish events
          publishLoaded(map, correlationId);
          publishStateChanged(correlationId);
        }
      )
    );

    // Handle map:navigate-requested
    subscriptions.push(
      eventBus.subscribe<MapNavigateRequestedPayload>(
        EventTypes.MAP_NAVIGATE_REQUESTED,
        async (event) => {
          const { targetMapId } = event.payload;
          const correlationId = event.correlationId;

          // 1. Remember current map ID
          const currentMap = store.getState().currentMap;
          const previousMapId = currentMap?.id ?? '';

          // 2. Load target map
          const result = await mapStorage.load(targetMapId as MapId);

          if (!result.ok) {
            publishLoadFailed(targetMapId, result.error, correlationId);
            return;
          }

          const newMap = result.value;

          // 3. Validate map type (currently only overworld supported)
          if (newMap.type !== 'overworld') {
            const error = createError(
              'INVALID_MAP_TYPE',
              `Expected overworld map, got ${newMap.type}`
            );
            publishLoadFailed(targetMapId, error, correlationId);
            return;
          }

          // 4. Determine spawn position
          // Fallback order:
          // a) EntrancePOI spawnPosition (TODO: #1501 when implemented)
          // b) Map defaultSpawnPoint
          // c) {q: 0, r: 0} as fallback
          let spawnPosition: HexCoordinate = { q: 0, r: 0 };

          if (newMap.defaultSpawnPoint) {
            spawnPosition = newMap.defaultSpawnPoint as HexCoordinate;
          }

          // TODO: EntrancePOI lookup when #1501 is implemented
          // if (sourcePOIId) {
          //   const poi = poiStorage.get(sourcePOIId);
          //   if (poi && poi.type === 'entrance') {
          //     spawnPosition = poi.spawnPosition;
          //   }
          // }

          // 5. Update store
          store.setCurrentMap(newMap);

          // 6. Publish events (order matters!)
          publishLoaded(newMap, correlationId);
          publishNavigated(previousMapId, newMap.id, spawnPosition, correlationId);
          publishStateChanged(correlationId);
        }
      )
    );
  }

  // Set up event handlers immediately if eventBus is provided
  setupEventHandlers();

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
        // Publish load failed event
        publishLoadFailed(id, result.error);
        return result;
      }

      const map = result.value;

      // Validate map type
      if (map.type !== 'overworld') {
        const error = createError(
          'INVALID_MAP_TYPE',
          `Expected overworld map, got ${map.type}`
        );
        publishLoadFailed(id, error);
        return err(error);
      }

      // Update store
      store.setCurrentMap(map);

      // Publish events
      publishLoaded(map);
      publishStateChanged();

      return ok(map);
    },

    unloadMap(): void {
      const currentMap = store.getState().currentMap;
      const mapId = currentMap?.id;

      store.clear();

      // Publish events
      if (mapId) {
        publishUnloaded(mapId);
      }
      publishStateChanged();
    },

    // =========================================================================
    // Lifecycle
    // =========================================================================

    dispose(): void {
      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
