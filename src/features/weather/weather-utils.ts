/**
 * Weather calculation utilities.
 *
 * Implements:
 * - Weather generation from terrain ranges
 * - Category classification
 * - Area averaging
 * - Weather transitions
 * - Speed factor calculation
 */

import type {
  WeatherRange,
  TerrainWeatherRanges,
  WeatherParams,
  WeatherState,
  WeatherCategories,
  TemperatureCategory,
  WindCategory,
  PrecipitationType,
  TimeSegment,
  HexCoordinate,
  GameDateTime,
} from '@core/schemas';
import {
  SEGMENT_TEMPERATURE_MODIFIERS,
  WEATHER_SPEED_FACTORS,
  TEMPERATURE_THRESHOLDS,
  WIND_THRESHOLDS,
  PRECIPITATION_THRESHOLDS,
  DEFAULT_WEATHER_RANGES,
} from '@core/schemas';
import { hexDistance } from '@core/utils/hex-math';

// ============================================================================
// Random Generation
// ============================================================================

/**
 * Simple seeded random number generator.
 * Uses mulberry32 algorithm for reproducibility.
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a value from a weather range using Gaussian-like distribution.
 * Average is more likely than extremes.
 */
export function generateFromRange(range: WeatherRange, seed?: number): number {
  const random = seed !== undefined ? seededRandom(seed)() : Math.random();

  // Convert uniform random to approximate Gaussian-like distribution
  // Using Box-Muller approximation simplified for our use case
  const deviation = (random - 0.5) * 2; // -1 to +1

  if (deviation >= 0) {
    // Interpolate from average to max
    return lerp(range.average, range.max, deviation);
  } else {
    // Interpolate from average to min
    return lerp(range.average, range.min, -deviation);
  }
}

/**
 * Linear interpolation between two values.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// Category Classification
// ============================================================================

/**
 * Classify temperature into category.
 * From Weather-System.md lines 14-22.
 */
export function classifyTemperature(temp: number): TemperatureCategory {
  if (temp < TEMPERATURE_THRESHOLDS.FREEZING_MAX) return 'freezing';
  if (temp < TEMPERATURE_THRESHOLDS.COLD_MAX) return 'cold';
  if (temp < TEMPERATURE_THRESHOLDS.COOL_MAX) return 'cool';
  if (temp < TEMPERATURE_THRESHOLDS.MILD_MAX) return 'mild';
  if (temp < TEMPERATURE_THRESHOLDS.WARM_MAX) return 'warm';
  return 'hot';
}

/**
 * Classify wind speed into category.
 * From Weather-System.md lines 24-31.
 */
export function classifyWind(wind: number): WindCategory {
  if (wind < WIND_THRESHOLDS.CALM_MAX) return 'calm';
  if (wind < WIND_THRESHOLDS.LIGHT_MAX) return 'light';
  if (wind < WIND_THRESHOLDS.MODERATE_MAX) return 'moderate';
  if (wind < WIND_THRESHOLDS.STRONG_MAX) return 'strong';
  return 'gale';
}

/**
 * Determine precipitation type based on probability and temperature.
 * From Weather-System.md lines 33-44.
 */
export function classifyPrecipitation(
  precipitationChance: number,
  temperature: number,
  wind: number
): PrecipitationType {
  // Check if precipitation occurs
  const roll = Math.random() * 100;
  if (roll > precipitationChance) {
    return 'none';
  }

  // Special case: fog (cool + calm + moderate precipitation)
  const tempCategory = classifyTemperature(temperature);
  const windCategory = classifyWind(wind);
  if (
    (tempCategory === 'cool' || tempCategory === 'cold') &&
    windCategory === 'calm' &&
    precipitationChance >= PRECIPITATION_THRESHOLDS.FOG_RANGE.min &&
    precipitationChance <= PRECIPITATION_THRESHOLDS.FOG_RANGE.max
  ) {
    // 30% chance of fog instead of rain
    if (Math.random() < 0.3) {
      return 'fog';
    }
  }

  // Snow if freezing or cold
  if (tempCategory === 'freezing' || tempCategory === 'cold') {
    if (precipitationChance > PRECIPITATION_THRESHOLDS.HEAVY_RAIN_MAX) {
      return 'blizzard'; // Note: This is Post-MVP but included for completeness
    }
    return 'snow';
  }

  // Rain based on intensity
  if (precipitationChance <= PRECIPITATION_THRESHOLDS.NONE_MAX) {
    return 'none';
  }
  if (precipitationChance <= PRECIPITATION_THRESHOLDS.DRIZZLE_MAX) {
    return 'drizzle';
  }
  if (precipitationChance <= PRECIPITATION_THRESHOLDS.RAIN_MAX) {
    return 'rain';
  }
  return 'heavy_rain';
}

/**
 * Derive all weather categories from numeric parameters.
 */
