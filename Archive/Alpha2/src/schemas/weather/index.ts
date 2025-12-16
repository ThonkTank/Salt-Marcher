/**
 * Weather Schemas
 *
 * Types for weather calculation and display.
 *
 * @module schemas/weather
 */

/** Season enumeration */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Time period of day (6 periods, 4 hours each) */
export type TimePeriod =
	| 'night'
	| 'dawn'
	| 'morning'
	| 'midday'
	| 'afternoon'
	| 'evening';

// ============================================================================
// Weather Values (Shared Structure)
// ============================================================================

/**
 * Core weather/climate values (all on 1-12 scale).
 * Shared by ClimateData (tile static) and WeatherResult (calculated).
 *
 * Scale interpretation:
 * - Temperature: 1=arctic, 6=temperate, 12=scorching
 * - Precipitation: 1=arid, 6=moderate, 12=monsoon
 * - Clouds: 1=clear, 6=partly cloudy, 12=overcast
 * - Wind: 1=calm, 6=breezy, 12=hurricane
 */
export type WeatherValues = {
	/** Temperature level (1-12) */
	temperature: number;
	/** Precipitation level (1-12) */
	precipitation: number;
	/** Cloud cover level (1-12) */
	clouds: number;
	/** Wind strength level (1-12) */
	wind: number;
};

/**
 * Weather calculation result.
 * @alias WeatherValues - Same structure, semantic alias for calculated values.
 */
export type WeatherResult = WeatherValues;

/** Full weather state including descriptive text */
export type WeatherState = {
	/** Calculated weather values */
	values: WeatherResult;
	/** Human-readable description */
	description: string;
	/** Current time period */
	timePeriod: TimePeriod;
	/** Current season */
	season: Season;
};
