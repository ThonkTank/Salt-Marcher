/**
 * Climate Templates
 *
 * Predefined climate patterns for different geographic regions.
 * Each template defines weather probabilities, temperature ranges, and transition speeds.
 */

import type { ClimateTemplate, WeatherType } from "./weather-types";

/**
 * Helper to create balanced weather probabilities that sum to 1.0
 */
function weatherProbs(weights: Partial<Record<WeatherType, number>>): Record<WeatherType, number> {
	const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
	const normalized: Partial<Record<WeatherType, number>> = {};

	for (const [key, value] of Object.entries(weights)) {
		normalized[key as WeatherType] = value / total;
	}

	// Fill missing types with 0
	const allTypes: WeatherType[] = ["clear", "cloudy", "rain", "storm", "snow", "fog", "wind", "hot", "cold"];
	const result: Record<WeatherType, number> = {} as Record<WeatherType, number>;
	for (const type of allTypes) {
		result[type] = normalized[type] ?? 0;
	}

	return result;
}

/**
 * Arctic Climate
 * - Very cold temperatures
 * - Snow dominant in all seasons
 * - Minimal seasonal variation
 * - Low transition speed (weather persists)
 */
export const ARCTIC_CLIMATE: ClimateTemplate = {
	name: "Arctic",
	baseTemperature: { min: -40, max: -10 },
	seasonalVariation: 15,
	transitionSpeed: 18,
	weatherProbabilities: {
		spring: weatherProbs({ snow: 50, cold: 25, cloudy: 15, wind: 10 }),
		summer: weatherProbs({ cold: 30, cloudy: 25, fog: 20, snow: 15, wind: 10 }),
		autumn: weatherProbs({ snow: 45, cold: 25, wind: 15, cloudy: 15 }),
		winter: weatherProbs({ snow: 60, cold: 20, storm: 10, wind: 10 }),
	},
};

/**
 * Temperate Climate
 * - Moderate temperatures
 * - Four distinct seasons
 * - Balanced precipitation
 * - Medium transition speed
 */
export const TEMPERATE_CLIMATE: ClimateTemplate = {
	name: "Temperate",
	baseTemperature: { min: 5, max: 20 },
	seasonalVariation: 20,
	transitionSpeed: 12,
	weatherProbabilities: {
		spring: weatherProbs({ clear: 30, cloudy: 25, rain: 25, fog: 10, wind: 10 }),
		summer: weatherProbs({ clear: 40, hot: 25, cloudy: 20, rain: 10, storm: 5 }),
		autumn: weatherProbs({ cloudy: 30, rain: 25, clear: 20, fog: 15, wind: 10 }),
		winter: weatherProbs({ cold: 25, cloudy: 25, snow: 20, rain: 15, clear: 15 }),
	},
};

/**
 * Tropical Climate
 * - Hot and humid
 * - Wet and dry seasons
 * - High precipitation in summer
 * - Fast transition speed (sudden storms)
 */
export const TROPICAL_CLIMATE: ClimateTemplate = {
	name: "Tropical",
	baseTemperature: { min: 22, max: 35 },
	seasonalVariation: 5,
	transitionSpeed: 6,
	weatherProbabilities: {
		spring: weatherProbs({ hot: 35, clear: 25, cloudy: 20, rain: 15, storm: 5 }),
		summer: weatherProbs({ hot: 30, rain: 30, storm: 20, cloudy: 15, clear: 5 }),
		autumn: weatherProbs({ hot: 30, cloudy: 25, rain: 20, clear: 15, storm: 10 }),
		winter: weatherProbs({ hot: 25, clear: 30, cloudy: 25, rain: 15, wind: 5 }),
	},
};

/**
 * Desert Climate
 * - Extreme day/night temperature variation
 * - Very low precipitation
 * - Intense but rare storms
 * - Medium transition speed
 */
export const DESERT_CLIMATE: ClimateTemplate = {
	name: "Desert",
	baseTemperature: { min: 10, max: 45 },
	seasonalVariation: 15,
	transitionSpeed: 10,
	weatherProbabilities: {
		spring: weatherProbs({ clear: 50, hot: 30, wind: 15, storm: 5 }),
		summer: weatherProbs({ hot: 60, clear: 25, wind: 10, storm: 5 }),
		autumn: weatherProbs({ clear: 45, hot: 30, wind: 15, cloudy: 10 }),
		winter: weatherProbs({ clear: 40, cloudy: 30, cold: 20, wind: 10 }),
	},
};

/**
 * Mountain Climate
 * - Altitude-based temperature drops
 * - Sudden weather changes
 * - Wind and snow dominant
 * - Fast transition speed
 */
export const MOUNTAIN_CLIMATE: ClimateTemplate = {
	name: "Mountain",
	baseTemperature: { min: -5, max: 15 },
	seasonalVariation: 18,
	transitionSpeed: 8,
	weatherProbabilities: {
		spring: weatherProbs({ clear: 25, cloudy: 25, wind: 20, snow: 15, rain: 15 }),
		summer: weatherProbs({ clear: 35, cloudy: 25, wind: 20, rain: 10, storm: 10 }),
		autumn: weatherProbs({ cloudy: 30, wind: 25, rain: 20, snow: 15, clear: 10 }),
		winter: weatherProbs({ snow: 40, cold: 25, wind: 20, cloudy: 10, storm: 5 }),
	},
};

/**
 * Coastal Climate
 * - Moderate temperatures
 * - High humidity and fog
 * - Storm exposure
 * - Medium transition speed
 */
export const COASTAL_CLIMATE: ClimateTemplate = {
	name: "Coastal",
	baseTemperature: { min: 10, max: 25 },
	seasonalVariation: 12,
	transitionSpeed: 10,
	weatherProbabilities: {
		spring: weatherProbs({ clear: 30, fog: 25, cloudy: 20, wind: 15, rain: 10 }),
		summer: weatherProbs({ clear: 35, cloudy: 25, wind: 20, fog: 15, storm: 5 }),
		autumn: weatherProbs({ fog: 30, cloudy: 25, wind: 20, rain: 15, storm: 10 }),
		winter: weatherProbs({ cloudy: 30, fog: 25, wind: 20, rain: 15, storm: 10 }),
	},
};

/**
 * All climate templates indexed by name
 */
export const CLIMATE_TEMPLATES: Record<string, ClimateTemplate> = {
	Arctic: ARCTIC_CLIMATE,
	Temperate: TEMPERATE_CLIMATE,
	Tropical: TROPICAL_CLIMATE,
	Desert: DESERT_CLIMATE,
	Mountain: MOUNTAIN_CLIMATE,
	Coastal: COASTAL_CLIMATE,
};

/**
 * Get climate template by name
 * @param name Climate template name
 * @returns Climate template or Temperate as fallback
 */
export function getClimateTemplate(name: string): ClimateTemplate {
	return CLIMATE_TEMPLATES[name] ?? TEMPERATE_CLIMATE;
}

/**
 * List all available climate template names
 */
export function listClimateNames(): string[] {
	return Object.keys(CLIMATE_TEMPLATES);
}
