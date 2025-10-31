/**
 * Playlist Serializer
 *
 * Converts playlist data to markdown format for storage.
 */

import type { PlaylistData } from "./types";

export function playlistToMarkdown(data: PlaylistData): string {
	const lines: string[] = [];

	// Header
	lines.push(`# ${data.display_name || data.name || "Unnamed Playlist"}`);
	lines.push("");

	// Description
	if (data.description) {
		lines.push(data.description);
		lines.push("");
	}

	// Basic info
	lines.push(`**Type:** ${data.type}`);
	lines.push(`**Tracks:** ${data.tracks?.length || 0}`);
	lines.push("");

	// Tags section
	const hasTags =
		(data.terrain_tags && data.terrain_tags.length > 0) ||
		(data.weather_tags && data.weather_tags.length > 0) ||
		(data.time_of_day_tags && data.time_of_day_tags.length > 0) ||
		(data.faction_tags && data.faction_tags.length > 0) ||
		(data.situation_tags && data.situation_tags.length > 0);

	if (hasTags) {
		lines.push("## Tags");
		lines.push("");

		if (data.terrain_tags && data.terrain_tags.length > 0) {
			lines.push(`**Terrain:** ${data.terrain_tags.map((t) => t.value).join(", ")}`);
		}
		if (data.weather_tags && data.weather_tags.length > 0) {
			lines.push(`**Weather:** ${data.weather_tags.map((t) => t.value).join(", ")}`);
		}
		if (data.time_of_day_tags && data.time_of_day_tags.length > 0) {
			lines.push(`**Time of Day:** ${data.time_of_day_tags.map((t) => t.value).join(", ")}`);
		}
		if (data.faction_tags && data.faction_tags.length > 0) {
			lines.push(`**Faction:** ${data.faction_tags.map((t) => t.value).join(", ")}`);
		}
		if (data.situation_tags && data.situation_tags.length > 0) {
			lines.push(`**Situation:** ${data.situation_tags.map((t) => t.value).join(", ")}`);
		}
		lines.push("");
	}

	// Playback settings
	lines.push("## Playback");
	lines.push("");
	lines.push(`**Shuffle:** ${data.shuffle ? "Yes" : "No"}`);
	lines.push(`**Loop:** ${data.loop ? "Yes" : "No"}`);
	if (data.crossfade_duration !== undefined) {
		lines.push(`**Crossfade:** ${data.crossfade_duration}s`);
	}
	if (data.default_volume !== undefined) {
		lines.push(`**Volume:** ${Math.round(data.default_volume * 100)}%`);
	}
	lines.push("");

	// Tracks section
	if (data.tracks && data.tracks.length > 0) {
		lines.push("## Tracks");
		lines.push("");

		data.tracks.forEach((track, index) => {
			lines.push(`${index + 1}. **${track.name}**`);
			lines.push(`   - Source: \`${track.source}\``);
			if (track.duration) {
				const minutes = Math.floor(track.duration / 60);
				const seconds = Math.round(track.duration % 60);
				lines.push(`   - Duration: ${minutes}:${seconds.toString().padStart(2, "0")}`);
			}
			if (track.volume !== undefined) {
				lines.push(`   - Volume: ${Math.round(track.volume * 100)}%`);
			}
			lines.push("");
		});
	}

	return lines.join("\n");
}
