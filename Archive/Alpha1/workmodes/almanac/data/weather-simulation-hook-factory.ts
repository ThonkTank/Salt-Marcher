// src/workmodes/almanac/data/weather-simulation-hook-factory.ts
// Factory for creating weather simulation hook with map context (Phase 10.2)

import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-weather-hook');
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";
import { getAllMapFiles } from "@features/maps/data/map-repository";
import { listTilesForMap } from "@features/maps/data/tile-repository";
import { getClimateTemplate } from "@features/weather/climate-templates";
import { generateWeather, getSeasonForDay } from "@features/weather/weather-generator";
import { weatherStore } from "@features/weather/weather-store";
import type { WeatherSimulationHook } from "./calendar-state-gateway";
import type { WeatherState, ClimateTemplate } from "@features/weather/weather-types";
import type { RegionData } from "../../library/regions/region-types";
import { axialToCube } from "@geometry";

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
			logger.info("Region file not found", { regionName, regionPath });
			return null;
		}

		// Read frontmatter
		const frontmatter = await readFrontmatter(app, file);
		if (!frontmatter) {
			logger.info("No frontmatter in region file", { regionName });
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
		logger.warn("Failed to load region data", {
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
			logger.info("Running weather simulation", {
				dayOfYear,
				currentDate,
			});

			try {
				// Get season for the day
				const season = getSeasonForDay(dayOfYear);

				// Get all map files
				const mapFiles = await getAllMapFiles(app);

				if (mapFiles.length === 0) {
					logger.info("No map files found, using placeholder hexes");
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
							logger.info("No tiles found for map", {
								map: mapFile.path,
							});
							continue;
						}

						const mapId = mapFile.path;

						// Generate weather for each tile
						for (const tile of tiles) {
							const { coord, data } = tile;

							// Convert axial coordinates to cube coordinates
							const cubeCoord = axialToCube(coord);

							// Load region data to determine climate
							let climate: ClimateTemplate;
							if (data.region && data.region.trim()) {
								const regionData = await loadRegionData(app, data.region);
								climate = getClimateFromRegion(regionData);
								logger.info("Using climate from region", {
									region: data.region,
									climate: climate.name,
									hex: cubeCoord,
								});
							} else {
								// No region - use default Temperate climate
								climate = getClimateTemplate("Temperate");
								logger.info("No region, using Temperate climate", {
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
							}, data); // Pass tile data for climate modifiers

							// Set hex coordinates
							weather.hexCoord = cubeCoord;
							weather.lastUpdate = currentDate;

							weatherUpdates.push(weather);
							totalHexes++;
						}

						logger.info("Generated weather for map", {
							map: mapFile.path,
							hexes: tiles.length,
						});
					} catch (error) {
						logger.error("Failed to process map", {
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

				logger.info("Weather simulation complete", {
					hexesUpdated: totalHexes,
					mapsProcessed: mapFiles.length,
					season,
				});

				// Weather updates don't generate calendar events (weather is transient state)
				return [];
			} catch (error) {
				logger.error("Weather simulation failed", {
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
 * Generate weather for placeholder hexagon (fallback when no maps exist)
 *
 * Uses proper hexagonal coordinates (radius 1 = 7 hexes) instead of rectangular 3x3.
 */
async function generatePlaceholderWeather(
	dayOfYear: number,
	currentDate: string,
	season: string
): Promise<Array<{ type: "event"; title: string; date: string; priority: number }>> {
	const weatherUpdates: WeatherState[] = [];
	const climate = getClimateTemplate("Temperate");

	// Generate weather for hexagonal region (radius 1 = 7 hexes)
	// Using Red Blob Games algorithm for proper hexagonal iteration
	const radius = 1;
	for (let dq = -radius; dq <= radius; dq++) {
		const r1 = Math.max(-radius, -dq - radius);
		const r2 = Math.min(radius, -dq + radius);
		for (let dr = r1; dr <= r2; dr++) {
			const q = dq;
			const r = dr;
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

	logger.info("Generated placeholder weather", {
		hexesUpdated: weatherUpdates.length,
		season,
	});

	return [];
}
