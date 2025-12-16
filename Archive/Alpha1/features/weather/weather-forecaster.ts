/**
 * Weather Forecaster
 *
 * Generates weather forecasts by simulating future weather states.
 * Uses the weather generator with incremental seeds for consistency.
 */

import { generateWeather } from "./weather-generator";
import type { ClimateTemplate, Season, WeatherState } from "./weather-types";
import type { WeatherForecast } from "./weather-store";

/**
 * Options for forecast generation
 */
export interface ForecastOptions {
	/** Starting hex coordinate (cube coords) */
	hexCoord: { q: number; r: number; s: number };
	/** Climate template to use */
	climate: ClimateTemplate;
	/** Current season */
	season: Season;
	/** Current weather state (for smooth transitions) */
	currentWeather: WeatherState;
	/** Current game date (ISO string) */
	currentDate: string;
	/** Number of days to forecast (default 3) */
	daysAhead?: number;
}

/**
 * Generate weather forecast for next N days
 * Confidence decreases with time (day 1 = 0.9, day 2 = 0.7, day 3 = 0.5)
 */
export function generateForecast(options: ForecastOptions): WeatherForecast[] {
	const {
		hexCoord,
		climate,
		season,
		currentWeather,
		currentDate,
		daysAhead = 3,
	} = options;

	const forecasts: WeatherForecast[] = [];
	let previousWeather = currentWeather;
	const startDate = new Date(currentDate);

	// Base seed from hex coordinates (deterministic per hex)
	const baseSeed = hexCoord.q * 1000 + hexCoord.r * 100 + hexCoord.s;

	for (let day = 1; day <= daysAhead; day++) {
		// Calculate future date
		const forecastDate = new Date(startDate);
		forecastDate.setDate(forecastDate.getDate() + day);
		const forecastDateStr = forecastDate.toISOString();

		// Get day of year for seed variation
		const dayOfYear = Math.floor(
			(forecastDate.getTime() - new Date(forecastDate.getFullYear(), 0, 0).getTime()) /
				(1000 * 60 * 60 * 24)
		);

		// Generate weather for this day (use day offset in seed)
		// Use noon (12) as representative hour for daily forecast
		const forecastedWeather = generateWeather({
			climate,
			season,
			previousWeather: previousWeather.currentWeather,
			dayOfYear,
			hourOfDay: 12,  // Noon temperature for forecast
			hexCoord,
			seed: baseSeed + day,
		});

		// Calculate confidence (decreases over time)
		const confidence = Math.max(0.3, 1.0 - (day - 1) * 0.2);

		forecasts.push({
			weather: forecastedWeather,
			date: forecastDateStr,
			confidence,
		});

		// Use this forecast as previous weather for next iteration
		previousWeather = forecastedWeather;
	}

	return forecasts;
}

/**
 * Get confidence description in German
 */
export function getConfidenceLabel(confidence: number): string {
	if (confidence >= 0.8) return "Sehr sicher";
	if (confidence >= 0.6) return "Wahrscheinlich";
	if (confidence >= 0.4) return "Möglich";
	return "Unsicher";
}
