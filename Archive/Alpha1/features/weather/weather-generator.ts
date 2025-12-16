/**
 * Weather Generator
 *
 * Procedural weather generation using climate templates and Markov transitions.
 * Generates realistic weather patterns with smooth transitions and seasonal variation.
 */

import { applyClimateModifiers, getWindSpeedModifier, getVisibilityModifier, getMoisturePrecipitationBoost } from "./climate-modifiers";
import type { ClimateTemplate, Season, WeatherState, WeatherGenerationOptions, WeatherType } from "./weather-types";
import type { TileData } from "../maps/data/tile-repository";
import { getClimateEngine, calculateRainShadow } from "@services/climate";
import type { AxialCoord } from "@geometry";

/**
 * Seeded pseudo-random number generator (Mulberry32)
 * Returns number between 0 and 1
 */
function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6D2B79F5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Select weather type based on probabilities
 */
function selectWeatherType(
	probabilities: Record<WeatherType, number>,
	random: () => number,
): WeatherType {
	const roll = random();
	let cumulative = 0;

	for (const [type, probability] of Object.entries(probabilities)) {
		cumulative += probability;
		if (roll <= cumulative) {
			return type as WeatherType;
		}
	}

	// Fallback to clear if probabilities don't sum correctly
	return "clear";
}

/**
 * Calculate transition probability from one weather type to another
 * Favors smooth transitions (clear → cloudy → rain) over abrupt changes
 */
function getTransitionProbability(from: WeatherType, to: WeatherType): number {
	// Define transition matrix (higher = more likely)
	const transitions: Record<WeatherType, Partial<Record<WeatherType, number>>> = {
		clear: { clear: 0.5, cloudy: 0.3, hot: 0.15, wind: 0.05 },
		cloudy: { cloudy: 0.3, clear: 0.2, rain: 0.2, fog: 0.15, wind: 0.1, storm: 0.05 },
		rain: { rain: 0.4, cloudy: 0.3, storm: 0.15, clear: 0.1, fog: 0.05 },
		storm: { storm: 0.3, rain: 0.3, cloudy: 0.2, wind: 0.1, clear: 0.1 },
		snow: { snow: 0.5, cold: 0.2, cloudy: 0.15, wind: 0.1, clear: 0.05 },
		fog: { fog: 0.4, cloudy: 0.3, clear: 0.2, rain: 0.1 },
		wind: { wind: 0.4, cloudy: 0.25, clear: 0.2, storm: 0.1, fog: 0.05 },
		hot: { hot: 0.5, clear: 0.3, cloudy: 0.15, wind: 0.05 },
		cold: { cold: 0.5, snow: 0.2, cloudy: 0.15, clear: 0.1, wind: 0.05 },
	};

	return transitions[from]?.[to] ?? 0.01; // Small baseline probability for any transition
}

/**
 * Apply Markov transition to weather selection
 * Blends climate probabilities with transition probabilities for smooth changes
 */
function applyMarkovTransition(
	climateProbabilities: Record<WeatherType, number>,
	previousWeather: WeatherType,
	transitionWeight: number,
): Record<WeatherType, number> {
	const blended: Record<WeatherType, number> = {} as Record<WeatherType, number>;

	for (const type of Object.keys(climateProbabilities) as WeatherType[]) {
		const climateProb = climateProbabilities[type];
		const transitionProb = getTransitionProbability(previousWeather, type);

		// Blend: 70% climate, 30% transition (adjustable via transitionWeight)
		blended[type] = climateProb * (1 - transitionWeight) + transitionProb * transitionWeight;
	}

	// Normalize to sum to 1.0
	const total = Object.values(blended).reduce((sum, val) => sum + val, 0);
	for (const type of Object.keys(blended) as WeatherType[]) {
		blended[type] /= total;
	}

	return blended;
}

/**
 * Calculate temperature based on terrain-derived climate.
 * Uses ClimateEngine to derive temperature from terrain, moisture, flora, elevation.
 *
 * @param climate Climate template (kept for compatibility, not used for temperature)
 * @param season Current season
 * @param dayOfYear Day of year (1-365)
 * @param hourOfDay Hour in 24-hour format (0-23)
 * @param tileData Full tile data with terrain properties
 * @param random Seeded random number generator
 * @returns Temperature in Celsius
 */
function calculateTemperature(
	climate: ClimateTemplate,
	season: Season,
	dayOfYear: number,
	hourOfDay: number,
	tileData: TileData | null,
	random: () => number,
): number {
	const engine = getClimateEngine();

	// Get terrain-derived temperature at current hour and day
	const temp = engine.getTemperatureAt(tileData ?? undefined, hourOfDay, dayOfYear);

	// Add random daily variation (±2°C) for weather unpredictability
	const variation = (random() - 0.5) * 4;

	return temp + variation;
}

