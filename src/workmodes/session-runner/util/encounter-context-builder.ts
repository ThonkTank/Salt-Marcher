/**
 * Encounter Context Builder
 *
 * Extracts encounter generation context from current hex and travel state.
 */

import type { App, TFile } from "obsidian";
import type { EncounterGenerationContext } from "../../../features/encounters/encounter-generator";
import type { LogicStateSnapshot } from "../travel/domain/types";
import { logger } from "../../../app/plugin-logger";
import { loadTile } from "../../../features/maps/data/tile-repository";
import { weatherStore } from "../../../features/weather/weather-store";
import { mapWeatherTypeToTags } from "../../../features/weather/weather-tag-mapper";

/**
 * Build encounter context from current hex position
 *
 * @param app Obsidian app instance
 * @param mapFile Current map file
 * @param state Travel state snapshot
 * @param partyLevel Party level (defaults to 1)
 * @param partySize Party size (defaults to 4)
 * @returns Encounter generation context
 */
export async function buildEncounterContext(
	app: App,
	mapFile: TFile | null,
	state: LogicStateSnapshot,
	partyLevel: number = 1,
	partySize: number = 4,
): Promise<EncounterGenerationContext> {
	// Get current hex coordinate
	const currentCoord = state.currentTile ?? state.tokenRC ?? null;

	logger.debug("[EncounterContextBuilder] Building context", {
		mapFile: mapFile?.path,
		currentCoord,
		partyLevel,
		partySize,
	});

	// Extract terrain and faction from hex data
	let terrainTags: string[] = [];
	let factionTags: string[] = [];

	if (mapFile && currentCoord) {
		try {
			const tileData = await loadTile(app, mapFile, currentCoord);
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

				logger.debug("[EncounterContextBuilder] Extracted hex data", {
					terrain: tileData.terrain,
					faction: tileData.faction,
					region: tileData.region,
				});
			}
		} catch (err) {
			logger.warn("[EncounterContextBuilder] Failed to load tile data", { err });
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
			// Convert odd-r coordinates to cube coordinates
			// oddr to cube: q = col - (row - (row&1)) / 2, r = row, s = -q - r
			const col = currentCoord.c;
			const row = currentCoord.r;
			const q = col - Math.floor((row - (row & 1)) / 2);
			const r = row;
			const s = -q - r;
			hexCoords = { q, r, s };

			logger.debug("[EncounterContextBuilder] Converted hex coordinates", {
				oddr: currentCoord,
				cube: hexCoords,
			});
		} catch (err) {
			logger.warn("[EncounterContextBuilder] Failed to convert hex coordinates", { err });
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
				logger.debug("[EncounterContextBuilder] Extracted weather from store", {
					weatherType: weatherState.currentWeather.type,
					tags: weatherTags,
					temperature: weatherState.temperature,
					severity: weatherState.currentWeather.severity,
				});
			} else {
				logger.debug("[EncounterContextBuilder] No weather data for hex, using default", {
					hexCoords,
				});
			}
		} catch (err) {
			logger.warn("[EncounterContextBuilder] Failed to extract weather from store", { err });
		}
	}

	// TODO: Extract time from current in-game time
	// For now, use placeholder
	const timeTags: string[] = ["day"]; // Placeholder

	// Default situation for random encounters during travel
	const situationTags: string[] = ["wandering"];

	logger.debug("[EncounterContextBuilder] Context built", {
		tags: { terrain: terrainTags, weather: weatherTags, time: timeTags, faction: factionTags, situation: situationTags },
		hexCoords,
	});

	return {
		partyLevel,
		partySize,
		tags: {
			terrain: terrainTags,
			weather: weatherTags,
			time: timeTags,
			faction: factionTags,
			situation: situationTags,
		},
		hexCoords,
	};
}