export function deriveCategories(params: WeatherParams): WeatherCategories {
  return {
    temperature: classifyTemperature(params.temperature),
    wind: classifyWind(params.wind),
    precipitation: classifyPrecipitation(
      params.precipitation,
      params.temperature,
      params.wind
    ),
  };
}

// ============================================================================
// Weather Generation
// ============================================================================

/**
 * Generate weather parameters from terrain ranges.
 */
export function generateWeatherFromRanges(
  ranges: TerrainWeatherRanges,
  timeSegment: TimeSegment,
  seed?: number
): WeatherParams {
  // Generate base values from ranges
  const baseTemp = generateFromRange(ranges.temperature, seed);
  const wind = generateFromRange(ranges.wind, seed ? seed + 1 : undefined);
  const precipitation = generateFromRange(
    ranges.precipitation,
    seed ? seed + 2 : undefined
  );

  // Apply time segment temperature modifier
  const tempModifier = SEGMENT_TEMPERATURE_MODIFIERS[timeSegment];
  const temperature = baseTemp + tempModifier;

  return {
    temperature: Math.round(temperature * 10) / 10, // Round to 1 decimal
    wind: Math.round(wind),
    precipitation: Math.round(precipitation),
  };
}

// ============================================================================
// Area Averaging
// ============================================================================

/**
 * Calculate area-averaged weather.
 * From Weather-System.md lines 116-146.
 *
 * @param centerTile Center position for averaging
 * @param getTileRanges Function to get weather ranges for a tile
 * @param timeSegment Current time segment
 * @param radius Averaging radius (default: 5)
 */
export function calculateAreaWeather(
  centerTile: HexCoordinate,
  getTileRanges: (coord: HexCoordinate) => TerrainWeatherRanges | null,
  timeSegment: TimeSegment,
  radius: number = 5
): WeatherParams {
  let weightedTemp = 0;
  let weightedWind = 0;
  let weightedPrecip = 0;
  let totalWeight = 0;

  // Iterate over tiles in radius
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const coord: HexCoordinate = {
        q: centerTile.q + dq,
        r: centerTile.r + dr,
      };

      const ranges = getTileRanges(coord);
      if (!ranges) continue;

      // Distance-based weight (center has highest weight)
      const distance = hexDistance(centerTile, coord);
      const weight = 1 / (distance + 1);

      // Generate weather for this tile
      const tileWeather = generateWeatherFromRanges(ranges, timeSegment);

      weightedTemp += tileWeather.temperature * weight;
      weightedWind += tileWeather.wind * weight;
      weightedPrecip += tileWeather.precipitation * weight;
      totalWeight += weight;
    }
  }

  // If no valid tiles, use center tile or defaults
  if (totalWeight === 0) {
    const centerRanges = getTileRanges(centerTile) ?? DEFAULT_WEATHER_RANGES;
    return generateWeatherFromRanges(centerRanges, timeSegment);
  }

  return {
    temperature: Math.round((weightedTemp / totalWeight) * 10) / 10,
    wind: Math.round(weightedWind / totalWeight),
    precipitation: Math.round(weightedPrecip / totalWeight),
  };
}

// ============================================================================
// Weather Transition
// ============================================================================

/**
 * Smooth weather transition between segments.
 * From Weather-System.md lines 178-188.
 */
export function transitionWeather(
  current: WeatherParams,
  target: WeatherParams,
  transitionSpeed: number = 0.3
): WeatherParams {
  return {
    // Temperature and wind transition gradually
    temperature:
      Math.round(lerp(current.temperature, target.temperature, transitionSpeed) * 10) / 10,
    wind: Math.round(lerp(current.wind, target.wind, transitionSpeed)),
    // Precipitation can change abruptly (30% chance)
    precipitation:
      Math.random() < 0.3 ? target.precipitation : current.precipitation,
  };
}

// ============================================================================
// Speed Factor
// ============================================================================

/**
 * Get travel speed factor based on weather.
 * From Travel-System.md lines 76-87.
 */
export function getWeatherSpeedFactor(weather: WeatherState | null): number {
  if (!weather) return 1.0;

  const precipType = weather.categories.precipitation;
  return WEATHER_SPEED_FACTORS[precipType] ?? 1.0;
}

/**
 * Get speed factor from precipitation type directly.
 */
export function getSpeedFactorFromPrecipitation(
  precipType: PrecipitationType
): number {
  return WEATHER_SPEED_FACTORS[precipType] ?? 1.0;
}

// ============================================================================
// Weather State Creation
// ============================================================================

/**
 * Create a complete WeatherState from parameters.
 */
export function createWeatherState(
  params: WeatherParams,
  currentTime: GameDateTime
): WeatherState {
  return {
    params,
    categories: deriveCategories(params),
    updatedAt: { ...currentTime },
  };
}
