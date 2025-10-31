/**
 * Auto-Selection Service
 *
 * Context-aware playlist filtering and scoring.
 * Matches playlists to session context based on terrain, weather, time, faction, and situation tags.
 */

import type { PlaylistData } from "../../workmodes/library/playlists/types";
import type { SessionContext, PlaylistMatch, AutoSelectionResult } from "./auto-selection-types";

/**
 * Calculate match score for a playlist against session context
 *
 * Scoring algorithm:
 * - Each matching tag category adds 1 point
 * - Each matching tag within a category adds 0.5 points
 * - Faction tags are weighted higher (multiple factions can be present)
 *
 * Examples:
 * - Playlist [Forest, Rain, Combat] vs Context {terrain: Forest, weather: Rain, situation: Combat}
 *   → 3 categories matched + 3 tags = 3 + 1.5 = 4.5 points
 * - Playlist [Forest] vs Context {terrain: Forest, weather: Rain}
 *   → 1 category matched + 1 tag = 1 + 0.5 = 1.5 points
 * - Playlist [Mountain] vs Context {terrain: Forest}
 *   → 0 matches = 0 points
 */
export function calculatePlaylistScore(playlist: PlaylistData, context: SessionContext): PlaylistMatch {
	const matchedCategories: string[] = [];
	let matchedTagCount = 0;

	// Helper: Check if any tag matches the context value
	const hasMatchingTag = (tags: Array<{ value: string }> | undefined, contextValue: string | undefined): boolean => {
		if (!tags || !contextValue) return false;
		return tags.some((tag) => tag.value === contextValue);
	};

	// Helper: Check if any tag matches any context value
	const hasMatchingTagInArray = (
		tags: Array<{ value: string }> | undefined,
		contextValues: string[] | undefined,
	): number => {
		if (!tags || !contextValues) return 0;
		let matches = 0;
		for (const tag of tags) {
			if (contextValues.includes(tag.value)) {
				matches++;
			}
		}
		return matches;
	};

	// Check terrain match
	if (hasMatchingTag(playlist.terrain_tags, context.terrain)) {
		matchedCategories.push("terrain");
		matchedTagCount++;
	}

	// Check weather match
	if (hasMatchingTag(playlist.weather_tags, context.weather)) {
		matchedCategories.push("weather");
		matchedTagCount++;
	}

	// Check time of day match
	if (hasMatchingTag(playlist.time_of_day_tags, context.timeOfDay)) {
		matchedCategories.push("timeOfDay");
		matchedTagCount++;
	}

	// Check faction matches (can be multiple)
	const factionMatches = hasMatchingTagInArray(playlist.faction_tags, context.factions);
	if (factionMatches > 0) {
		matchedCategories.push("faction");
		matchedTagCount += factionMatches;
	}

	// Check situation match
	if (hasMatchingTag(playlist.situation_tags, context.situation)) {
		matchedCategories.push("situation");
		matchedTagCount++;
	}

	// Score = category count + (tag count * 0.5)
	const score = matchedCategories.length + matchedTagCount * 0.5;

	return {
		playlistName: playlist.name,
		score,
		matchedCategories,
		matchedTagCount,
	};
}

/**
 * Select best matching playlist from available playlists
 *
 * Returns the playlist with the highest score, plus alternatives.
 * If no playlists match, returns null for selected but includes all playlists as alternatives.
 */
export function selectPlaylist(playlists: PlaylistData[], context: SessionContext): AutoSelectionResult {
	// Score all playlists
	const matches = playlists.map((playlist) => calculatePlaylistScore(playlist, context));

	// Sort by score descending
	matches.sort((a, b) => b.score - a.score);

	// Select best match (score > 0 means at least one tag matched)
	const selected = matches.length > 0 && matches[0].score > 0 ? matches[0] : null;

	// Alternatives are all other playlists
	const alternatives = selected ? matches.slice(1) : matches;

	return {
		selected,
		alternatives,
		context,
	};
}

/**
 * Filter playlists by type (ambience or music)
 *
 * Useful for maintaining separate ambience and music players.
 */
export function filterPlaylistsByType(playlists: PlaylistData[], type: "ambience" | "music"): PlaylistData[] {
	return playlists.filter((playlist) => playlist.type === type);
}

/**
 * Get all unique tags from context
 *
 * Useful for debugging and UI display of active context.
 */
export function getActiveTags(context: SessionContext): string[] {
	const tags: string[] = [];
	if (context.terrain) tags.push(context.terrain);
	if (context.weather) tags.push(context.weather);
	if (context.timeOfDay) tags.push(context.timeOfDay);
	if (context.factions) tags.push(...context.factions);
	if (context.situation) tags.push(context.situation);
	return tags;
}