/**
 * Calculate weather severity based on type and randomness
 */
function calculateSeverity(weatherType: WeatherType, random: () => number): number {
	// Base severity ranges by type
	const severityRanges: Record<WeatherType, { min: number; max: number }> = {
		clear: { min: 0, max: 0.2 },
		cloudy: { min: 0.2, max: 0.4 },
		rain: { min: 0.3, max: 0.6 },
		storm: { min: 0.7, max: 1.0 },
		snow: { min: 0.3, max: 0.7 },
		fog: { min: 0.3, max: 0.6 },
		wind: { min: 0.4, max: 0.8 },
		hot: { min: 0.5, max: 0.9 },
		cold: { min: 0.5, max: 0.9 },
	};

	const range = severityRanges[weatherType];
	return range.min + random() * (range.max - range.min);
}

/**
 * Calculate duration in hours for weather condition
 */
function calculateDuration(climate: ClimateTemplate, random: () => number): number {
	// Base duration around transition speed, with variance
	const { transitionSpeed } = climate;
	return transitionSpeed * (0.5 + random() * 1.0); // 50% to 150% of transition speed
}

/**
 * Calculate wind speed based on weather type and severity
 */
function calculateWindSpeed(
	weatherType: WeatherType,
	severity: number,
	random: () => number,
): number {
	const baseWindSpeeds: Record<WeatherType, number> = {
		clear: 5,
		cloudy: 10,
		rain: 20,
		storm: 50,
		snow: 15,
		fog: 5,
		wind: 40,
		hot: 10,
		cold: 15,
	};

	const base = baseWindSpeeds[weatherType];
	const variation = base * severity * random();
	return Math.max(0, base + variation);
}

/**
 * Calculate precipitation rate based on weather type, severity, and rain shadow effects.
 * Rain shadow reduces precipitation on the lee side of mountains.
 *
 * @param weatherType Type of weather (rain, storm, snow, etc.)
 * @param severity Weather severity (0.0 to 1.0)
 * @param coord Hex coordinate for rain shadow calculation
 * @param windDirection Wind direction in degrees (0-360)
 * @param getElevation Function to get elevation at a coordinate
 * @param tileData Optional tile data (currently unused, kept for compatibility)
 * @returns Precipitation rate in mm/hour
 */
function calculatePrecipitation(
	weatherType: WeatherType,
	severity: number,
	coord: AxialCoord | null,
	windDirection: number,
	getElevation: ((c: AxialCoord) => number | undefined) | null,
	tileData?: TileData | null
): number {
	let base = 0;

	if (weatherType === "rain") {
		base = severity * 10; // 0-10 mm/hour
	} else if (weatherType === "storm") {
		base = 5 + severity * 20; // 5-25 mm/hour
	} else if (weatherType === "snow") {
		base = severity * 5; // 0-5 mm/hour (snow water equivalent)
	}

	// Apply rain shadow effects if we have location and elevation data
	if (base > 0 && coord && getElevation) {
		const rainShadow = calculateRainShadow(coord, windDirection, getElevation);
		if (rainShadow) {
			// Rain shadow modifier is negative (reduces precipitation)
			// Example: modifier -0.6 means 60% reduction
			base = base * (1 + rainShadow.modifier);
		}
	}

	return Math.max(0, base);
}

/**
 * Calculate visibility based on weather type and severity
 */
function calculateVisibility(weatherType: WeatherType, severity: number): number {
	const baseVisibility = 10000; // 10km in clear conditions

	const visibilityMultipliers: Record<WeatherType, number> = {
		clear: 1.0,
		cloudy: 0.9,
		rain: 0.5,
		storm: 0.3,
		snow: 0.4,
		fog: 0.2,
		wind: 0.8,
		hot: 0.95,
		cold: 0.95,
	};

	const multiplier = visibilityMultipliers[weatherType];
	return baseVisibility * multiplier * (1 - severity * 0.5);
}

/**
 * Generate weather state for a hex
 *
 * @param options Weather generation options
 * @param tileData Optional tile data with climate modifiers
 * @returns Generated weather state
 */
