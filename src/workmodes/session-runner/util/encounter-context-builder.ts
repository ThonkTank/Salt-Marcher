/**
 * Encounter Context Builder
 *
 * Extracts encounter generation context from current hex and travel state.
 */

import type { App, TFile } from "obsidian";
import type { EncounterGenerationContext } from "../../../features/encounters/encounter-generator";
import type { LogicStateSnapshot } from "../travel/domain/types";
import { logger } from "../../../app/plugin-logger";

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

	// TODO: Extract terrain from hex data
	// For now, use placeholder tags
	// Future: Load hex data from map file and extract terrain/region/weather
	const terrainTags: string[] = ["forest"]; // Placeholder
	const weatherTags: string[] = ["clear"]; // Placeholder
	const timeTags: string[] = ["day"]; // Placeholder
	const factionTags: string[] = []; // Placeholder
	const situationTags: string[] = ["wandering"]; // Placeholder

	logger.debug("[EncounterContextBuilder] Context built", {
		tags: { terrain: terrainTags, weather: weatherTags, time: timeTags, faction: factionTags, situation: situationTags },
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
	};
}
