// Vault-persistierte Map-Definition
// Siehe: docs/entities/map.md

import { z } from 'zod';
import { MAP_TYPES } from '../../constants/terrain';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const mapTypeSchema = z.enum(MAP_TYPES);

export const hexCoordinateSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
});
export type HexCoordinate = z.infer<typeof hexCoordinateSchema>;

// ============================================================================
// MAP DEFINITION (Vault-persistiert)
// ============================================================================

export const mapDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: mapTypeSchema,
  defaultSpawnPoint: hexCoordinateSchema.optional(),
  description: z.string().optional(),
  gmNotes: z.string().optional(),
});

export type MapDefinition = z.infer<typeof mapDefinitionSchema>;
export type MapId = MapDefinition['id'];
