/**
 * Climate Schema - Weather baseline data for tiles
 *
 * Climate values represent tendencies/baselines that affect weather generation.
 * Scale: 1-12 for each parameter (roughly corresponding to months/seasons)
 *
 * These values are combined with time-of-day, season, and random factors
 * to generate actual weather conditions.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════

export const ClimateDataSchema = z.object({
  /**
   * Temperature tendency: 1 (very cold) to 12 (very hot)
   * 6 = temperate/moderate
   */
  temperature: z.number().int().min(1).max(12).default(6),

  /**
   * Precipitation tendency: 1 (very dry) to 12 (very wet)
   * 6 = moderate rainfall
   */
  precipitation: z.number().int().min(1).max(12).default(6),

  /**
   * Cloud cover tendency: 1 (clear skies) to 12 (overcast)
   * 6 = partly cloudy
   */
  clouds: z.number().int().min(1).max(12).default(6),

  /**
   * Wind tendency: 1 (calm) to 12 (stormy)
   * 4 = light breeze (slightly below middle for calmer default)
   */
  wind: z.number().int().min(1).max(12).default(4),
});

export type ClimateData = z.infer<typeof ClimateDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════════════════════════

/**
 * Default climate - temperate/moderate conditions
 */
export const DEFAULT_CLIMATE: ClimateData = {
  temperature: 6,
  precipitation: 6,
  clouds: 6,
  wind: 4,
};

/**
 * Climate presets for different terrain/biome types
 */
export const CLIMATE_PRESETS: Record<string, ClimateData> = {
  /** Temperate grassland */
  temperate: {
    temperature: 6,
    precipitation: 6,
    clouds: 6,
    wind: 4,
  },

  /** Hot, dry desert */
  desert: {
    temperature: 10,
    precipitation: 1,
    clouds: 2,
    wind: 5,
  },

  /** Frozen arctic/tundra */
  arctic: {
    temperature: 1,
    precipitation: 4,
    clouds: 7,
    wind: 8,
  },

  /** Tropical rainforest */
  tropical: {
    temperature: 11,
    precipitation: 11,
    clouds: 9,
    wind: 3,
  },

  /** Dense forest */
  forest: {
    temperature: 5,
    precipitation: 7,
    clouds: 7,
    wind: 2,
  },

  /** Swamp/marsh */
  swamp: {
    temperature: 7,
    precipitation: 10,
    clouds: 8,
    wind: 2,
  },

  /** Coastal area */
  coastal: {
    temperature: 6,
    precipitation: 7,
    clouds: 6,
    wind: 7,
  },

  /** Mountain highlands */
  mountain: {
    temperature: 3,
    precipitation: 8,
    clouds: 8,
    wind: 9,
  },

  /** Underground/Underdark */
  underground: {
    temperature: 5,
    precipitation: 3,
    clouds: 12, // Always "overcast" underground
    wind: 1,    // No wind underground
  },
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get a climate preset by name, falling back to DEFAULT_CLIMATE
 */
export function getClimatePreset(name: string): ClimateData {
  return CLIMATE_PRESETS[name] ?? DEFAULT_CLIMATE;
}

/**
 * Create a custom climate with partial overrides
 */
export function createClimate(overrides: Partial<ClimateData>): ClimateData {
  return {
    ...DEFAULT_CLIMATE,
    ...overrides,
  };
}

/**
 * Blend two climates together (for transitions/borders)
 *
 * @param a First climate
 * @param b Second climate
 * @param t Blend factor (0 = all a, 1 = all b)
 */
export function blendClimate(
  a: ClimateData,
  b: ClimateData,
  t: number
): ClimateData {
  const blend = (va: number, vb: number) =>
    Math.round(va + (vb - va) * t);

  return {
    temperature: Math.max(1, Math.min(12, blend(a.temperature, b.temperature))),
    precipitation: Math.max(1, Math.min(12, blend(a.precipitation, b.precipitation))),
    clouds: Math.max(1, Math.min(12, blend(a.clouds, b.clouds))),
    wind: Math.max(1, Math.min(12, blend(a.wind, b.wind))),
  };
}

/**
 * Validate and clamp climate values to valid range
 */
export function clampClimate(climate: Partial<ClimateData>): ClimateData {
  const clamp = (v: number | undefined, def: number) =>
    Math.max(1, Math.min(12, v ?? def));

  return {
    temperature: clamp(climate.temperature, 6),
    precipitation: clamp(climate.precipitation, 6),
    clouds: clamp(climate.clouds, 6),
    wind: clamp(climate.wind, 4),
  };
}
