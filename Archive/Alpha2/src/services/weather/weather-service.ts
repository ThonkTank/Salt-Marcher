/**
 * Weather Service
 *
 * Calculates and caches weather for the current tile/time.
 * Extends BaseService for subscription pattern.
 *
 * @module services/weather
 */

import type { ClimateData } from '../../schemas/map/tile';
import type { TimePeriod, Season, WeatherState } from '../../schemas/weather';
import { BaseService } from '../base-service';
import { calculateWeather } from '../../utils/weather/calculate';
import { createWeatherState } from '../../utils/weather/describe';

// ============================================================================
// Types
// ============================================================================

export type WeatherInput = {
	tileClimate: ClimateData;
	timePeriod: TimePeriod;
	season: Season;
	tileVariationRange?: number;
};

// ============================================================================
// WeatherService
// ============================================================================

export class WeatherService extends BaseService<WeatherState | null> {
	private lastInput: WeatherInput | null = null;

	constructor() {
		super();
		this.state = null;
	}

	/**
	 * Get current weather state.
	 * Override to return state directly (no shallow copy needed for null).
	 */
	getState(): WeatherState | null {
		return this.state;
	}

	/**
	 * Update weather calculation.
	 * Call when tile, time, or season changes.
	 */
	update(input: WeatherInput): void {
		this.lastInput = input;

		const values = calculateWeather(
			input.tileClimate,
			input.timePeriod,
			input.season,
			input.tileVariationRange
		);

		this.state = createWeatherState(
			values,
			input.timePeriod,
			input.season
		);

		this.notify();
	}

	/**
	 * Recalculate weather (new random roll).
	 * Uses last input if available.
	 */
	reroll(): void {
		if (this.lastInput) {
			this.update(this.lastInput);
		}
	}

	/**
	 * Clear weather state.
	 */
	clear(): void {
		this.state = null;
		this.lastInput = null;
		this.notify();
	}
}
