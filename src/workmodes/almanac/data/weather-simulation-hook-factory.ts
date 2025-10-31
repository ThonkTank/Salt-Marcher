// src/workmodes/almanac/data/weather-simulation-hook-factory.ts
// Factory for creating weather simulation hook with map context (Phase 10.2)

import type { App, TFile } from "obsidian";
import type { WeatherSimulationHook } from "./calendar-state-gateway";
import { weatherStore } from "../../../features/weather/weather-store";
import { generateWeather, getSeasonForDay } from "../../../features/weather/weather-generator";
import { getClimateTemplate } from "../../../features/weather/climate-templates";
import type { WeatherState, ClimateTemplate } from "../../../features/weather/types";
import { logger } from "../../../app/plugin-logger";
import { getAllMapFiles } from "../../../features/maps/data/map-repository";
import { listTilesForMap } from "../../../features/maps/data/tile-repository";
import { readFrontmatter } from "../../../features/data-manager/browse/frontmatter-utils";
import type { RegionData } from "../../library/regions/types";

/**
 * Hex coordinate in cube system
 */
interface CubeCoord {
	q: number;
	r: number;
	s: number;
}

/**
 * Convert odd-r coordinates to cube coordinates
 * Source: https://www.redblobgames.com/grids/hexagons/#conversions-offset
 */
function oddrToCube(row: number, col: number): CubeCoord {
	const q = col - (row - (row & 1)) / 2;
	const r = row;
	const s = -q - r;
	return { q, r, s };
}

/**
 * Load region data from vault by region name
 * Returns null if region file not found or error occurs
 */