export function generateWeather(
	options: WeatherGenerationOptions,
	tileData?: TileData | null
): WeatherState {
	const {
		climate,
		season,
		previousWeather,
		dayOfYear,
		hourOfDay = 12,  // Default to noon if not specified
		hexCoord = null,
		windDirection = 270,  // Default to westerly winds
		getElevation = null,
		seed
	} = options;

	// Apply per-hex climate modifiers
	const modifiedClimate = applyClimateModifiers(climate, tileData ?? null);

	// Create seeded RNG for deterministic generation
	const random = seededRandom(seed ?? dayOfYear);

	// Get season-specific probabilities
	let climateProbabilities = modifiedClimate.weatherProbabilities[season];

	// Apply moisture boost to precipitation/fog probabilities
	const moistureBoost = getMoisturePrecipitationBoost(tileData ?? null);
	if (moistureBoost > 1.0) {
		// Boost rain, fog, and storm probabilities (wet weather types)
		const boosted: Record<WeatherType, number> = { ...climateProbabilities };
		boosted.rain = (boosted.rain ?? 0) * moistureBoost;
		boosted.fog = (boosted.fog ?? 0) * moistureBoost;
		boosted.storm = (boosted.storm ?? 0) * moistureBoost;

		// Normalize to sum to 1.0
		const total = Object.values(boosted).reduce((sum, val) => sum + val, 0);
		for (const type of Object.keys(boosted) as WeatherType[]) {
			boosted[type] /= total;
		}

		climateProbabilities = boosted;
	}

	// Apply Markov transition if previous weather exists
	let finalProbabilities = climateProbabilities;
	if (previousWeather) {
		const transitionWeight = 0.4; // 40% weight to smooth transitions
		finalProbabilities = applyMarkovTransition(
			climateProbabilities,
			previousWeather.type,
			transitionWeight,
		);
	}

	// Select weather type
	const weatherType = selectWeatherType(finalProbabilities, random);

	// Calculate weather properties
	const severity = calculateSeverity(weatherType, random);
	const duration = calculateDuration(modifiedClimate, random);
	const temperature = calculateTemperature(modifiedClimate, season, dayOfYear, hourOfDay, tileData ?? null, random);
	let windSpeed = calculateWindSpeed(weatherType, severity, random);
	const precipitation = calculatePrecipitation(weatherType, severity, hexCoord, windDirection, getElevation, tileData);
	let visibility = calculateVisibility(weatherType, severity);

	// Apply wind speed modifier from tile climate data
	const windSpeedModifier = getWindSpeedModifier(tileData ?? null);
	if (windSpeedModifier !== 0) {
		windSpeed = Math.max(0, windSpeed + windSpeedModifier);
	}

	// Apply visibility modifier from tile climate data (cloud cover / sunlight)
	const visibilityModifier = getVisibilityModifier(tileData ?? null);
	if (visibilityModifier !== 1.0) {
		visibility = visibility * visibilityModifier;
	}

	// Use provided hex coord or default to origin
	const finalHexCoord = hexCoord ?? { q: 0, r: 0, s: 0 };

	return {
		hexCoord: finalHexCoord,
		currentWeather: {
			type: weatherType,
			severity,
			duration,
		},
		temperature,
		windSpeed,
		precipitation,
		visibility,
		lastUpdate: new Date().toISOString(),
	};
}

/**
 * Get current season based on day of year (Northern Hemisphere)
 */
export function getSeasonForDay(dayOfYear: number): Season {
	// Spring: Day 80-171 (March 21 - June 20)
	// Summer: Day 172-263 (June 21 - September 22)
	// Autumn: Day 264-354 (September 23 - December 20)
	// Winter: Day 355-79 (December 21 - March 20)

	if (dayOfYear >= 80 && dayOfYear < 172) return "spring";
	if (dayOfYear >= 172 && dayOfYear < 264) return "summer";
	if (dayOfYear >= 264 && dayOfYear < 355) return "autumn";
	return "winter";
}

/**
 * Generate weather for next time period based on current state.
 * Preserves hex coordinate and uses current hour for temperature calculation.
 *
 * @param currentState Current weather state
 * @param climate Climate template
 * @param dayOfYear Day of year (1-365)
 * @param hourOfDay Hour of day (0-23), defaults to 12 (noon)
 * @param windDirection Wind direction in degrees (0-360), defaults to 270 (west)
 * @param getElevation Function to get elevation for rain shadow calculation
 * @param seed Random seed for deterministic generation
 * @returns Next weather state
 */
export function advanceWeather(
	currentState: WeatherState,
	climate: ClimateTemplate,
	dayOfYear: number,
	hourOfDay?: number,
	windDirection?: number,
	getElevation?: ((c: AxialCoord) => number | undefined) | null,
	seed?: number,
): WeatherState {
	const season = getSeasonForDay(dayOfYear);

	return {
		...generateWeather({
			climate,
			season,
			previousWeather: currentState.currentWeather,
			dayOfYear,
			hourOfDay,
			hexCoord: currentState.hexCoord,
			windDirection,
			getElevation,
			seed,
		}),
		hexCoord: currentState.hexCoord,
	};
}
