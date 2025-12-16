/**
 * Terrain schema definitions.
 *
 * TerrainDefinition defines terrain types with movement costs and rendering properties.
 * Used by Map-Feature for tile terrain lookup and Travel-Feature for speed calculation.
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Terrain Definition Schema
// ============================================================================

/**
 * Schema for a terrain type definition.
 * Terrains are referenced by ID from OverworldTile.terrain.
 */
export const terrainDefinitionSchema = z.object({
  /** Unique terrain identifier */
  id: entityIdSchema('terrain'),

  /** Display name (e.g., "Plains", "Dense Forest") */
  name: z.string().min(1),

  /**
   * Movement cost multiplier.
   * 1.0 = normal speed, 0.5 = half speed, 2.0 = double speed.
   *
   * Default values from Travel-System.md:
   * - road: 1.0
   * - plains: 0.9
   * - forest: 0.6
   * - hills: 0.7
   * - mountains: 0.4
   * - swamp: 0.5
   * - desert: 0.7
   * - water: 1.0 (requires boat)
   */
  movementCost: z.number().positive(),

  /** Hex fill color for map rendering (CSS color string) */
  color: z.string().min(1),

  /** Optional description for tooltips */
  description: z.string().optional(),

  /** Whether this terrain requires a boat to traverse */
  requiresBoat: z.boolean().optional(),

  /** Whether mounted travel is blocked */
  blocksMounted: z.boolean().optional(),

  /** Whether carriage travel is blocked */
  blocksCarriage: z.boolean().optional(),
});

/** Inferred type from schema */
export type TerrainDefinition = z.infer<typeof terrainDefinitionSchema>;

// ============================================================================
// Terrain Registry (Built-in Terrains)
// ============================================================================

/**
 * Built-in terrain IDs for type-safe terrain references.
 * Maps to preset terrain definitions.
 */
export const TERRAIN_IDS = {
  ROAD: 'road',
  PLAINS: 'plains',
  FOREST: 'forest',
  HILLS: 'hills',
  MOUNTAINS: 'mountains',
  SWAMP: 'swamp',
  DESERT: 'desert',
  WATER: 'water',
} as const;

export type BuiltinTerrainId = (typeof TERRAIN_IDS)[keyof typeof TERRAIN_IDS];
