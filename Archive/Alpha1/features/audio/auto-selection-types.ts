/**
 * Auto-Selection Types
 *
 * Context-aware playlist filtering based on session state.
 * Matches playlists to current terrain, weather, time, faction, and situation.
 */

import type { PlaylistData } from "@services/domain";

/**
 * Session context for playlist auto-selection
 *
 * Represents the current game state from which playlist tags are derived.
 */
export interface SessionContext {
	/** Current terrain (from hex) */
	terrain?: string;
	/** Current weather condition */
	weather?: string;
	/** Time of day */
	timeOfDay?: string;
	/** Present faction tags (from nearby NPCs/creatures) */
	factions?: string[];
	/** Current situation/activity */
	situation?: string;
}

/**
 * Internal scoring result for a playlist
 * Used internally by auto-selection, not exported to consumers
 */
export interface PlaylistScore {
	/** Match score (0 = no match, higher = better match) */
	score: number;
	/** Tag categories that matched */
	matchedCategories: string[];
	/** Total tag matches across all categories */
	matchedTagCount: number;
}

/**
 * Auto-selection result
 *
 * Returns the actual PlaylistData objects for direct use by consumers.
 */
export interface AutoSelectionResult {
	/** Best matching playlist (null if no playlists match) */
	selected: PlaylistData | null;
	/** Match score for selected playlist (0 if none selected) */
	score: number;
	/** Tag categories that matched for selected playlist */
	matchedCategories: string[];
	/** Alternative playlists sorted by score */
	alternatives: Array<{ playlist: PlaylistData; score: number }>;
	/** Context used for selection */
	context: SessionContext;
}
