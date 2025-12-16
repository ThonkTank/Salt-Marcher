/**
 * Map Vault Adapter.
 *
 * For Travel-Minimal, this is a simple in-memory adapter that works with
 * fixture data. Real Obsidian vault integration will be added later.
 */

import type { Result, AppError, MapId } from '@core/index';
import { ok, err, createError, toEntityId } from '@core/index';
import type { OverworldMap, OverworldTile, HexCoordinate } from '@core/schemas';
import type { MapStoragePort } from '@/features/map';

// ============================================================================
// Test Map Data
// ============================================================================

/**
 * Generate the test overworld map.
 * This matches presets/maps/test-overworld.json
 */
function createTestOverworldMap(): OverworldMap {
  const tiles: OverworldTile[] = [];

  // Terrain layout (10x10 grid)
  // Row 0-9, with varied terrain
  const terrainGrid: string[][] = [
    ['plains', 'plains', 'forest', 'forest', 'hills', 'hills', 'mountains', 'mountains', 'plains', 'plains'],
    ['plains', 'road', 'road', 'forest', 'hills', 'hills', 'mountains', 'hills', 'plains', 'water'],
    ['plains', 'plains', 'road', 'road', 'road', 'hills', 'hills', 'plains', 'water', 'water'],
    ['swamp', 'plains', 'plains', 'plains', 'road', 'plains', 'plains', 'plains', 'water', 'water'],
    ['swamp', 'swamp', 'plains', 'plains', 'road', 'plains', 'desert', 'desert', 'plains', 'water'],
    ['swamp', 'plains', 'forest', 'forest', 'road', 'plains', 'desert', 'desert', 'desert', 'plains'],
    ['plains', 'forest', 'forest', 'forest', 'road', 'road', 'plains', 'desert', 'plains', 'plains'],
    ['plains', 'plains', 'forest', 'forest', 'plains', 'road', 'road', 'plains', 'plains', 'hills'],
    ['hills', 'plains', 'plains', 'forest', 'plains', 'plains', 'road', 'road', 'hills', 'hills'],
    ['hills', 'hills', 'plains', 'plains', 'plains', 'plains', 'plains', 'road', 'mountains', 'mountains'],
  ];

  for (let r = 0; r < 10; r++) {
    for (let q = 0; q < 10; q++) {
      const coordinate: HexCoordinate = { q, r };
      const terrain = terrainGrid[r][q];

      tiles.push({
        coordinate,
        terrain: toEntityId<'terrain'>(terrain),
        pois: [],
      });
    }
  }

  return {
    id: toEntityId<'map'>('test-overworld-001'),
    name: 'Test Overworld',
    type: 'overworld',
    dimensions: { width: 10, height: 10 },
    tiles,
    defaultSpawnPoint: { q: 5, r: 5 },
    description: 'A small test map with varied terrain for testing travel mechanics.',
  };
}

// ============================================================================
// Map Adapter
// ============================================================================

/**
 * Create an in-memory map adapter for Travel-Minimal.
 * Stores maps in memory and provides the test map by default.
 */
export function createMapAdapter(): MapStoragePort {
  // In-memory storage
  const maps = new Map<string, OverworldMap>();

  // Pre-populate with test map
  const testMap = createTestOverworldMap();
  maps.set(String(testMap.id), testMap);

  return {
    async load(id: MapId): Promise<Result<OverworldMap, AppError>> {
      const map = maps.get(String(id));

      if (!map) {
        return err(
          createError('MAP_NOT_FOUND', `Map not found: ${id}`)
        );
      }

      return ok(map);
    },

    async save(map: OverworldMap): Promise<Result<void, AppError>> {
      maps.set(String(map.id), map);
      return ok(undefined);
    },

    async listIds(): Promise<Result<MapId[], AppError>> {
      const ids = Array.from(maps.keys()).map((id) =>
        toEntityId<'map'>(id)
      );
      return ok(ids);
    },

    async exists(id: MapId): Promise<boolean> {
      return maps.has(String(id));
    },
  };
}

/**
 * Get the test map ID for bootstrapping.
 */
export const TEST_MAP_ID = toEntityId<'map'>('test-overworld-001');
