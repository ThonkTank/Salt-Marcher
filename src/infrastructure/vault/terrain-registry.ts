/**
 * Terrain Registry - In-memory terrain definitions.
 *
 * Loads terrain definitions from bundled presets and provides lookup.
 * Implements TerrainStoragePort interface.
 *
 * Phase 1 (MVP): Plugin-bundled presets only (readonly)
 * Phase 2: User custom terrains from Vault (merged with bundled)
 */

import type { TerrainId, Option } from '@core/index';
import { some, none, toEntityId } from '@core/index';
import { terrainDefinitionSchema, type TerrainDefinition } from '@core/schemas';
import type { TerrainStoragePort } from '@/features/map';

// Import bundled presets at build time (esbuild handles JSON import)
import baseTerrains from '../../../presets/terrains/base-terrains.json';

// ============================================================================
// Bundled Preset Loading
// ============================================================================

/**
 * Load and validate terrain definitions from bundled presets.
 * Converts raw JSON id strings to branded EntityId types.
 */
function loadBundledTerrains(): TerrainDefinition[] {
  return baseTerrains.terrains
    .map((rawTerrain) => {
      // Convert string id to branded EntityId
      const terrainWithId = {
        ...rawTerrain,
        id: toEntityId<'terrain'>(rawTerrain.id),
        // Convert creature id strings to branded EntityIds (if any exist)
        nativeCreatures: (rawTerrain.nativeCreatures ?? []).map((id: string) =>
          toEntityId<'creature'>(id)
        ),
      };

      // Validate against schema
      const result = terrainDefinitionSchema.safeParse(terrainWithId);

      if (!result.success) {
        console.warn(
          `[TerrainRegistry] Invalid bundled terrain: ${rawTerrain.id}`,
          result.error.format()
        );
        return null;
      }

      return result.data;
    })
    .filter((t): t is TerrainDefinition => t !== null);
}

// ============================================================================
// Terrain Registry
// ============================================================================

/**
 * Create a terrain registry.
 * Loads bundled presets and optionally merges additional terrain definitions.
 *
 * @param additionalTerrains - Optional user/custom terrains to merge (can override bundled)
 */
export function createTerrainRegistry(
  additionalTerrains: TerrainDefinition[] = []
): TerrainStoragePort {
  // Build lookup map
  const terrainMap = new Map<string, TerrainDefinition>();

  // Load bundled presets
  const bundledTerrains = loadBundledTerrains();
  for (const terrain of bundledTerrains) {
    terrainMap.set(String(terrain.id), terrain);
  }

  // Add additional terrains (can override bundled)
  for (const terrain of additionalTerrains) {
    terrainMap.set(String(terrain.id), terrain);
  }

  return {
    get(id: TerrainId): Option<TerrainDefinition> {
      const terrain = terrainMap.get(String(id));
      return terrain ? some(terrain) : none();
    },

    getAll(): TerrainDefinition[] {
      return Array.from(terrainMap.values());
    },
  };
}
