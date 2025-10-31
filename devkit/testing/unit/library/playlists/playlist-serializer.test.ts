// devkit/testing/unit/library/playlists/playlist-serializer.test.ts
// Tests for playlist serialization to markdown format

import { describe, it, expect } from "vitest";
import { playlistToMarkdown } from "../../../../../src/workmodes/library/playlists/serializer";
import type { PlaylistData, AudioTrack } from "../../../../../src/workmodes/library/playlists/types";

describe("playlistToMarkdown", () => {
	it("serializes minimal playlist with no tracks", () => {
		const playlist: PlaylistData = {
			name: "empty-playlist",
			type: "ambience",
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("# empty-playlist");
		expect(markdown).toContain("**Type:** ambience");
		expect(markdown).toContain("**Tracks:** 0");
	});

	it("uses display_name when provided", () => {
		const playlist: PlaylistData = {
			name: "forest-ambience",
			display_name: "Mystical Forest Sounds",
			type: "ambience",
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("# Mystical Forest Sounds");
		expect(markdown).not.toContain("# forest-ambience");
	});

	it("includes description when provided", () => {
		const playlist: PlaylistData = {
			name: "dungeon-music",
			type: "music",
			description: "Epic orchestral music for dungeon exploration",
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("Epic orchestral music for dungeon exploration");
	});

	it("serializes terrain tags", () => {
		const playlist: PlaylistData = {
			name: "forest-playlist",
			type: "ambience",
			terrain_tags: [{ value: "Forest" }, { value: "Jungle" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Terrain:** Forest, Jungle");
	});

	it("serializes weather tags", () => {
		const playlist: PlaylistData = {
			name: "storm-playlist",
			type: "ambience",
			weather_tags: [{ value: "Rain" }, { value: "Storm" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Weather:** Rain, Storm");
	});

	it("serializes time of day tags", () => {
		const playlist: PlaylistData = {
			name: "night-playlist",
			type: "ambience",
			time_of_day_tags: [{ value: "Night" }, { value: "Midnight" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Time of Day:** Night, Midnight");
	});

	it("serializes faction tags", () => {
		const playlist: PlaylistData = {
			name: "undead-playlist",
			type: "music",
			faction_tags: [{ value: "Undead" }, { value: "Hostile" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Faction:** Undead, Hostile");
	});

	it("serializes situation tags", () => {
		const playlist: PlaylistData = {
			name: "combat-playlist",
			type: "music",
			situation_tags: [{ value: "Combat" }, { value: "Boss" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Situation:** Combat, Boss");
	});

	it("serializes all tag types together", () => {
		const playlist: PlaylistData = {
			name: "complex-playlist",
			type: "ambience",
			terrain_tags: [{ value: "Cave" }],
			weather_tags: [{ value: "Fog" }],
			time_of_day_tags: [{ value: "Night" }],
			faction_tags: [{ value: "Hostile" }],
			situation_tags: [{ value: "Stealth" }],
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tags");
		expect(markdown).toContain("**Terrain:** Cave");
		expect(markdown).toContain("**Weather:** Fog");
		expect(markdown).toContain("**Time of Day:** Night");
		expect(markdown).toContain("**Faction:** Hostile");
		expect(markdown).toContain("**Situation:** Stealth");
	});

	it("omits tags section when no tags present", () => {
		const playlist: PlaylistData = {
			name: "no-tags-playlist",
			type: "music",
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).not.toContain("## Tags");
	});

	it("serializes playback settings", () => {
		const playlist: PlaylistData = {
			name: "test-playlist",
			type: "music",
			shuffle: true,
			loop: false,
			crossfade_duration: 3,
			default_volume: 0.8,
			tracks: [],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Playback");
		expect(markdown).toContain("**Shuffle:** Yes");
		expect(markdown).toContain("**Loop:** No");
		expect(markdown).toContain("**Crossfade:** 3s");
		expect(markdown).toContain("**Volume:** 80%");
	});

	it("serializes single track", () => {
		const track: AudioTrack = {
			name: "Forest Wind",
			source: "Audio/forest_wind.mp3",
		};

		const playlist: PlaylistData = {
			name: "test-playlist",
			type: "ambience",
			tracks: [track],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("## Tracks");
		expect(markdown).toContain("1. **Forest Wind**");
		expect(markdown).toContain("Source: `Audio/forest_wind.mp3`");
	});

	it("serializes track with duration", () => {
		const track: AudioTrack = {
			name: "Epic Battle",
			source: "Music/battle.mp3",
			duration: 185, // 3:05
		};

		const playlist: PlaylistData = {
			name: "test-playlist",
			type: "music",
			tracks: [track],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("Duration: 3:05");
	});

	it("serializes track with volume", () => {
		const track: AudioTrack = {
			name: "Quiet Ambience",
			source: "Audio/ambience.mp3",
			volume: 0.5,
		};

		const playlist: PlaylistData = {
			name: "test-playlist",
			type: "ambience",
			tracks: [track],
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("Volume: 50%");
	});

	it("serializes multiple tracks", () => {
		const tracks: AudioTrack[] = [
			{
				name: "Track 1",
				source: "Audio/track1.mp3",
				duration: 120,
			},
			{
				name: "Track 2",
				source: "Audio/track2.mp3",
				duration: 180,
				volume: 0.7,
			},
			{
				name: "Track 3",
				source: "Audio/track3.mp3",
			},
		];

		const playlist: PlaylistData = {
			name: "multi-track-playlist",
			type: "music",
			tracks,
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("**Tracks:** 3");
		expect(markdown).toContain("1. **Track 1**");
		expect(markdown).toContain("2. **Track 2**");
		expect(markdown).toContain("3. **Track 3**");
	});

	it("formats track duration correctly", () => {
		const tracks: AudioTrack[] = [
			{ name: "Short", source: "a.mp3", duration: 45 }, // 0:45
			{ name: "Medium", source: "b.mp3", duration: 125 }, // 2:05
			{ name: "Long", source: "c.mp3", duration: 605 }, // 10:05
		];

		const playlist: PlaylistData = {
			name: "duration-test",
			type: "music",
			tracks,
		};

		const markdown = playlistToMarkdown(playlist);

		expect(markdown).toContain("Duration: 0:45");
		expect(markdown).toContain("Duration: 2:05");
		expect(markdown).toContain("Duration: 10:05");
	});

	it("serializes complete playlist with all features", () => {
		const playlist: PlaylistData = {
			name: "complete-playlist",
			display_name: "Complete Test Playlist",
			type: "ambience",
			description: "A fully featured playlist for testing",
			terrain_tags: [{ value: "Forest" }, { value: "Mountain" }],
			weather_tags: [{ value: "Clear" }],
			time_of_day_tags: [{ value: "Dawn" }],
			faction_tags: [{ value: "Friendly" }],
			situation_tags: [{ value: "Exploration" }],
			shuffle: true,
			loop: true,
			crossfade_duration: 2,
			default_volume: 0.7,
			tracks: [
				{
					name: "Track 1",
					source: "Audio/track1.mp3",
					duration: 120,
					volume: 0.8,
				},
				{
					name: "Track 2",
					source: "Audio/track2.mp3",
					duration: 180,
				},
			],
		};

		const markdown = playlistToMarkdown(playlist);

		// Header
		expect(markdown).toContain("# Complete Test Playlist");
		expect(markdown).toContain("**Type:** ambience");
		expect(markdown).toContain("**Tracks:** 2");

		// Description
		expect(markdown).toContain("A fully featured playlist for testing");

		// Tags
		expect(markdown).toContain("**Terrain:** Forest, Mountain");
		expect(markdown).toContain("**Weather:** Clear");
		expect(markdown).toContain("**Time of Day:** Dawn");
		expect(markdown).toContain("**Faction:** Friendly");
		expect(markdown).toContain("**Situation:** Exploration");

		// Playback
		expect(markdown).toContain("**Shuffle:** Yes");
		expect(markdown).toContain("**Loop:** Yes");
		expect(markdown).toContain("**Crossfade:** 2s");
		expect(markdown).toContain("**Volume:** 70%");

		// Tracks
		expect(markdown).toContain("1. **Track 1**");
		expect(markdown).toContain("2. **Track 2**");
	});
});
