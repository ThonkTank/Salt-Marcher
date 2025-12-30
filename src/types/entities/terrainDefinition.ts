// Vault-persistierte TerrainDefinition
// Siehe: docs/entities/terrain-definition.md

import { z } from 'zod';
import { ENVIRONMENTAL_POOL_TYPES } from '../../constants/terrain';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const weatherRangeSchema = z.object({
  min: z.number(),
  average: z.number(),
  max: z.number(),
});
export type WeatherRange = z.infer<typeof weatherRangeSchema>;

export const terrainWeatherRangesSchema = z.object({
  temperature: weatherRangeSchema,
  wind: weatherRangeSchema,
  precipChance: weatherRangeSchema,
  precipIntensity: weatherRangeSchema,
  fogChance: weatherRangeSchema,
});
export type TerrainWeatherRanges = z.infer<typeof terrainWeatherRangesSchema>;

export const environmentalPoolEntrySchema = z.object({
  id: z.string(),
  type: z.enum(ENVIRONMENTAL_POOL_TYPES),
  chance: z.number().min(0).max(1),
});
export type EnvironmentalPoolEntry = z.infer<typeof environmentalPoolEntrySchema>;

export const threatLevelSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
});
export type ThreatLevel = z.infer<typeof threatLevelSchema>;

// ============================================================================
// TERRAIN DEFINITION (Vault-persistiert)
// ============================================================================

export const terrainDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  movementCost: z.number().positive(),
  requiresBoat: z.boolean().optional(),
  blocksMounted: z.boolean().optional(),
  blocksCarriage: z.boolean().optional(),
  encounterModifier: z.number(),
  nativeCreatures: z.array(z.string()),
  features: z.array(z.string()),
  environmentalPool: z.array(environmentalPoolEntrySchema).optional(),
  threatLevel: threatLevelSchema,
  blockerHeight: z.number().min(0),
  defaultCrBudget: z.number().min(0),
  weatherRanges: terrainWeatherRangesSchema,
  displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().optional(),
  description: z.string().optional(),
});

export type TerrainDefinition = z.infer<typeof terrainDefinitionSchema>;
export type TerrainId = TerrainDefinition['id'];
