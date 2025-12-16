/**
 * Playlist CreateSpec
 *
 * Declarative field specification for playlist creation using the global modal system.
 * Playlists organize audio tracks and are filtered by terrain, weather, time, faction, and situation tags.
 */

import {
	PLAYLIST_TYPES,
	TERRAIN_TAGS,
	WEATHER_TAGS,
	TIME_OF_DAY_TAGS,
	FACTION_TAGS,
	SITUATION_TAGS,
	DEFAULT_CROSSFADE_DURATION,
	DEFAULT_VOLUME,
} from "./constants";
// Removed: import { playlistToMarkdown } from "./serializer";
import type { PlaylistData } from './calendar-types';
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

// ============================================================================
// SCHEMA WITH VALIDATION
// ============================================================================

const playlistSchema: DataSchema<PlaylistData> = {
	parse: (data: unknown) => data as PlaylistData,
	safeParse: (data: unknown) => {
		try {
			const playlist = data as PlaylistData;

			// Validate name
			if (!playlist.name || typeof playlist.name !== "string" || playlist.name.trim().length === 0) {
				return {
					success: false,
					error: new Error("Name is required"),
				};
			}

			// Validate type
			if (!playlist.type || !["ambience", "music"].includes(playlist.type)) {
				return {
					success: false,
					error: new Error("Type must be 'ambience' or 'music'"),
				};
			}

			// Validate tracks array exists
			if (!Array.isArray(playlist.tracks)) {
				return {
					success: false,
					error: new Error("Tracks must be an array"),
				};
			}

			// Validate volume if provided
			if (playlist.default_volume !== undefined) {
				if (typeof playlist.default_volume !== "number" || playlist.default_volume < 0 || playlist.default_volume > 1) {
					return {
						success: false,
						error: new Error("Default volume must be between 0.0 and 1.0"),
					};
				}
			}

			// Validate crossfade if provided
			if (playlist.crossfade_duration !== undefined) {
				if (typeof playlist.crossfade_duration !== "number" || playlist.crossfade_duration < 0) {
					return {
						success: false,
						error: new Error("Crossfade duration must be non-negative"),
					};
				}
			}

			return { success: true, data: playlist };
		} catch (error) {
			return { success: false, error };
		}
	},
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const fields: AnyFieldSpec[] = [
	{
		id: "name",
		label: "Name",
		type: "text",
		required: true,
		placeholder: "Forest Ambience",
		description: "Internal name for the playlist (used for file path)",
	},
	{
		id: "display_name",
		label: "Display Name",
		type: "text",
		placeholder: "Mystical Forest Sounds",
		description: "Human-readable name shown in UI (defaults to name if not set)",
	},
	{
		id: "type",
		label: "Type",
		type: "select",
		required: true,
		options: PLAYLIST_TYPES.map((t) => ({ value: t.value, label: t.label })),
		default: "ambience",
		description: "Playlist type: ambience (background sounds) or music (tracks with melody)",
	},
	{
		id: "description",
		label: "Description",
		type: "textarea",
		placeholder: "A collection of atmospheric forest sounds...",
		description: "Optional description of the playlist's mood and content",
	},

	// Tag fields for automatic selection
	{
		id: "terrain_tags",
		label: "Terrain Tags",
		type: "tokens",
		config: {
			fields: [
				{
					id: "value",
					type: "select",
					displayInChip: true,
					editable: true,
					suggestions: TERRAIN_TAGS.map((tag) => ({ key: tag, label: tag })),
					placeholder: "Terrain auswählen...",
				},
			],
			primaryField: "value",
		},
		default: [],
		description: "Terrain types this playlist matches (Forest, Mountain, etc.)",
	},
	{
		id: "weather_tags",
		label: "Weather Tags",
		type: "tokens",
		config: {
			fields: [
				{
					id: "value",
					type: "select",
					displayInChip: true,
					editable: true,
					suggestions: WEATHER_TAGS.map((tag) => ({ key: tag, label: tag })),
					placeholder: "Weather auswählen...",
				},
			],
			primaryField: "value",
		},
		default: [],
		description: "Weather conditions this playlist matches (Clear, Rain, Storm, etc.)",
	},
	{
		id: "time_of_day_tags",
		label: "Time of Day Tags",
		type: "tokens",
		config: {
			fields: [
				{
					id: "value",
					type: "select",
					displayInChip: true,
					editable: true,
					suggestions: TIME_OF_DAY_TAGS.map((tag) => ({ key: tag, label: tag })),
					placeholder: "Time auswählen...",
				},
			],
			primaryField: "value",
		},
		default: [],
		description: "Time of day this playlist matches (Dawn, Night, etc.)",
	},
	{
		id: "faction_tags",
		label: "Faction Tags",
		type: "tokens",
		config: {
			fields: [
				{
					id: "value",
					type: "select",
					displayInChip: true,
					editable: true,
					suggestions: FACTION_TAGS.map((tag) => ({ key: tag, label: tag })),
					placeholder: "Faction auswählen...",
				},
			],
			primaryField: "value",
		},
		default: [],
		description: "Faction types this playlist matches (Friendly, Hostile, Undead, etc.)",
	},
	{
		id: "situation_tags",
		label: "Situation Tags",
		type: "tokens",
		config: {
			fields: [
				{
					id: "value",
					type: "select",
					displayInChip: true,
					editable: true,
					suggestions: SITUATION_TAGS.map((tag) => ({ key: tag, label: tag })),
					placeholder: "Situation auswählen...",
				},
			],
			primaryField: "value",
		},
		default: [],
		description: "Situations this playlist matches (Combat, Exploration, Stealth, etc.)",
	},

	// Playback settings
	{
		id: "shuffle",
		label: "Shuffle",
		type: "checkbox",
		default: false,
		description: "Randomize track order during playback",
	},
	{
		id: "loop",
		label: "Loop",
		type: "checkbox",
		default: true,
		description: "Restart playlist after last track finishes",
	},
	{
		id: "crossfade_duration",
		label: "Crossfade Duration (seconds)",
		type: "number-stepper",
		min: 0,
		max: 10,
		step: 0.5,
		default: DEFAULT_CROSSFADE_DURATION,
		description: "Seconds to fade between tracks (0 = no crossfade)",
	},
	{
		id: "default_volume",
		label: "Default Volume",
		type: "number-stepper",
		min: 0,
		max: 1,
		step: 0.05,
		default: DEFAULT_VOLUME,
		description: "Default volume level (0.0 = muted, 1.0 = full volume)",
	},

	// Tracks list
	{
		id: "tracks",
		label: "Tracks",
		type: "list",
		config: {
			fields: [
				{
					id: "name",
					label: "Track Name",
					type: "text",
					required: true,
					placeholder: "Wind Through Trees",
				},
				{
					id: "source",
					label: "Source Path",
					type: "text",
					required: true,
					placeholder: "Audio/forest_ambience.mp3",
					description: "File path relative to vault root or external URL",
				},
				{
					id: "duration",
					label: "Duration (seconds)",
					type: "number-stepper",
					min: 0,
					step: 1,
					placeholder: "180",
					description: "Track length in seconds (optional, for display)",
				},
				{
					id: "volume",
					label: "Track Volume",
					type: "number-stepper",
					min: 0,
					max: 1,
					step: 0.05,
					placeholder: "1.0",
					description: "Volume multiplier for this track (0.0 - 1.0)",
				},
			],
			itemLabel: (item: any) => item.name || "Unnamed Track",
		},
		default: [],
		description: "Audio tracks in this playlist",
	},
];

// ============================================================================
// SPEC
// ============================================================================

export const playlistSpec: CreateSpec<PlaylistData> = {
	kind: "playlist",
	title: "Playlist erstellen",
	subtitle: "Neue Audio-Playlist für Session Runner",
	schema: playlistSchema,
	fields,
	storage: {
		format: "md-frontmatter",
		pathTemplate: "SaltMarcher/Playlists/{name}.md",
		filenameFrom: "name",
		directory: "SaltMarcher/Playlists",
		frontmatter: [
			"name",
			"display_name",
			"type",
			"description",
			"terrain_tags",
			"weather_tags",
			"time_of_day_tags",
			"faction_tags",
			"situation_tags",
			"shuffle",
			"loop",
			"crossfade_duration",
			"default_volume",
			"tracks",
		],
    // SQLite backend - removed: 		bodyTemplate: (data) => playlistToMarkdown(data as PlaylistData),
	},
	ui: {
		submitLabel: "Playlist erstellen",
		cancelLabel: "Abbrechen",
		enableNavigation: false,
	},
	browse: {
		metadata: [
			{
				id: "type",
				cls: "sm-cc-item__type",
				getValue: (entry) => entry.type || "Unknown",
			},
			{
				id: "track_count",
				cls: "sm-cc-item__cr",
				getValue: (entry) => `${entry.track_count || 0} tracks`,
			},
		],
		filters: [
			{ id: "type", field: "type", label: "Type", type: "string" },
			{ id: "terrain_tags", field: "terrain_tags", label: "Terrain", type: "array" },
			{ id: "weather_tags", field: "weather_tags", label: "Weather", type: "array" },
			{ id: "time_of_day_tags", field: "time_of_day_tags", label: "Time", type: "array" },
			{ id: "faction_tags", field: "faction_tags", label: "Faction", type: "array" },
			{ id: "situation_tags", field: "situation_tags", label: "Situation", type: "array" },
		],
		sorts: [
			{ id: "name", label: "Name", field: "name" },
			{ id: "type", label: "Type", field: "type" },
			{ id: "track_count", label: "Track Count", field: "track_count" },
		],
		search: ["name", "display_name", "description", "type"],
	},
	loader: {},
};
