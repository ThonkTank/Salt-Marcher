// Vault-persistierte OverworldTile
// Siehe: docs/entities/overworld-tile.md

import { z } from 'zod';
import { hexCoordinateSchema } from './map';
import { WIND_EXPOSURES } from '../../constants/terrain';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const factionPresenceSchema = z.object({
  factionId: z.string(),
  randWeighting: z.number().positive(),
});
export type FactionPresence = z.infer<typeof factionPresenceSchema>;

export const windExposureSchema = z.enum(WIND_EXPOSURES);

export const tileClimateModifiersSchema = z.object({
  temperatureModifier: z.number().optional(),
  humidityModifier: z.number().optional(),
  windExposure: windExposureSchema.optional(),
});
export type TileClimateModifiers = z.infer<typeof tileClimateModifiersSchema>;

// ============================================================================
// OVERWORLD TILE (Vault-persistiert)
// ============================================================================

export const overworldTileSchema = z.object({
  coordinate: hexCoordinateSchema,
  terrain: z.string().min(1),
  elevation: z.number().optional(),
  crBudget: z.number().min(0).optional(),  // Fallback: terrain.defaultCrBudget
  factionPresence: z.array(factionPresenceSchema).optional(),
  climateModifiers: tileClimateModifiersSchema.optional(),
});

export type OverworldTile = z.infer<typeof overworldTileSchema>;
