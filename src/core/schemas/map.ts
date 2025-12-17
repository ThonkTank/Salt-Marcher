/**
 * Map schema definitions.
 *
 * Defines OverworldMap (hex-based) for Travel-Minimal.
 * TownMap and DungeonMap schemas will be added post-MVP.
 */

import { z } from 'zod';
import { entityIdSchema, timestampSchema } from './common';
import { weatherStateSchema } from './weather';
import type { HexCoord } from '../utils/hex-math';

// ============================================================================
// Coordinate Schemas
// ============================================================================

/**
 * Axial hex coordinate schema.
 */
export const hexCoordSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
});

export type HexCoordinate = z.infer<typeof hexCoordSchema>;

// ============================================================================
// Map Type Schema
// ============================================================================

export const mapTypeSchema = z.enum(['overworld', 'town', 'dungeon']);
export type MapType = z.infer<typeof mapTypeSchema>;

// ============================================================================
// Overworld Tile Schema
// ============================================================================

/**
 * Schema for a single hex tile in an overworld map.
 */
export const overworldTileSchema = z.object({
  /** Axial coordinate of this tile */
  coordinate: hexCoordSchema,

  /** Reference to terrain definition */
  terrain: entityIdSchema('terrain'),

  /** Optional elevation value (for hillshade rendering) */
  elevation: z.number().optional(),

  /** POIs located on this tile */
  pois: z.array(entityIdSchema('location')).default([]),

  /** Optional GM notes for this tile */
  notes: z.string().optional(),
});

/**
 * OverworldTile type - uses z.output to get the type AFTER parsing
 * (with defaults applied), not the input type.
 */
export type OverworldTile = z.output<typeof overworldTileSchema>;

// ============================================================================
// Overworld Map Schema
// ============================================================================

/**
 * Schema for an overworld (hex) map.
 * This is the primary map type for Travel-Minimal.
 */
export const overworldMapSchema = z.object({
  /** Unique map identifier */
  id: entityIdSchema('map'),

  /** Map name */
  name: z.string().min(1),

  /** Map type discriminator */
  type: z.literal('overworld'),

  /** Grid dimensions (width x height in tiles) */
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),

  /**
   * Tiles stored as array (serialization-friendly).
   * Convert to Map<string, OverworldTile> using coordToKey() for fast lookup.
   */
  tiles: z.array(overworldTileSchema),

  /** Default spawn point for parties entering this map */
  defaultSpawnPoint: hexCoordSchema.optional(),

  /** Optional description */
  description: z.string().optional(),

  /** GM notes */
  gmNotes: z.string().optional(),

  /** Creation timestamp */
  createdAt: timestampSchema.optional(),

  /** Last update timestamp */
  updatedAt: timestampSchema.optional(),

  /**
   * Current weather state for this map.
   * Persisted to ensure session continuity.
   * From Weather-System.md lines 237-248.
   */
  currentWeather: weatherStateSchema.optional(),
});

/**
 * OverworldMap type - uses z.output to get the type AFTER parsing
 * (with defaults applied), not the input type.
 */
export type OverworldMap = z.output<typeof overworldMapSchema>;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert hex coordinate to string key for Map lookup.
 * Re-exported from hex-math for convenience.
 */
export function tileKey(coord: HexCoord | HexCoordinate): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Build a tile lookup map from the tiles array.
 */
export function buildTileLookup(
  tiles: OverworldTile[]
): Map<string, OverworldTile> {
  const lookup = new Map<string, OverworldTile>();
  for (const tile of tiles) {
    lookup.set(tileKey(tile.coordinate), tile);
  }
  return lookup;
}
