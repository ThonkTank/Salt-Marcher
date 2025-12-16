/**
 * Terrain Registry - In-memory terrain definitions.
 *
 * Loads terrain definitions from presets and provides lookup.
 * Implements TerrainStoragePort interface.
 */

import type { TerrainId, Option } from '@core/index';
import { some, none, toEntityId } from '@core/index';
import type { TerrainDefinition } from '@core/schemas';
import type { TerrainStoragePort } from '@/features/map';

// ============================================================================
// Default Terrain Definitions
// ============================================================================

/**
 * Built-in terrain definitions.
 * These match the presets/terrains/base-terrains.json file.
 */
const DEFAULT_TERRAINS: TerrainDefinition[] = [
  {
    id: toEntityId<'terrain'>('road'),
    name: 'Road',
    movementCost: 1.0,
    color: '#8B7355',
    description: 'Well-maintained road. Normal travel speed.',
  },
  {
    id: toEntityId<'terrain'>('plains'),
    name: 'Plains',
    movementCost: 0.9,
    color: '#90B050',
    description: 'Open grassland. Slightly slower than roads.',
  },
  {
    id: toEntityId<'terrain'>('forest'),
    name: 'Forest',
    movementCost: 0.6,
    color: '#228B22',
    description: 'Dense woodland. Significantly slower travel.',
    blocksMounted: true,
  },
  {
    id: toEntityId<'terrain'>('hills'),
    name: 'Hills',
    movementCost: 0.7,
    color: '#A0A050',
    description: 'Rolling terrain with elevation changes.',
  },
  {
    id: toEntityId<'terrain'>('mountains'),
    name: 'Mountains',
    movementCost: 0.4,
    color: '#808080',
    description: 'Steep mountain terrain. Very slow, foot only.',
    blocksMounted: true,
    blocksCarriage: true,
  },
  {
    id: toEntityId<'terrain'>('swamp'),
    name: 'Swamp',
    movementCost: 0.5,
    color: '#6B8E6B',
    description: 'Boggy wetland. Difficult terrain, foot only.',
    blocksMounted: true,
    blocksCarriage: true,
  },
  {
    id: toEntityId<'terrain'>('desert'),
    name: 'Desert',
    movementCost: 0.7,
    color: '#EDC9AF',
    description: 'Arid sandy terrain. Heat and sand slow travel.',
  },
  {
    id: toEntityId<'terrain'>('water'),
    name: 'Water',
    movementCost: 1.0,
    color: '#4169E1',
    description: 'Deep water. Requires a boat to cross.',
    requiresBoat: true,
  },
];

// ============================================================================
// Terrain Registry
// ============================================================================

/**
 * Create a terrain registry.
 * Optionally accepts additional terrain definitions to merge with defaults.
 */
export function createTerrainRegistry(
  additionalTerrains: TerrainDefinition[] = []
): TerrainStoragePort {
  // Build lookup map
  const terrainMap = new Map<string, TerrainDefinition>();

  // Add default terrains
  for (const terrain of DEFAULT_TERRAINS) {
    terrainMap.set(String(terrain.id), terrain);
  }

  // Add additional terrains (can override defaults)
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
