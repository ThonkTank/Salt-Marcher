/**
 * Map schema definitions.
 *
 * Defines OverworldMap (hex-based) for Travel-Minimal.
 * TownMap and DungeonMap schemas will be added post-MVP.
 */

import { z } from 'zod';
import { entityIdSchema, timestampSchema } from './common';
import { weatherStateSchema } from './weather';
import { factionPresenceSchema } from './faction';
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
// Base Map Schema
// ============================================================================

/**
 * Base schema for all map types.
 * Shared fields for OverworldMap, TownMap, DungeonMap.
 * From Map-Feature.md#basis-map
 */
export const baseMapSchema = z.object({
  /** Unique map identifier */
  id: entityIdSchema('map'),

  /** Map name */
  name: z.string().min(1),

  /** Map type discriminator */
  type: mapTypeSchema,

  /** Default spawn point for parties entering this map */
  defaultSpawnPoint: hexCoordSchema.optional(),

  /** Optional description */
  description: z.string().optional(),

  /** GM notes */
  gmNotes: z.string().optional(),
});

export type BaseMap = z.infer<typeof baseMapSchema>;

// ============================================================================
// Encounter Zone Schema
// ============================================================================

/**
 * Encounter zone configuration for a tile.
 * From Map-Feature.md#encounterzone
 */
export const encounterZoneSchema = z.object({
  /** Chance of encounter (0.0 - 1.0) */
  encounterChance: z.number().min(0).max(1),

  /** Creature pool for random encounters */
  creaturePool: z.array(entityIdSchema('creature')),

  /** Optional faction controlling this zone */
  factionId: entityIdSchema('faction').optional(),
});

export type EncounterZone = z.infer<typeof encounterZoneSchema>;

// ============================================================================
// Faction Overlay Schema
// ============================================================================

/**
 * Precomputed territory boundary for a faction.
 * From Faction.md - used for territory visualization.
 */
export const factionTerritorySchema = z.object({
  /** Faction this territory belongs to */
  factionId: entityIdSchema('faction'),

  /** Polygon boundary as hex coordinates */
  boundary: z.array(hexCoordSchema),
});

export type FactionTerritory = z.infer<typeof factionTerritorySchema>;

/**
 * Faction overlay containing precomputed territory boundaries.
 * Boundaries are calculated in Cartographer and stored for rendering performance.
 */
export const factionOverlaySchema = z.object({
  /** Precomputed territory boundaries per faction */
  territories: z.array(factionTerritorySchema),
});

export type FactionOverlay = z.infer<typeof factionOverlaySchema>;

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
  pois: z.array(entityIdSchema('poi')).default([]),

  /** Optional encounter zone configuration */
  encounterZone: encounterZoneSchema.optional(),

  /** Faction presence at this tile (for encounter selection) */
  factionPresence: z.array(factionPresenceSchema).default([]),

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
 * Extends BaseMap with overworld-specific fields.
 * This is the primary map type for Travel-Minimal.
 */
export const overworldMapSchema = baseMapSchema
  .omit({ type: true }) // Remove generic type to override with literal
  .extend({
    /** Map type discriminator - overworld specific */
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

    /**
     * Precomputed faction territory boundaries.
     * Calculated in Cartographer based on controlledPOIs.
     * From Faction.md - used for territory overlay rendering.
     */
    factionOverlay: factionOverlaySchema.optional(),
  });

/**
 * OverworldMap type - uses z.output to get the type AFTER parsing
 * (with defaults applied), not the input type.
 */
export type OverworldMap = z.output<typeof overworldMapSchema>;

// ============================================================================
// Grid Coordinate Schema (for DungeonMap)
// ============================================================================

/**
 * 3D grid coordinate for dungeon maps.
 * From Map-Feature.md#dungeonmap
 */
export const gridCoordSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(), // Level/height
});

export type GridCoordinate = z.infer<typeof gridCoordSchema>;

// ============================================================================
// Dungeon Content Schemas
// ============================================================================

/**
 * Trap schema for dungeon tiles.
 * From Map-Feature.md#dungeontile
 */
export const trapSchema = z.object({
  id: z.string(),
  dc: z.number().int().positive(),
  damage: z.string(), // e.g. "2d6 fire"
  triggered: z.boolean().default(false),
  visible: z.boolean().default(false),
});

