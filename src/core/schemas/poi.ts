/**
 * POI (Point of Interest) schema definitions.
 *
 * Unified system for all tile content: entrances, traps, treasures,
 * landmarks, and objects. NPCs are NOT POIs - they are managed separately.
 *
 * @see docs/domain/POI.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';
import { hexCoordSchema, type HexCoordinate } from './map';

// ============================================================================
// Coordinate Schema (MVP: HexCoordinate only)
// ============================================================================

/**
 * POI coordinate schema.
 * MVP: Only HexCoordinate (for overworld).
 * Post-MVP: Will include GridCoordinate for dungeons.
 */
export const poiCoordinateSchema = hexCoordSchema;
export type PoiCoordinate = HexCoordinate;

// ============================================================================
// POI Type Schema
// ============================================================================

/**
 * All POI types.
 * MVP: entrance, landmark
 * Post-MVP: trap, treasure, object
 */
export const poiTypeSchema = z.enum([
  'entrance',
  'landmark',
  'trap',
  'treasure',
  'object',
]);
export type PoiType = z.infer<typeof poiTypeSchema>;

// ============================================================================
// BasePOI Schema
// ============================================================================

/**
 * Base schema for all POI types.
 * Common properties shared by EntrancePOI, LandmarkPOI, TrapPOI, etc.
 *
 * From POI.md#basepoi:
 * - id: Unique POI identifier
 * - mapId: Which map this POI belongs to
 * - position: Hex or Grid coordinate
 * - name: Display name (optional for some types)
 * - icon: Icon for map rendering
 * - visible: Player visibility (false = GM-only)
 * - height: Post-MVP - for visibility calculation
 * - glowsAtNight: Post-MVP - visible at night from distance
 */
export const basePoiSchema = z.object({
  /** Unique POI identifier */
  id: entityIdSchema('poi'),

  /** Map this POI belongs to */
  mapId: entityIdSchema('map'),

  /** Position on the map (hex coordinate for overworld) */
  position: poiCoordinateSchema,

  /** Display name (optional for some POI types like hidden traps) */
  name: z.string().optional(),

  /** Icon for map rendering */
  icon: z.string().optional(),

  /** Visible to players? (false = GM-only) */
  visible: z.boolean(),

  // Post-MVP fields (included for schema completeness)
  /** Height for visibility calculation (Post-MVP) */
  height: z.number().optional(),

  /** Glows at night - visible from distance at night (Post-MVP) */
  glowsAtNight: z.boolean().optional(),
});

/** Inferred BasePOI type */
export type BasePOI = z.infer<typeof basePoiSchema>;
