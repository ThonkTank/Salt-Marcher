/**
 * Weather Tag Mapper
 *
 * Maps WeatherType to tag vocabulary for encounter generation and audio selection.
 * Follows TAGS.md weather tag vocabulary.
 */

import type { WeatherType } from "./weather-types";

/**
 * Map weather type to tag string for encounter/audio systems
 *
 * Maps WeatherType enum values to canonical tag strings from TAGS.md.
 * Some weather types map to multiple tags (e.g., "storm" → ["storm", "rain"]).
 *
 * @param weatherType - Weather type from weather system
 * @returns Array of weather tags matching TAGS.md vocabulary
 */
export function mapWeatherTypeToTags(weatherType: WeatherType): string[] {
	switch (weatherType) {
		case "clear":
			return ["clear"];
		case "cloudy":
			return ["cloudy"];
		case "rain":
			return ["rain"];
		case "storm":
			// Storms are rainy and have wind
			return ["storm", "rain", "wind"];
		case "snow":
			return ["snow"];
		case "fog":
			return ["fog"];
		case "wind":
			return ["wind"];
		case "hot":
			return ["hot"];
		case "cold":
			return ["cold"];
		default:
			// Fallback for unknown weather types
			return ["clear"];
	}
}

/**
 * Get primary weather tag (first tag in list)
 *
 * Returns the most important tag for a weather type.
 * Useful when only one tag is needed (e.g., UI display).
 *
 * @param weatherType - Weather type from weather system
 * @returns Primary weather tag
 */
export function getPrimaryWeatherTag(weatherType: WeatherType): string {
	const tags = mapWeatherTypeToTags(weatherType);
	return tags[0] ?? "clear";
}
