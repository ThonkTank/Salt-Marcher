/**
 * Map Feature store.
 *
 * Manages the currently loaded map state.
 * Single-map-active pattern: only one map loaded at a time.
 */

import type { OverworldMap, OverworldTile } from '@core/schemas';
import { buildTileLookup } from '@core/schemas';
import type { MapState } from './types';
import { createInitialMapState } from './types';

// ============================================================================
// Map Store
// ============================================================================

/**
 * Create a map store for managing map state.
 */
export function createMapStore() {
  let state: MapState = createInitialMapState();

  return {
    /**
     * Get current state (read-only).
     */
    getState(): Readonly<MapState> {
      return state;
    },

    /**
     * Set the current map.
     * Rebuilds the tile lookup cache.
     */
    setCurrentMap(map: OverworldMap | null): void {
      if (map) {
        state = {
          currentMap: map,
          tileLookup: buildTileLookup(map.tiles),
        };
      } else {
        state = createInitialMapState();
      }
    },

    /**
     * Get a tile by coordinate key.
     */
    getTile(key: string): OverworldTile | undefined {
      return state.tileLookup.get(key);
    },

    /**
     * Check if a tile exists at the given key.
     */
    hasTile(key: string): boolean {
      return state.tileLookup.has(key);
    },

    /**
     * Clear the store.
     */
    clear(): void {
      state = createInitialMapState();
    },
  };
}

export type MapStore = ReturnType<typeof createMapStore>;