export type Trap = z.infer<typeof trapSchema>;

/**
 * Token schema for creature placement in dungeons.
 * From Map-Feature.md#dungeontile
 */
export const tokenSchema = z.object({
  id: z.string(),
  creatureId: entityIdSchema('creature'),
  position: gridCoordSchema,
  currentHp: z.number().int(),
});

export type Token = z.infer<typeof tokenSchema>;

// ============================================================================
// Dungeon Tile Schema
// ============================================================================

/**
 * Dungeon tile type enumeration.
 */
export const dungeonTileTypeSchema = z.enum([
  'floor',
  'wall',
  'door',
  'secret-door',
  'stairs',
]);

export type DungeonTileType = z.infer<typeof dungeonTileTypeSchema>;

/**
 * Lighting levels for dungeon tiles.
 */
export const dungeonLightingSchema = z.enum(['bright', 'dim', 'dark']);

export type DungeonLighting = z.infer<typeof dungeonLightingSchema>;

/**
 * Schema for a single grid tile in a dungeon map.
 * From Map-Feature.md#dungeontile
 */
export const dungeonTileSchema = z.object({
  /** Grid coordinate of this tile */
  coordinate: gridCoordSchema,

  /** Tile type (floor, wall, door, etc.) */
  type: dungeonTileTypeSchema,

  /** Optional room this tile belongs to */
  roomId: z.string().optional(),

  /** Traps on this tile */
  traps: z.array(trapSchema).default([]),

  /** Creature tokens on this tile */
  creatures: z.array(tokenSchema).default([]),

  /** Treasure items on this tile */
  treasure: z.array(entityIdSchema('item')).default([]),

  /** Lighting level */
  lighting: dungeonLightingSchema.default('dark'),

  /** Whether this tile has been explored (Fog of War) */
  explored: z.boolean().default(false),
});

/**
 * DungeonTile type - uses z.output to get the type AFTER parsing
 * (with defaults applied).
 */
export type DungeonTile = z.output<typeof dungeonTileSchema>;

// ============================================================================
// Dungeon Room Schema
// ============================================================================

/**
 * Schema for a dungeon room.
 * From Map-Feature.md#dungeonroom
 */
export const dungeonRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  tiles: z.array(gridCoordSchema),
  description: z.string(), // Read-aloud text
  gmNotes: z.string().optional(),
});

export type DungeonRoom = z.infer<typeof dungeonRoomSchema>;

// ============================================================================
// Dungeon Map Schema
// ============================================================================

/**
 * Schema for a dungeon (grid) map.
 * Extends BaseMap with dungeon-specific fields.
 * From Map-Feature.md#dungeonmap
 */
export const dungeonMapSchema = baseMapSchema
  .omit({ type: true, defaultSpawnPoint: true }) // Remove to override
  .extend({
    /** Map type discriminator - dungeon specific */
    type: z.literal('dungeon'),

    /** 3D grid dimensions (width x height x levels) */
    dimensions: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      levels: z.number().int().positive().default(1),
    }),

    /**
     * Tiles stored as array (serialization-friendly).
     * Convert to Map<string, DungeonTile> using gridKey() for fast lookup.
     */
    tiles: z.array(dungeonTileSchema),

    /** Rooms in this dungeon */
    rooms: z.array(dungeonRoomSchema).default([]),

    /** Current party position in the dungeon */
    partyPosition: gridCoordSchema.optional(),

    /** Default spawn point for dungeon (grid coord) */
    defaultSpawnPoint: gridCoordSchema.optional(),
  });

/**
 * DungeonMap type - uses z.output to get the type AFTER parsing
 * (with defaults applied).
 */
export type DungeonMap = z.output<typeof dungeonMapSchema>;

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

/**
 * Convert grid coordinate to string key for Map lookup.
 */
export function gridKey(coord: GridCoordinate): string {
  return `${coord.x},${coord.y},${coord.z}`;
}

/**
 * Build a dungeon tile lookup map from the tiles array.
 */
export function buildDungeonTileLookup(
  tiles: DungeonTile[]
): Map<string, DungeonTile> {
  const lookup = new Map<string, DungeonTile>();
  for (const tile of tiles) {
    lookup.set(gridKey(tile.coordinate), tile);
  }
  return lookup;
}
