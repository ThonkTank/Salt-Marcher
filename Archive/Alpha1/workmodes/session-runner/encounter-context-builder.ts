/**
 * Encounter Context Builder
 *
 * Extracts encounter generation context from current hex and travel state.
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { axialToCube } from "@geometry";

const logger = configurableLogger.forModule("session-encounter-context");
import { loadTile } from "@features/maps";
import { weatherStore } from "@features/weather/weather-store";
import { mapWeatherTypeToTags } from "@features/weather/weather-tag-mapper";
import { getPartyStore } from "@services/state/party-store";
import { createAlmanacGateway } from "@services/orchestration";
import type { SessionContext } from "@features/audio/auto-selection-types";
import type { EncounterGenerationContext } from "@features/encounters/encounter-types";
import type { TileData, MoistureLevel } from "@domain";
import type { LogicStateSnapshot } from "./travel/engine/types";

/** Moisture levels that indicate wet/aquatic terrain */
const WET_MOISTURE_LEVELS: readonly MoistureLevel[] = [
	"marshy",
	"swampy",
	"ponds",
	"lakes",
	"large_lake",
	"sea",
];

/**
 * Build encounter context from current hex position
 *
 * @param app Obsidian app instance
 * @param mapFile Current map file
 * @param state Travel state snapshot
 * @returns Encounter generation context
 */
export async function buildEncounterContext(
	app: App,
	mapFile: TFile | null,
	state: LogicStateSnapshot,
): Promise<EncounterGenerationContext> {
	// Get current hex coordinate
	const currentCoord = state.currentTile ?? state.tokenCoord ?? null;

	logger.info("Building context", {
		mapFile: mapFile?.path,
		currentCoord,
	});

	// Extract terrain, faction, and moisture from hex data
	let terrainTags: string[] = [];
	let factionTags: string[] = [];
	let moistureLevel: MoistureLevel | undefined;
	let tileData: TileData | undefined = undefined;

	if (mapFile && currentCoord) {
		try {
			tileData = await loadTile(app, mapFile, currentCoord) ?? undefined;
			if (tileData) {
				// Extract terrain tag (normalize to lowercase for matching)
				if (tileData.terrain) {
					const terrainTag = tileData.terrain.toLowerCase().trim();
					if (terrainTag) {
						terrainTags.push(terrainTag);
					}
				}

				// Extract faction tag
				if (tileData.faction) {
					const factionTag = tileData.faction.toLowerCase().trim();
					if (factionTag) {
						factionTags.push(factionTag);
					}
				}

				// Extract moisture level for aquatic affinity
				moistureLevel = tileData.moisture;

				logger.info("Extracted hex data", {
					terrain: tileData.terrain,
					faction: tileData.faction,
					region: tileData.region,
					moisture: moistureLevel,
				});
			}
		} catch (err) {
			logger.warn("Failed to load tile data", { err });
		}
	}

	// Fallback to default if no terrain extracted
	if (terrainTags.length === 0) {
		terrainTags = ["any"];
	}

	// Phase 8.8: Convert current hex to cube coordinates for faction lookup
	let hexCoords: { q: number; r: number; s: number } | undefined;
	if (currentCoord && mapFile) {
		try {
			// currentCoord is already in axial format {q, r}
			hexCoords = axialToCube(currentCoord);

			logger.info("Converted hex coordinates", {
				axial: currentCoord,
				cube: hexCoords,
			});
		} catch (err) {
			logger.warn("Failed to convert hex coordinates", { err });
		}
	}

	// Extract weather from weather store if hex coordinates available
	let weatherTags: string[] = ["clear"]; // Default fallback
	if (hexCoords && mapFile) {
		try {
			const weatherState = weatherStore.getWeather(
				mapFile.path,
				hexCoords.q,
				hexCoords.r,
				hexCoords.s,
			);

			if (weatherState) {
				weatherTags = mapWeatherTypeToTags(weatherState.currentWeather.type);
				logger.info("Extracted weather from store", {
					weatherType: weatherState.currentWeather.type,
					tags: weatherTags,
					temperature: weatherState.temperature,
					severity: weatherState.currentWeather.severity,
				});
			} else {
				logger.info("No weather data for hex, using default", {
					hexCoords,
				});
			}
		} catch (err) {
			logger.warn("Failed to extract weather from store", { err });
		}
	}

	// Extract time of day from calendar gateway
	let timeTags: string[] = ["day"]; // Default fallback
	try {
		const calendarGateway = createAlmanacGateway(app);
		const currentTime = calendarGateway.getCurrentTimestamp();

		if (currentTime && currentTime.hour !== undefined) {
			const hour = currentTime.hour;

			// Determine time of day based on hour (24-hour format)
			if (hour >= 6 && hour < 12) {
				timeTags = ["morning"];
			} else if (hour >= 12 && hour < 18) {
				timeTags = ["afternoon"];
			} else if (hour >= 18 && hour < 22) {
				timeTags = ["evening"];
			} else {
				timeTags = ["night"];
			}

			logger.info("Extracted time of day from calendar", {
				hour,
				timeTag: timeTags[0],
			});
		} else {
			logger.info("No current time available, using default 'day'");
		}
	} catch (err) {
		logger.warn("Failed to extract time from calendar, using default", { err });
	}

	// Default situation for random encounters during travel
	const situationTags: string[] = ["wandering"];

	// Add "aquatic" situation tag if moisture level indicates wet terrain
	// This favors amphibious and aquatic creatures
	if (moistureLevel && WET_MOISTURE_LEVELS.includes(moistureLevel)) {
		situationTags.push("aquatic");
		logger.info("Wet terrain detected, added 'aquatic' situation tag", {
			moisture: moistureLevel,
		});
	}

	logger.info("Context built", {
		tags: { terrain: terrainTags, weather: weatherTags, time: timeTags, faction: factionTags, situation: situationTags },
		hexCoords,
		moisture: moistureLevel,
	});

	// Build SessionContext for encounter generation
	const sessionContext: SessionContext = {
		terrain: terrainTags[0], // Primary terrain
		weather: weatherTags[0], // Primary weather
		timeOfDay: timeTags[0], // Primary time
		factions: factionTags, // All factions
		situation: situationTags.join(","), // All situations (including climate)
	};

	// Get party members from party store
	const partyStore = getPartyStore();
	const partyState = partyStore.get();

	return {
		party: partyState.members,
		sessionContext,
		hexCoords,
		tileData,
	};
}
