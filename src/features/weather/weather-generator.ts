/**
 * Weather Generator
 *
 * Procedural weather generation using climate templates and Markov transitions.
 * Generates realistic weather patterns with smooth transitions and seasonal variation.
 */

import type { ClimateTemplate, Season, WeatherCondition, WeatherState, WeatherGenerationOptions, WeatherType } from "./types";

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
 * Calculate temperature based on climate, season, and day of year
 */
function calculateTemperature(
	climate: ClimateTemplate,
	season: Season,
	dayOfYear: number,
	random: () => number,
): number {
	const { baseTemperature, seasonalVariation } = climate;

	// Seasonal adjustment (sine wave across year)
	const yearProgress = dayOfYear / 365;
	const seasonalOffset = Math.sin(yearProgress * 2 * Math.PI - Math.PI / 2) * seasonalVariation;

	// Base temperature (midpoint of range)
	const baseTemp = (baseTemperature.min + baseTemperature.max) / 2;

	// Random daily variation (±5 degrees)
	const dailyVariation = (random() - 0.5) * 10;

	return baseTemp + seasonalOffset + dailyVariation;
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
 * Calculate precipitation rate based on weather type and severity
 */
function calculatePrecipitation(weatherType: WeatherType, severity: number): number {
	if (weatherType === "rain") {
		return severity * 10; // 0-10 mm/hour
	}
	if (weatherType === "storm") {
		return 5 + severity * 20; // 5-25 mm/hour
	}
	if (weatherType === "snow") {
		return severity * 5; // 0-5 mm/hour (snow water equivalent)
	}
	return 0; // No precipitation for other types
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
 * @returns Generated weather state
 */
export function generateWeather(options: WeatherGenerationOptions): WeatherState {
	const { climate, season, previousWeather, dayOfYear, seed } = options;

	// Create seeded RNG for deterministic generation
	const random = seededRandom(seed ?? dayOfYear);

	// Get season-specific probabilities
	const climateProbabilities = climate.weatherProbabilities[season];

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
	const duration = calculateDuration(climate, random);
	const temperature = calculateTemperature(climate, season, dayOfYear, random);
	const windSpeed = calculateWindSpeed(weatherType, severity, random);
	const precipitation = calculatePrecipitation(weatherType, severity);
	const visibility = calculateVisibility(weatherType, severity);

	// Placeholder hex coord (will be set by caller)
	const hexCoord = { q: 0, r: 0, s: 0 };

	return {
		hexCoord,
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
 * Generate weather for next time period based on current state
 */
export function advanceWeather(
	currentState: WeatherState,
	climate: ClimateTemplate,
	dayOfYear: number,
	seed?: number,
): WeatherState {
	const season = getSeasonForDay(dayOfYear);

	return {
		...generateWeather({
			climate,
			season,
			previousWeather: currentState.currentWeather,
			dayOfYear,
			seed,
		}),
		hexCoord: currentState.hexCoord,
	};
}
