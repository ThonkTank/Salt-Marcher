/**
 * Weather-related schemas for weather generation and state.
 *
 * Based on Weather-System.md specification:
 * - WeatherParams: temperature, wind, precipitation
 * - WeatherState: current weather with categories and timestamp
 * - TerrainWeatherRanges: min/average/max per terrain type
 */

import { z } from 'zod';
import type { TimeSegment } from './time';
import type { GameDateTime } from './time';

// ============================================================================
// Weather Range Schema
// ============================================================================

/**
 * Min/average/max range for terrain-based weather generation.
 * Used for temperature (°C), wind (km/h), and precipitation (0-100%).
 */
export const weatherRangeSchema = z.object({
  min: z.number(),
  average: z.number(),
  max: z.number(),
});

export type WeatherRange = z.infer<typeof weatherRangeSchema>;

// ============================================================================
// Terrain Weather Ranges Schema
// ============================================================================

/**
 * Weather ranges per terrain type.
 * Each terrain defines characteristic weather patterns.
 */
export const terrainWeatherRangesSchema = z.object({
  /** Temperature range in degrees Celsius */
  temperature: weatherRangeSchema,
  /** Wind speed range in km/h */
  wind: weatherRangeSchema,
  /** Precipitation probability range (0-100) */
  precipitation: weatherRangeSchema,
});

export type TerrainWeatherRanges = z.infer<typeof terrainWeatherRangesSchema>;

// ============================================================================
// Weather Categories
// ============================================================================

/**
 * Temperature categories derived from numeric values.
 * From Weather-System.md parameter table.
 */
export const temperatureCategorySchema = z.enum([
  'freezing', // < -10°C
  'cold',     // -10 to 5°C
  'cool',     // 5 to 15°C
  'mild',     // 15 to 25°C
  'warm',     // 25 to 35°C
  'hot',      // > 35°C
]);

export type TemperatureCategory = z.infer<typeof temperatureCategorySchema>;

/**
 * Wind strength categories derived from km/h values.
 * From Weather-System.md parameter table.
 */
export const windCategorySchema = z.enum([
  'calm',     // 0-10 km/h
  'light',    // 10-30 km/h
  'moderate', // 30-50 km/h
  'strong',   // 50-70 km/h
  'gale',     // > 70 km/h
]);

export type WindCategory = z.infer<typeof windCategorySchema>;

/**
 * Precipitation types derived from probability and temperature.
 * From Weather-System.md parameter table.
 */
export const precipitationTypeSchema = z.enum([
  'none',       // No precipitation
  'drizzle',    // Light rain
  'rain',       // Moderate rain
  'heavy_rain', // Heavy rain
  'snow',       // Snow (cold temps)
  'blizzard',   // Heavy snow + wind (Post-MVP event)
  'fog',        // Fog/mist
]);

export type PrecipitationType = z.infer<typeof precipitationTypeSchema>;

// ============================================================================
// Weather Params Schema
// ============================================================================

/**
 * Numeric weather parameters (raw values).
 */
export const weatherParamsSchema = z.object({
  /** Temperature in degrees Celsius */
  temperature: z.number(),
  /** Wind speed in km/h */
  wind: z.number(),
  /** Precipitation probability (0-100) */
  precipitation: z.number(),
});

export type WeatherParams = z.infer<typeof weatherParamsSchema>;

// ============================================================================
// Weather Categories Schema
// ============================================================================

/**
 * Derived weather categories for display and mechanics.
 */
export const weatherCategoriesSchema = z.object({
  temperature: temperatureCategorySchema,
  wind: windCategorySchema,
  precipitation: precipitationTypeSchema,
});

export type WeatherCategories = z.infer<typeof weatherCategoriesSchema>;

// ============================================================================
// Weather State Schema
// ============================================================================

/**
 * Complete weather state (persisted in Map).
 * From Weather-System.md lines 237-248.
 */
export const weatherStateSchema = z.object({
  /** Numeric weather parameters */
  params: weatherParamsSchema,
  /** Derived categories for display/mechanics */
  categories: weatherCategoriesSchema,
  /** When this weather was last updated */
  updatedAt: z.object({
    year: z.number().int().min(1),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
});

export type WeatherState = z.infer<typeof weatherStateSchema>;

// ============================================================================
// Weather Constants
// ============================================================================

/**
 * Temperature modifiers per time segment.
 * From Weather-System.md lines 165-172.
 */
export const SEGMENT_TEMPERATURE_MODIFIERS: Record<TimeSegment, number> = {
  dawn: -5,
  morning: 0,
  midday: 5,
  afternoon: 2,
  dusk: -2,
  night: -10,
};

/**
 * Travel speed factors per precipitation type.
 * From Travel-System.md lines 76-87.
 */
export const WEATHER_SPEED_FACTORS: Record<PrecipitationType, number> = {
  none: 1.0,
  drizzle: 1.0,
  rain: 0.9,
  heavy_rain: 0.7,
  snow: 0.7,
  blizzard: 0.3,
  fog: 0.8,
};

/**
 * Temperature category thresholds in Celsius.
 * From Weather-System.md lines 14-22.
 */
export const TEMPERATURE_THRESHOLDS = {
  FREEZING_MAX: -10,
  COLD_MAX: 5,
  COOL_MAX: 15,
  MILD_MAX: 25,
  WARM_MAX: 35,
} as const;

/**
 * Wind category thresholds in km/h.
 * From Weather-System.md lines 24-31.
 */
export const WIND_THRESHOLDS = {
  CALM_MAX: 10,
  LIGHT_MAX: 30,
  MODERATE_MAX: 50,
  STRONG_MAX: 70,
} as const;

/**
 * Precipitation probability thresholds.
 * Below threshold = no precipitation, above = type based on intensity.
 */
export const PRECIPITATION_THRESHOLDS = {
  NONE_MAX: 10,
  DRIZZLE_MAX: 30,
  RAIN_MAX: 60,
  HEAVY_RAIN_MAX: 85,
  FOG_RANGE: { min: 20, max: 50 }, // Special case: cool + calm + moderate precip
} as const;

// ============================================================================
// Default Weather Ranges
// ============================================================================

/**
 * Default weather ranges for terrains without explicit weatherRanges.
 * Based on "plains" terrain.
 */
export const DEFAULT_WEATHER_RANGES: TerrainWeatherRanges = {
  temperature: { min: -5, average: 15, max: 35 },
  wind: { min: 5, average: 20, max: 60 },
  precipitation: { min: 10, average: 30, max: 70 },
};
