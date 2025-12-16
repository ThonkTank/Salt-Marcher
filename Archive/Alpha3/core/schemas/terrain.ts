/**
 * Terrain Schema - Terrain type definitions and registry
 *
 * Terrains define visual and mechanical properties of map tiles:
 * - Display color for rendering
 * - Travel speed modifier for movement
 * - Creature types for encounter generation
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════

export const TerrainConfigSchema = z.object({
  /** Unique identifier (lowercase, hyphenated) */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),

  /** Display name */
  name: z.string().min(1),

  /** Optional description */
  description: z.string().optional(),

  /** Hex color for map rendering (e.g., "#228B22") */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),

  /**
   * Travel time multiplier:
   * - 1.0 = normal speed
   * - 2.0 = takes twice as long (difficult terrain)
   * - 0.5 = takes half as long (road/easy terrain)
   */
  travelMultiplier: z.number().min(0).default(1),

  /**
   * D&D creature types commonly found in this terrain
   * Used for encounter generation filtering
   */
  creatureTypes: z.array(z.string()).default([]),

  /** Optional tags for filtering/categorization */
  tags: z.array(z.string()).default([]),
});

export type TerrainConfig = z.infer<typeof TerrainConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Built-in Terrain Registry
// ═══════════════════════════════════════════════════════════════

/**
 * Built-in terrain types based on D&D 5e environment categories
 */
export const TERRAIN_REGISTRY: Record<string, TerrainConfig> = {
  grassland: {
    id: 'grassland',
    name: 'Grassland',
    description: 'Open plains and meadows with tall grasses',
    color: '#90EE90',
    travelMultiplier: 1,
    creatureTypes: ['beast', 'humanoid', 'plant'],
    tags: ['open', 'temperate'],
  },

  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Dense woodland with trees and undergrowth',
    color: '#228B22',
    travelMultiplier: 1.5,
    creatureTypes: ['beast', 'fey', 'plant', 'monstrosity'],
    tags: ['difficult', 'temperate', 'cover'],
  },

  mountain: {
    id: 'mountain',
    name: 'Mountain',
    description: 'High peaks and rocky terrain',
    color: '#8B4513',
    travelMultiplier: 2,
    creatureTypes: ['beast', 'dragon', 'giant', 'elemental'],
    tags: ['difficult', 'elevation', 'cold'],
  },

  hill: {
    id: 'hill',
    name: 'Hill',
    description: 'Rolling hills and elevated terrain',
    color: '#BDB76B',
    travelMultiplier: 1.25,
    creatureTypes: ['beast', 'giant', 'humanoid'],
    tags: ['elevation', 'temperate'],
  },

  desert: {
    id: 'desert',
    name: 'Desert',
    description: 'Arid wasteland with sand dunes',
    color: '#F4A460',
    travelMultiplier: 1.5,
    creatureTypes: ['beast', 'monstrosity', 'elemental'],
    tags: ['difficult', 'hot', 'dry'],
  },

  swamp: {
    id: 'swamp',
    name: 'Swamp',
    description: 'Wetlands with murky water and dense vegetation',
    color: '#556B2F',
    travelMultiplier: 2,
    creatureTypes: ['beast', 'undead', 'aberration', 'plant'],
    tags: ['difficult', 'wet', 'cover'],
  },

  coast: {
    id: 'coast',
    name: 'Coast',
    description: 'Shoreline between land and sea',
    color: '#87CEEB',
    travelMultiplier: 1,
    creatureTypes: ['beast', 'elemental', 'humanoid'],
    tags: ['water', 'temperate'],
  },

  arctic: {
    id: 'arctic',
    name: 'Arctic',
    description: 'Frozen tundra and ice fields',
    color: '#E0FFFF',
    travelMultiplier: 2,
    creatureTypes: ['beast', 'elemental', 'giant'],
    tags: ['difficult', 'cold'],
  },

  urban: {
    id: 'urban',
    name: 'Urban',
    description: 'Cities, towns, and settlements',
    color: '#A9A9A9',
    travelMultiplier: 0.75,
    creatureTypes: ['humanoid', 'construct'],
    tags: ['civilized', 'road'],
  },

  underdark: {
    id: 'underdark',
    name: 'Underdark',
    description: 'Vast underground caverns and tunnels',
    color: '#4B0082',
    travelMultiplier: 1.5,
    creatureTypes: ['aberration', 'ooze', 'undead', 'fiend'],
    tags: ['difficult', 'underground', 'dark'],
  },

  water: {
    id: 'water',
    name: 'Water',
    description: 'Lakes, rivers, and shallow seas',
    color: '#4169E1',
    travelMultiplier: 1, // With boat
    creatureTypes: ['beast', 'elemental', 'monstrosity'],
    tags: ['water', 'impassable-foot'],
  },

  deepwater: {
    id: 'deepwater',
    name: 'Deep Water',
    description: 'Open ocean and deep seas',
    color: '#000080',
    travelMultiplier: 1, // With ship
    creatureTypes: ['beast', 'elemental', 'monstrosity', 'dragon'],
    tags: ['water', 'impassable-foot', 'deep'],
  },

  road: {
    id: 'road',
    name: 'Road',
    description: 'Maintained roads and highways',
    color: '#D2B48C',
    travelMultiplier: 0.5,
    creatureTypes: ['humanoid'],
    tags: ['easy', 'civilized'],
  },

  jungle: {
    id: 'jungle',
    name: 'Jungle',
    description: 'Dense tropical rainforest',
    color: '#006400',
    travelMultiplier: 2,
    creatureTypes: ['beast', 'plant', 'monstrosity', 'humanoid'],
    tags: ['difficult', 'hot', 'wet', 'cover'],
  },
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get a terrain by ID from the built-in registry
 * Returns undefined if not found
 */
export function getBuiltinTerrain(id: string): TerrainConfig | undefined {
  return TERRAIN_REGISTRY[id];
}

/**
 * Get all built-in terrain IDs
 */
export function getBuiltinTerrainIds(): string[] {
  return Object.keys(TERRAIN_REGISTRY);
}

/**
 * Get all built-in terrains as array
 */
export function getAllBuiltinTerrains(): TerrainConfig[] {
  return Object.values(TERRAIN_REGISTRY);
}

/**
 * Check if a terrain ID exists in the built-in registry
 */
export function isBuiltinTerrain(id: string): boolean {
  return id in TERRAIN_REGISTRY;
}

/**
 * Create a custom terrain with validation
 */
export function createTerrain(config: z.input<typeof TerrainConfigSchema>): TerrainConfig {
  return TerrainConfigSchema.parse(config);
}

// ═══════════════════════════════════════════════════════════════
// Terrain Aliases (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

/**
 * Map of terrain aliases to canonical IDs
 */
export const TERRAIN_ALIASES: Record<string, string> = {
  plains: 'grassland',
  hills: 'hill',
  coastal: 'coast',
  mountains: 'mountain',
  forests: 'forest',
  deserts: 'desert',
  swamps: 'swamp',
  ocean: 'deepwater',
  sea: 'water',
  lake: 'water',
  river: 'water',
  city: 'urban',
  town: 'urban',
  village: 'urban',
};

/**
 * Resolve a terrain ID, handling aliases
 */
export function resolveTerrainId(id: string): string {
  return TERRAIN_ALIASES[id] ?? id;
}