async function loadRegionData(app: App, regionName: string): Promise<RegionData | null> {
	if (!regionName || !regionName.trim()) {
		return null;
	}

	try {
		// Region files are in SaltMarcher/Regions/
		const regionPath = `SaltMarcher/Regions/${regionName}.md`;
		const file = app.vault.getAbstractFileByPath(regionPath) as TFile | null;

		if (!file) {
			logger.debug("[weather-hook] Region file not found", { regionName, regionPath });
			return null;
		}

		// Read frontmatter
		const frontmatter = await readFrontmatter(app, file);
		if (!frontmatter) {
			logger.debug("[weather-hook] No frontmatter in region file", { regionName });
			return null;
		}

		// Parse region data from frontmatter
		const regionData: RegionData = {
			name: frontmatter.name || regionName,
			terrain: frontmatter.terrain || "",
			encounter_odds: frontmatter.encounter_odds,
			description: frontmatter.description,
			biome_tags: frontmatter.biome_tags,
			danger_tags: frontmatter.danger_tags,
			climate_tags: frontmatter.climate_tags,
			settlement_tags: frontmatter.settlement_tags,
		};

		return regionData;
	} catch (error) {
		logger.warn("[weather-hook] Failed to load region data", {
			regionName,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Map region climate tags to climate template
 * Priority: Arctic > Desert > Tropical > Mountain > Coastal > Temperate (default)
 */
function getClimateFromRegion(region: RegionData | null): ClimateTemplate {
	if (!region || !region.climate_tags || region.climate_tags.length === 0) {
		return getClimateTemplate("Temperate");
	}

	// Extract climate tag values
	const climateTags = region.climate_tags.map((tag) => tag.value.toLowerCase());

	// Priority mapping (most specific to least specific)
	if (climateTags.includes("arctic") || climateTags.includes("cold")) {
		return getClimateTemplate("Arctic");
	}
	if (climateTags.includes("desert") || climateTags.includes("hot")) {
		return getClimateTemplate("Desert");
	}
	if (climateTags.includes("tropical") || climateTags.includes("warm")) {
		return getClimateTemplate("Tropical");
	}
	if (climateTags.includes("mountain")) {
		return getClimateTemplate("Mountain");
	}
	if (climateTags.includes("coastal")) {
		return getClimateTemplate("Coastal");
	}

	// Default to Temperate for any other tags
	return getClimateTemplate("Temperate");
}

/**
 * Create a weather simulation hook for daily weather updates
 *
 * This factory creates a WeatherSimulationHook implementation that generates
 * weather for all hexes on active maps. The hook is automatically called when
 * calendar time advances by days.
 *
 * Weather generation:
 * - Scans all map files for hexes with tiles
 * - Loads region data for each hex to determine climate
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
 * @param app - Obsidian App instance for vault access
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
				// Get season for the day
				const season = getSeasonForDay(dayOfYear);

				// Get all map files
				const mapFiles = await getAllMapFiles(app);

				if (mapFiles.length === 0) {
					logger.debug("[weather-simulation-hook] No map files found, using placeholder hexes");
					// No maps found - generate weather for a placeholder 3x3 grid
					return await generatePlaceholderWeather(dayOfYear, currentDate, season);
				}

				// Generate weather for all hexes on all maps
				const weatherUpdates: WeatherState[] = [];
				let totalHexes = 0;

				for (const mapFile of mapFiles) {
					try {
						// Get all tiles for this map
						const tiles = await listTilesForMap(app, mapFile);

						if (tiles.length === 0) {
							logger.debug("[weather-simulation-hook] No tiles found for map", {
								map: mapFile.path,
							});
							continue;
						}

						const mapId = mapFile.path;

						// Generate weather for each tile
						for (const tile of tiles) {
							const { coord, data } = tile;

							// Convert odd-r coordinates to cube coordinates
							const cubeCoord = oddrToCube(coord.r, coord.c);

							// Load region data to determine climate
							let climate: ClimateTemplate;
							if (data.region && data.region.trim()) {
								const regionData = await loadRegionData(app, data.region);
								climate = getClimateFromRegion(regionData);
								logger.debug("[weather-simulation-hook] Using climate from region", {
									region: data.region,
									climate: climate.name,
									hex: cubeCoord,
								});
							} else {
								// No region - use default Temperate climate
								climate = getClimateTemplate("Temperate");
								logger.debug("[weather-simulation-hook] No region, using Temperate climate", {
									hex: cubeCoord,
								});
							}

							// Get previous weather if exists (for smooth transitions)
							const previousWeather = weatherStore.getWeather(
								mapId,
								cubeCoord.q,
								cubeCoord.r,
								cubeCoord.s
							);

							// Generate new weather
							const weather = generateWeather({
								climate,
								season,
								previousWeather: previousWeather?.currentWeather ?? null,
								dayOfYear,
								seed: dayOfYear + cubeCoord.q * 1000 + cubeCoord.r * 100, // Deterministic but spatially varied
							});

							// Set hex coordinates
							weather.hexCoord = cubeCoord;
							weather.lastUpdate = currentDate;

							weatherUpdates.push(weather);
							totalHexes++;
						}

						logger.info("[weather-simulation-hook] Generated weather for map", {
							map: mapFile.path,
							hexes: tiles.length,
						});
					} catch (error) {
						logger.error("[weather-simulation-hook] Failed to process map", {
							map: mapFile.path,
							error: error instanceof Error ? error.message : String(error),
						});
						// Continue with other maps
					}
				}

				// Batch update weather store
				if (weatherUpdates.length > 0) {
					// Group updates by map
					const updatesByMap = new Map<string, WeatherState[]>();
					for (const update of weatherUpdates) {
						const mapId = mapFiles[0]?.path ?? "default-map"; // Use first map as default
						const existing = updatesByMap.get(mapId) ?? [];
						existing.push(update);
						updatesByMap.set(mapId, existing);
					}

					// Apply updates per map
					for (const [mapId, updates] of updatesByMap.entries()) {
						weatherStore.setWeatherBatch(mapId, updates);
					}
				}

				logger.info("[weather-simulation-hook] Weather simulation complete", {
					hexesUpdated: totalHexes,
					mapsProcessed: mapFiles.length,
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

/**
 * Generate weather for placeholder 3x3 grid (fallback when no maps exist)
 */
async function generatePlaceholderWeather(
	dayOfYear: number,
	currentDate: string,
	season: string
): Promise<Array<{ type: "event"; title: string; date: string; priority: number }>> {
	const weatherUpdates: WeatherState[] = [];
	const climate = getClimateTemplate("Temperate");

	// Generate weather for 3x3 grid around origin
	for (let q = -1; q <= 1; q++) {
		for (let r = -1; r <= 1; r++) {
			const s = -q - r;

			// Get previous weather if exists (for smooth transitions)
			const previousWeather = weatherStore.getWeather("default-map", q, r, s);

			// Generate new weather
			const weather = generateWeather({
				climate,
				season,
				previousWeather: previousWeather?.currentWeather ?? null,
				dayOfYear,
				seed: dayOfYear + q * 1000 + r * 100,
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

	logger.info("[weather-simulation-hook] Generated placeholder weather", {
		hexesUpdated: weatherUpdates.length,
		season,
	});

	return [];
}
