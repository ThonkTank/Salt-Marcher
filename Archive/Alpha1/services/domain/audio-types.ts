/**
 * Shared Audio Types
 *
 * Playlist and audio track type definitions shared across workmodes,
 * features, and services to eliminate layer violations.
 *
 * @module services/domain/audio-types
 */

/**
 * Individual audio track within a playlist
 */
export interface AudioTrack {
	/** Track name/title */
	name: string;
	/** File path relative to vault root or external URL */
	source: string;
	/** Duration in seconds (optional, for display) */
	duration?: number;
	/** Volume multiplier for this track (0.0 - 1.0) */
	volume?: number;
}

/**
 * Playlist data structure
 */
export interface PlaylistData {
	/** Unique playlist name */
	name: string;
	/** Display name for UI */
	display_name?: string;
	/** Playlist type: ambience or music */
	type: "ambience" | "music";
	/** Description of the playlist */
	description?: string;

	/** Tags for automatic selection */
	terrain_tags?: Array<{ value: string }>;
	weather_tags?: Array<{ value: string }>;
	time_of_day_tags?: Array<{ value: string }>;
	faction_tags?: Array<{ value: string }>;
	situation_tags?: Array<{ value: string }>;

	/** Playback behavior */
	shuffle?: boolean;
	loop?: boolean;
	crossfade_duration?: number; // seconds

	/** Audio tracks */
	tracks: AudioTrack[];

	/** Default volume (0.0 - 1.0) */
	default_volume?: number;
}
