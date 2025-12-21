/**
 * Terrain schema definitions.
 *
 * TerrainDefinition defines terrain types with movement costs, encounter modifiers,
 * and rendering properties. Used by Map-Feature for tile terrain lookup,
 * Travel-Feature for speed calculation, and Encounter-Feature for creature selection.
 */

import { z } from 'zod';
import { entityIdSchema } from './common';
import { terrainWeatherRangesSchema } from './weather';

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

  // -------------------------------------------------------------------------
  // Movement Mechanics
  // -------------------------------------------------------------------------

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

  /** Whether this terrain requires a boat to traverse */
  requiresBoat: z.boolean().optional(),

  /** Whether mounted travel is blocked */
  blocksMounted: z.boolean().optional(),

  /** Whether carriage travel is blocked */
  blocksCarriage: z.boolean().optional(),

  // -------------------------------------------------------------------------
  // Encounter System
  // -------------------------------------------------------------------------

  /**
   * Encounter chance multiplier for this terrain.
   * 1.0 = normal, <1.0 = fewer encounters, >1.0 = more encounters.
   *
   * Default values from Terrain.md:
   * - road: 0.5
   * - plains: 1.0
   * - forest: 1.2
   * - hills: 1.0
   * - mountains: 0.8
   * - swamp: 1.5
   * - desert: 0.7
   * - water: 0.5
   */
  encounterModifier: z.number().positive().default(1.0),

  /**
   * Creatures native to this terrain.
   * Used by Encounter-System for creature selection.
   * Bidirectionally synced with creature.terrainAffinities.
   */
  nativeCreatures: z.array(entityIdSchema('creature')).default([]),

  // -------------------------------------------------------------------------
  // Weather
  // -------------------------------------------------------------------------

  /**
   * Weather ranges for this terrain type.
   * Used by Weather-System for terrain-based weather generation.
   */
  weatherRanges: terrainWeatherRangesSchema,

  // -------------------------------------------------------------------------
  // Visual Presentation
  // -------------------------------------------------------------------------

  /** Hex fill color for map rendering (CSS color string) */
  displayColor: z.string().min(1),

  /** Optional icon reference for UI display */
  icon: z.string().optional(),

  /** Optional description for tooltips */
  description: z.string().optional(),
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
