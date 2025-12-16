/**
 * Weather System Types
 *
 * Core type definitions for the procedural weather system.
 * Defines weather states, climate templates, and configuration.
 */

/**
 * Weather type tags matching TAGS.md vocabulary
 */
export type WeatherType =
	| "clear"
	| "cloudy"
	| "rain"
	| "storm"
	| "snow"
	| "fog"
	| "wind"
	| "hot"
	| "cold";

/**
 * Season names for seasonal weather variations
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * Current weather condition with duration
 */
export interface WeatherCondition {
	/** Type of weather */
	type: WeatherType;
	/** Severity intensity (0-1 scale, 0=mild, 1=extreme) */
	severity: number;
	/** Hours remaining for this weather */
	duration: number;
}

/**
 * Complete weather state for a hex or zone
 */
export interface WeatherState {
	/** Hex coordinate (cube coords) */
	hexCoord: { q: number; r: number; s: number };
	/** Current weather condition */
	currentWeather: WeatherCondition;
	/** Temperature in Celsius */
	temperature: number;
	/** Wind speed in km/h */
	windSpeed: number;
	/** Precipitation rate in mm/hour (0 if no precipitation) */
	precipitation: number;
	/** Visibility distance in meters */
	visibility: number;
	/** ISO date string of last update */
	lastUpdate: string;
}

/**
 * Climate template defining weather patterns for a geographic region
 */
export interface ClimateTemplate {
	/** Climate name (e.g., "Arctic", "Temperate") */
	name: string;
	/** Base temperature range in Celsius */
	baseTemperature: { min: number; max: number };
	/** Seasonal temperature variation in Celsius */
	seasonalVariation: number;
	/** Weather probabilities by season and type */
	weatherProbabilities: {
		[season in Season]: {
			[weatherType in WeatherType]?: number;
		};
	};
	/** Average hours for weather transitions */
	transitionSpeed: number;
}

/**
 * Weather generation options
 */
export interface WeatherGenerationOptions {
	/** Climate template to use */
	climate: ClimateTemplate;
	/** Current season */
	season: Season;
	/** Previous weather state for smooth transitions (optional) */
	previousWeather?: WeatherCondition | null;
	/** Day of year (1-365) for deterministic generation */
	dayOfYear: number;
	/** Hour of day (0-23) for temperature calculation */
	hourOfDay?: number;
	/** Hex coordinate for rain shadow calculation (optional) */
	hexCoord?: { q: number; r: number; s: number } | null;
	/** Wind direction in degrees (0-360) for rain shadow (optional) */
	windDirection?: number;
	/** Function to get elevation at a coordinate for rain shadow (optional) */
	getElevation?: ((c: { q: number; r: number; s: number }) => number | undefined) | null;
	/** Random seed for deterministic generation */
	seed?: number;
}

/**
 * Weather zone grouping multiple hexes with shared weather
 */
export interface WeatherZone {
	/** Zone identifier */
	id: string;
	/** Hexes in this zone */
	hexes: Array<{ q: number; r: number; s: number }>;
	/** Shared weather state */
	weather: WeatherState;
	/** Climate template name */
	climateName: string;
}
