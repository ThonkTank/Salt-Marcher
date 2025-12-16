/**
 * Weather Description Utilities
 *
 * Pure functions for generating weather text.
 *
 * @module utils/weather
 */

import type {
	WeatherResult,
	WeatherState,
	TimePeriod,
	Season,
} from '../../schemas/weather';
import {
	TEMPERATURE_DESCRIPTIONS,
	PRECIPITATION_DESCRIPTIONS,
	CLOUD_DESCRIPTIONS,
	WIND_DESCRIPTIONS,
} from '../../constants/weather';
import { capitalizeFirst } from '../common/string';

/**
 * Generate weather description string.
 * Prioritizes most notable weather aspects.
 *
 * @param weather - Weather values to describe
 * @returns Human-readable description (German)
 */
export function describeWeather(weather: WeatherResult): string {
	const temp = TEMPERATURE_DESCRIPTIONS[weather.temperature] ?? 'unbekannt';
	const precip = PRECIPITATION_DESCRIPTIONS[weather.precipitation] ?? '';
	const clouds = CLOUD_DESCRIPTIONS[weather.clouds] ?? '';
	const wind = WIND_DESCRIPTIONS[weather.wind] ?? '';

	// Build description prioritizing significant weather
	const parts: string[] = [];

	// Always include temperature
	parts.push(capitalizeFirst(temp));

	// Include precipitation if notable (>= 5)
	if (weather.precipitation >= 5) {
		parts.push(precip);
	} else if (weather.clouds >= 5) {
		// Include clouds if no precipitation but cloudy
		parts.push(clouds);
	}

	// Include wind if significant (>= 6)
	if (weather.wind >= 6) {
		parts.push(wind);
	}

	// Format: "Warm, leichter Regen, starker Wind"
	return parts.join(', ');
}

/**
 * Generate full weather state with description.
 *
 * @param values - Calculated weather values
 * @param timePeriod - Current time period
 * @param season - Current season
 * @returns Complete weather state including description
 */
export function createWeatherState(
	values: WeatherResult,
	timePeriod: TimePeriod,
	season: Season
): WeatherState {
	return {
		values,
		description: describeWeather(values),
		timePeriod,
		season,
	};
}

/**
 * Generate detailed weather report (for tooltips/expanded view).
 *
 * @param weather - Weather values to describe
 * @returns Multi-line detailed description
 */
export function describeWeatherDetailed(weather: WeatherResult): string {
	const temp = TEMPERATURE_DESCRIPTIONS[weather.temperature] ?? 'unbekannt';
	const precip =
		PRECIPITATION_DESCRIPTIONS[weather.precipitation] ?? 'unbekannt';
	const clouds = CLOUD_DESCRIPTIONS[weather.clouds] ?? 'unbekannt';
	const wind = WIND_DESCRIPTIONS[weather.wind] ?? 'unbekannt';

	return [
		`Temperatur: ${capitalizeFirst(temp)}`,
		`Niederschlag: ${capitalizeFirst(precip)}`,
		`Bewoelkung: ${capitalizeFirst(clouds)}`,
		`Wind: ${capitalizeFirst(wind)}`,
	].join('\n');
}
