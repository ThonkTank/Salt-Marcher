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
    encounterModifier: 0.5,
    nativeCreatures: [],
    displayColor: '#8B7355',
    description: 'Well-maintained road. Normal travel speed.',
    weatherRanges: {
      temperature: { min: -5, average: 15, max: 35 },
      wind: { min: 5, average: 20, max: 60 },
      precipitation: { min: 10, average: 30, max: 70 },
    },
  },
  {
    id: toEntityId<'terrain'>('plains'),
    name: 'Plains',
    movementCost: 0.9,
    encounterModifier: 1.0,
    nativeCreatures: [],
    displayColor: '#90B050',
    description: 'Open grassland. Slightly slower than roads.',
    weatherRanges: {
      temperature: { min: -5, average: 15, max: 35 },
      wind: { min: 5, average: 20, max: 60 },
      precipitation: { min: 10, average: 30, max: 70 },
    },
  },
  {
    id: toEntityId<'terrain'>('forest'),
    name: 'Forest',
    movementCost: 0.6,
    encounterModifier: 1.2,
    nativeCreatures: [],
    blocksMounted: true,
    displayColor: '#228B22',
    description: 'Dense woodland. Significantly slower travel.',
    weatherRanges: {
      temperature: { min: 0, average: 15, max: 30 },
      wind: { min: 0, average: 10, max: 30 },
      precipitation: { min: 20, average: 40, max: 70 },
    },
  },
  {
    id: toEntityId<'terrain'>('hills'),
    name: 'Hills',
    movementCost: 0.7,
    encounterModifier: 1.0,
    nativeCreatures: [],
    displayColor: '#A0A050',
    description: 'Rolling terrain with elevation changes.',
    weatherRanges: {
      temperature: { min: -10, average: 10, max: 30 },
      wind: { min: 10, average: 30, max: 50 },
      precipitation: { min: 15, average: 35, max: 65 },
    },
  },
  {
    id: toEntityId<'terrain'>('mountains'),
    name: 'Mountains',
    movementCost: 0.4,
    encounterModifier: 0.8,
    nativeCreatures: [],
    blocksMounted: true,
    blocksCarriage: true,
    displayColor: '#808080',
    description: 'Steep mountain terrain. Very slow, foot only.',
    weatherRanges: {
      temperature: { min: -20, average: 0, max: 20 },
      wind: { min: 20, average: 50, max: 100 },
      precipitation: { min: 20, average: 50, max: 80 },
    },
  },
  {
    id: toEntityId<'terrain'>('swamp'),
    name: 'Swamp',
    movementCost: 0.5,
    encounterModifier: 1.5,
    nativeCreatures: [],
    blocksMounted: true,
    blocksCarriage: true,
    displayColor: '#6B8E6B',
    description: 'Boggy wetland. Difficult terrain, foot only.',
    weatherRanges: {
      temperature: { min: 5, average: 20, max: 35 },
      wind: { min: 0, average: 10, max: 30 },
      precipitation: { min: 40, average: 60, max: 90 },
    },
  },
  {
    id: toEntityId<'terrain'>('desert'),
    name: 'Desert',
    movementCost: 0.7,
    encounterModifier: 0.7,
    nativeCreatures: [],
    displayColor: '#EDC9AF',
    description: 'Arid sandy terrain. Heat and sand slow travel.',
    weatherRanges: {
      temperature: { min: 0, average: 35, max: 50 },
      wind: { min: 5, average: 15, max: 80 },
      precipitation: { min: 0, average: 5, max: 20 },
    },
  },
  {
    id: toEntityId<'terrain'>('water'),
    name: 'Water',
    movementCost: 1.0,
    encounterModifier: 0.5,
    nativeCreatures: [],
    requiresBoat: true,
    displayColor: '#4169E1',
    description: 'Deep water. Requires a boat to cross.',
    weatherRanges: {
      temperature: { min: 5, average: 18, max: 30 },
      wind: { min: 10, average: 30, max: 80 },
      precipitation: { min: 20, average: 40, max: 70 },
    },
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
