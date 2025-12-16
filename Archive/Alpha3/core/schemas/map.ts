/**
 * Map Schema - Data structures for map storage
 *
 * Supports multiple map types through discriminated unions:
 * - Hex maps for overland exploration
 * - Grid maps for combat/dungeons (planned)
 * - Pixel maps for towns (planned)
 */

import { z } from 'zod';
import { entityIdSchema, TimestampSchema, createEntityId, now } from '../types/common';
import type { EntityId, Timestamp } from '../types/common';
import { HexCoordinateSchema } from './coordinates';
import type { HexCoordinate } from './coordinates';
import { ClimateDataSchema, DEFAULT_CLIMATE } from './climate';
import type { ClimateData } from './climate';
import { type CoordKey, coordToKey, hexesInRadius, HEX_ORIGIN } from './hex-geometry';

// ═══════════════════════════════════════════════════════════════
// Map Metadata
// ═══════════════════════════════════════════════════════════════

export const MapMetadataSchema = z.object({
  /** Unique map identifier */
  id: entityIdSchema<'map'>(),

  /** Display name */
  name: z.string().min(1),

  /** Map type discriminator */
  type: z.enum(['hex', 'grid', 'pixel']),

  /** Creation timestamp */
  createdAt: TimestampSchema,

  /** Last modification timestamp */
  modifiedAt: TimestampSchema,

  // ─────────────────────────────────────────────────────────────
  // Hex-specific (optional for other types)
  // ─────────────────────────────────────────────────────────────

  /** Hex size in pixels (center to corner) */
  hexSize: z.number().min(12).max(200).default(42).optional(),

  /** Map center coordinate */
  center: HexCoordinateSchema.optional(),

  /** Map radius in hex steps */
  radius: z.number().int().min(1).max(50).optional(),

  /** Default terrain for new/empty tiles */
  defaultTerrain: z.string().default('grassland'),
});

export type MapMetadata = z.infer<typeof MapMetadataSchema>;

// ═══════════════════════════════════════════════════════════════
// Hex Tile Data
// ═══════════════════════════════════════════════════════════════

export const HexTileDataSchema = z.object({
  /** Terrain type ID */
  terrain: z.string(),

  /** Climate data for weather generation */
  climate: ClimateDataSchema,

  /** Elevation in meters (0 = sea level) */
  elevation: z.number().default(0),

  /** Region name (for grouping/naming) */
  region: z.string().optional(),

  /** Faction ID (for territorial control) */
  faction: z.string().optional(),

  /** GM notes */
  note: z.string().optional(),
});

export type HexTileData = z.infer<typeof HexTileDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Hex Map Data
// ═══════════════════════════════════════════════════════════════

export const HexMapDataSchema = z.object({
  /** Discriminator for map type */
  type: z.literal('hex'),

  /** Map metadata */
  metadata: MapMetadataSchema,

  /**
   * Tile data indexed by coordinate key ("q,r")
   * Dense storage: all tiles in radius are present
   */
  tiles: z.record(z.string(), HexTileDataSchema),
});

export type HexMapData = z.infer<typeof HexMapDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Union Type for All Maps (Extensible)
// ═══════════════════════════════════════════════════════════════

// Currently only hex maps are supported
// Grid and pixel maps will be added later

export const MapDataSchema = z.discriminatedUnion('type', [
  HexMapDataSchema,
  // GridMapDataSchema,  // TODO: Combat/Dungeon maps
  // PixelMapDataSchema, // TODO: Town maps
]);

export type MapData = z.infer<typeof MapDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Map Creation
// ═══════════════════════════════════════════════════════════════

export interface CreateHexMapOptions {
  /** Default terrain type for all tiles */
  defaultTerrain?: string;
  /** Default climate for all tiles */
  defaultClimate?: ClimateData;
  /** Hex size in pixels */
  hexSize?: number;
  /** Optional predefined ID */
  id?: EntityId<'map'>;
}

/**
 * Create a new hex map with all tiles in radius filled with defaults
 * DENSE storage: every hex in the radius is initialized
 *
 * @param name Display name for the map
 * @param radius Map radius in hex steps (1-50)
 * @param options Optional configuration
 */
export function createHexMap(
  name: string,
  radius: number,
  options?: CreateHexMapOptions
): HexMapData {
  const terrain = options?.defaultTerrain ?? 'grassland';
  const climate = options?.defaultClimate ?? DEFAULT_CLIMATE;
  const hexSize = options?.hexSize ?? 42;
  const id = options?.id ?? createEntityId('map');
  const timestamp = now();

  // Initialize all tiles in radius with default data
  const tiles: Record<CoordKey, HexTileData> = {};

  for (const coord of hexesInRadius(HEX_ORIGIN, radius)) {
    const key = coordToKey(coord);
    tiles[key] = {
      terrain,
      climate: { ...climate },
      elevation: 0,
    };
  }

  return {
    type: 'hex',
    metadata: {
      id,
      name,
      type: 'hex',
      createdAt: timestamp,
      modifiedAt: timestamp,
      hexSize,
      center: { ...HEX_ORIGIN },
      radius,
      defaultTerrain: terrain,
    },
    tiles,
  };
}

// ═══════════════════════════════════════════════════════════════
// Map Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Get tile data at a coordinate
 */
export function getTile(map: HexMapData, coord: HexCoordinate): HexTileData | undefined {
  const key = coordToKey(coord);
  return map.tiles[key];
}

/**
 * Set tile data at a coordinate (mutates map)
 */
export function setTile(
  map: HexMapData,
  coord: HexCoordinate,
  data: Partial<HexTileData>
): void {
  const key = coordToKey(coord);
  const existing = map.tiles[key];

  if (existing) {
    map.tiles[key] = { ...existing, ...data };
  } else {
    // Create new tile with defaults
    map.tiles[key] = {
      terrain: map.metadata.defaultTerrain ?? 'grassland',
      climate: { ...DEFAULT_CLIMATE },
      elevation: 0,
      ...data,
    };
  }

  map.metadata.modifiedAt = now();
}

/**
 * Check if a coordinate is within the map's radius
 */
export function isInMapBounds(map: HexMapData, coord: HexCoordinate): boolean {
  const key = coordToKey(coord);
  return key in map.tiles;
}

/**
 * Get all coordinates in the map
 */
export function getMapCoords(map: HexMapData): HexCoordinate[] {
  return Object.keys(map.tiles).map((key) => {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  });
}

/**
 * Calculate the tile count for a given radius
 * Formula: 3r² + 3r + 1
 */
export function calculateTileCount(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

/**
 * Extract map metadata for list displays
 */
export function toMapListEntry(map: MapData): {
  id: EntityId<'map'>;
  name: string;
  type: string;
  modifiedAt: Timestamp;
} {
  return {
    id: map.metadata.id,
    name: map.metadata.name,
    type: map.type,
    modifiedAt: map.metadata.modifiedAt,
  };
}

/**
 * Validate map data with Zod
 */
export function validateMapData(data: unknown): MapData | null {
  const result = MapDataSchema.safeParse(data);
  return result.success ? result.data : null;
}
