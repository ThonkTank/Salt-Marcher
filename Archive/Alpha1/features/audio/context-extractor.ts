/**
 * Session Context Extractor
 *
 * Extracts audio context from session state (current hex, time, situation).
 * Designed to be called from Session Runner when context changes.
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
import { axialToCube, type AxialCoord } from "@geometry";
import { loadTile, type TileData } from "../maps/data/tile-repository";
import { weatherStore } from "../weather/weather-store";
import { getPrimaryWeatherTag } from "../weather/weather-tag-mapper";
import type { SessionContext } from "./auto-selection-types";

const logger = configurableLogger.forModule("audio-context-extractor");

/**
 * Extract session context from current hex
 *
 * @param app - Obsidian app instance
 * @param mapFile - Current map file
 * @param coord - Current hex coordinate (axial format)
 * @param additionalContext - Additional context not derived from hex (weather, time, situation)
 * @returns Session context for playlist auto-selection
 */
export async function extractSessionContext(
	app: App,
	mapFile: TFile,
	coord: AxialCoord,
	additionalContext?: {
		weather?: string;
		timeOfDay?: string;
		situation?: string;
	},
): Promise<SessionContext> {
	let tileData: TileData | null = null;

	try {
		tileData = await loadTile(app, mapFile, coord);
	} catch (error) {
		// If tile can't be loaded, continue with null data
		logger.warn(`Failed to load tile at ${coord.q},${coord.r}:`, error);
	}

	// Extract terrain from tile
	const terrain = tileData?.terrain ? normalizeTerrain(tileData.terrain) : undefined;

	// Extract faction from tile
	const factions: string[] = [];
	if (tileData?.faction) {
		// Normalize faction to match FACTION_TAGS
		const normalizedFaction = normalizeFaction(tileData.faction);
		if (normalizedFaction) {
			factions.push(normalizedFaction);
		}
	}

	// Extract weather from weather store if not provided in additionalContext
	let weather = additionalContext?.weather;
	if (!weather) {
		try {
			// Convert axial coordinates to cube coordinates for weather lookup
			const cube = axialToCube(coord);

			const weatherState = weatherStore.getWeather(mapFile.path, cube.q, cube.r, cube.s);
			if (weatherState) {
				weather = getPrimaryWeatherTag(weatherState.currentWeather.type);
			}
		} catch (error) {
			logger.warn(`Failed to extract weather for hex ${coord.q},${coord.r}:`, error);
		}
	}

	return {
		terrain,
		weather,
		timeOfDay: additionalContext?.timeOfDay,
		factions: factions.length > 0 ? factions : undefined,
		situation: additionalContext?.situation,
	};
}

/**
 * Normalize terrain name to match TERRAIN_TAGS
 *
 * Maps terrain names to canonical tag values.
 */
function normalizeTerrain(terrain: string): string | undefined {
	const normalized = terrain.trim();
	// Direct match (case-insensitive)
	const terrainTags = [
		"Forest",
		"Mountain",
		"Desert",
		"Swamp",
		"Coastal",
		"Ocean",
		"Arctic",
		"Cave",
		"Underground",
		"Urban",
		"Ruins",
		"Plains",
		"Hills",
		"Jungle",
		"Volcanic",
	];

	const match = terrainTags.find((tag) => tag.toLowerCase() === normalized.toLowerCase());
	return match;
}

/**
 * Normalize faction name to match FACTION_TAGS
 *
 * Maps faction names to canonical tag values.
 */
function normalizeFaction(faction: string): string | undefined {
	const normalized = faction.trim();
	const factionTags = [
		"Friendly",
		"Neutral",
		"Hostile",
		"Undead",
		"Fey",
		"Fiend",
		"Celestial",
		"Elemental",
		"Dragon",
		"Giant",
		"Humanoid",
		"Beast",
	];

	const match = factionTags.find((tag) => tag.toLowerCase() === normalized.toLowerCase());
	return match;
}

/**
 * Create empty session context
 *
 * Useful for testing or when no hex is selected.
 */
export function createEmptyContext(): SessionContext {
	return {};
}
