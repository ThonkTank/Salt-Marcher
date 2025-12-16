/**
 * Weather Calculation Utilities
 *
 * Pure functions for weather calculation.
 *
 * @module utils/weather
 */

import type { ClimateData } from '../../schemas/map/tile';
import type { Season, TimePeriod, WeatherResult } from '../../schemas/weather';
import type { WeatherModifiers } from '../../constants/weather';
import {
	TIME_PERIOD_MODIFIERS,
	SEASON_MODIFIERS,
	SEASON_VARIATION_RANGE,
	DEFAULT_TILE_VARIATION_RANGE,
} from '../../constants/weather';
import { clampClimate, randomVariation } from '../common/math';

/**
 * Internal weather calculation with configurable variation function.
 */
function calculateWeatherInternal(
	tileClimate: ClimateData,
	timeModifiers: WeatherModifiers,
	seasonModifiers: WeatherModifiers,
	getVariation: () => number
): WeatherResult {
	return {
		temperature: clampClimate(
			tileClimate.temperature +
				timeModifiers.temperature +
				seasonModifiers.temperature +
				getVariation()
		),
		precipitation: clampClimate(
			tileClimate.precipitation +
				timeModifiers.precipitation +
				seasonModifiers.precipitation +
				getVariation()
		),
		clouds: clampClimate(
			tileClimate.clouds +
				timeModifiers.clouds +
				seasonModifiers.clouds +
				getVariation()
		),
		wind: clampClimate(
			tileClimate.wind +
				timeModifiers.wind +
				seasonModifiers.wind +
				getVariation()
		),
	};
}

/**
 * Calculate weather for a tile given temporal context.
 *
 * Formula: actual = tile_base + time_modifier + season_modifier + random_variation
 *
 * @param tileClimate - Base climate data from the tile
 * @param timePeriod - Current time period (dawn, morning, etc.)
 * @param season - Current season
 * @param tileVariationRange - Additional variation range for this tile (default: 1)
 * @returns Calculated weather values (all 1-12 scale)
 */
export function calculateWeather(
	tileClimate: ClimateData,
	timePeriod: TimePeriod,
	season: Season,
	tileVariationRange: number = DEFAULT_TILE_VARIATION_RANGE
): WeatherResult {
	const timeModifiers = TIME_PERIOD_MODIFIERS[timePeriod];
	const seasonModifiers = SEASON_MODIFIERS[season];
	const seasonVariation = SEASON_VARIATION_RANGE[season];

	// Total variation range = tile range + season range
	const totalVariation = tileVariationRange + seasonVariation;

	return calculateWeatherInternal(
		tileClimate,
		timeModifiers,
		seasonModifiers,
		() => randomVariation(totalVariation)
	);
}

/**
 * Calculate weather without randomness (for previews/testing).
 *
 * @param tileClimate - Base climate data from the tile
 * @param timePeriod - Current time period
 * @param season - Current season
 * @returns Calculated weather values without random variation
 */
export function calculateWeatherDeterministic(
	tileClimate: ClimateData,
	timePeriod: TimePeriod,
	season: Season
): WeatherResult {
	return calculateWeatherInternal(
		tileClimate,
		TIME_PERIOD_MODIFIERS[timePeriod],
		SEASON_MODIFIERS[season],
		() => 0
	);
}
