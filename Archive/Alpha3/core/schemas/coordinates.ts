/**
 * Koordinaten-Schemas für alle Map-Typen
 * - HexCoordinate: Overland Maps (Axial-Koordinaten)
 * - GridCoordinate: Combat/Dungeon Maps
 * - PixelCoordinate: Town Maps (Watabou-style)
 */

import { z } from 'zod';
import { entityIdSchema } from '../types/common';

// ═══════════════════════════════════════════════════════════════
// Hex-Koordinaten (Axial) für Overland Maps
// ═══════════════════════════════════════════════════════════════

export const HexCoordinateSchema = z.object({
  /** Column (axial q) */
  q: z.number().int(),
  /** Row (axial r) */
  r: z.number().int(),
  /** Optional: Höhe (Flug, Berge, etc.) */
  elevation: z.number().optional(),
});

export type HexCoordinate = z.infer<typeof HexCoordinateSchema>;

// ═══════════════════════════════════════════════════════════════
// Grid-Koordinaten für Combat/Dungeon Maps
// ═══════════════════════════════════════════════════════════════

export const GridCoordinateSchema = z.object({
  /** X-Position */
  x: z.number().int(),
  /** Y-Position */
  y: z.number().int(),
  /** Optional: Z-Achse (Stockwerk / Flughöhe) */
  z: z.number().int().optional(),
});

export type GridCoordinate = z.infer<typeof GridCoordinateSchema>;

// ═══════════════════════════════════════════════════════════════
// Pixel-Koordinaten für Town Maps (Watabou-style)
// ═══════════════════════════════════════════════════════════════

export const PixelCoordinateSchema = z.object({
  /** X-Position in Pixeln */
  x: z.number(),
  /** Y-Position in Pixeln */
  y: z.number(),
});

export type PixelCoordinate = z.infer<typeof PixelCoordinateSchema>;

// ═══════════════════════════════════════════════════════════════
// WorldPosition - Abstrakte Position auf irgendeiner Map
// ═══════════════════════════════════════════════════════════════

const MapIdSchema = entityIdSchema<'map'>();

export const WorldPositionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hex'),
    coord: HexCoordinateSchema,
    mapId: MapIdSchema,
  }),
  z.object({
    type: z.literal('grid'),
    coord: GridCoordinateSchema,
    mapId: MapIdSchema,
  }),
  z.object({
    type: z.literal('pixel'),
    coord: PixelCoordinateSchema,
    mapId: MapIdSchema,
  }),
]);

export type WorldPosition = z.infer<typeof WorldPositionSchema>;

// ═══════════════════════════════════════════════════════════════
// MapLink - Verknüpfung zwischen Maps (Hierarchie)
// ═══════════════════════════════════════════════════════════════

export const MapLinkSchema = z.object({
  /** Übergeordnete Map (z.B. Overworld) */
  parentMapId: MapIdSchema,
  /** Untergeordnete Map (z.B. Dungeon) */
  childMapId: MapIdSchema,
  /** Position des Icons auf der Parent-Map */
  anchorPosition: WorldPositionSchema,
  /** Optional: Anzeigename für das Icon */
  label: z.string().optional(),
});

export type MapLink = z.infer<typeof MapLinkSchema>;

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/** Create a hex coordinate */
export function hex(q: number, r: number, elevation?: number): HexCoordinate {
  return { q, r, ...(elevation !== undefined && { elevation }) };
}

/** Create a grid coordinate */
export function grid(x: number, y: number, z?: number): GridCoordinate {
  return { x, y, ...(z !== undefined && { z }) };
}

/** Create a pixel coordinate */
export function pixel(x: number, y: number): PixelCoordinate {
  return { x, y };
}

/** Calculate the third hex coordinate (cube s) from axial q,r */
export function hexCubeS(coord: HexCoordinate): number {
  return -coord.q - coord.r;
}

/** Calculate distance between two hex coordinates */
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(hexCubeS(a) - hexCubeS(b))
  );
}

/** Calculate Manhattan distance between two grid coordinates */
export function gridDistance(a: GridCoordinate, b: GridCoordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Calculate Euclidean distance between two pixel coordinates */
export function pixelDistance(a: PixelCoordinate, b: PixelCoordinate): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
