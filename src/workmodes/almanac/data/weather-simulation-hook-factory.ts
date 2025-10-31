// src/workmodes/almanac/data/weather-simulation-hook-factory.ts
// Factory for creating weather simulation hook with map context (Phase 10.2)

import type { App } from "obsidian";
import type { WeatherSimulationHook } from "./calendar-state-gateway";
import { weatherStore } from "../../../features/weather/weather-store";
import { generateWeather, getSeasonForDay } from "../../../features/weather/weather-generator";
import { getClimateTemplate } from "../../../features/weather/climate-templates";
import type { WeatherState } from "../../../features/weather/types";
import { logger } from "../../../app/plugin-logger";

/**
 * Create a weather simulation hook for daily weather updates
 *
 * This factory creates a WeatherSimulationHook implementation that generates
 * weather for all hexes on active maps. The hook is automatically called when
 * calendar time advances by days.
 *
 * Weather generation:
 * - Uses region climate or defaults to Temperate
 * - Applies seasonal adjustments based on day of year
 * - Uses Markov transitions for smooth weather changes
 * - Updates weather store for UI reactivity
 *
 * Usage:
 * ```typescript
 * const weatherHook = createWeatherSimulationHook(app);
 * const gateway = new VaultCalendarStateGateway(
 *   calendarRepo,
 *   eventRepo,
 *   phenomenonRepo,
 *   vault,
 *   hookDispatcher,
 *   factionHook,
 *   weatherHook
 * );
 * ```
 *
 * @param app - Obsidian App instance (reserved for future hex/region lookup)
 * @returns WeatherSimulationHook implementation
 */
export function createWeatherSimulationHook(app: App): WeatherSimulationHook {
	return {
		async runSimulation(dayOfYear: number, currentDate: string) {
			logger.info("[weather-simulation-hook] Running weather simulation", {
				dayOfYear,
				currentDate,
			});

			try {
				// TODO Phase 10.3: Get active hexes from map/session runner
				// TODO Phase 10.3: Load region climate from hex metadata
				// For now, generate weather for a placeholder set of hexes

				// Get season for the day
				const season = getSeasonForDay(dayOfYear);

				// Generate weather for placeholder hexes (will be extended in Phase 10.3)
				const weatherUpdates: WeatherState[] = [];

				// Example: Generate weather for a 3x3 grid around origin
				for (let q = -1; q <= 1; q++) {
					for (let r = -1; r <= 1; r++) {
						const s = -q - r;

						// Get previous weather if exists (for smooth transitions)
						const previousWeather = weatherStore.getWeather("default-map", q, r, s);

						// Use Temperate climate as default (will be per-region in Phase 10.3)
						const climate = getClimateTemplate("Temperate");

						// Generate new weather
						const weather = generateWeather({
							climate,
							season,
							previousWeather: previousWeather?.currentWeather ?? null,
							dayOfYear,
							seed: dayOfYear + q * 1000 + r * 100, // Deterministic but spatially varied
						});

						// Set hex coordinates
						weather.hexCoord = { q, r, s };
						weather.lastUpdate = currentDate;

						weatherUpdates.push(weather);
					}
				}

				// Batch update weather store
				if (weatherUpdates.length > 0) {
					weatherStore.setWeatherBatch("default-map", weatherUpdates);
				}

				logger.info("[weather-simulation-hook] Weather simulation complete", {
					hexesUpdated: weatherUpdates.length,
					season,
				});

				// Weather updates don't generate calendar events (weather is transient state)
				return [];
			} catch (error) {
				logger.error("[weather-simulation-hook] Weather simulation failed", {
					error: error instanceof Error ? error.message : String(error),
					dayOfYear,
					currentDate,
				});
				// Return empty array on error - don't fail the time advancement
				return [];
			}
		},
	};
}
