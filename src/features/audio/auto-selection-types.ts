/**
 * Auto-Selection Types
 *
 * Context-aware playlist filtering based on session state.
 * Matches playlists to current terrain, weather, time, faction, and situation.
 */

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
 * Playlist match score
 *
 * Represents how well a playlist matches the current context.
 */
export interface PlaylistMatch {
	/** Playlist identifier */
	playlistName: string;
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
 * Contains the best matching playlist and alternatives.
 */
export interface AutoSelectionResult {
	/** Best matching playlist (null if no playlists available) */
	selected: PlaylistMatch | null;
	/** Alternative playlists sorted by score */
	alternatives: PlaylistMatch[];
	/** Context used for selection */
	context: SessionContext;
}
