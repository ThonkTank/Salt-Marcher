// devkit/testing/unit/features/audio/auto-selection.test.ts
// Tests context-aware playlist filtering and scoring: tag matching, priority calculation, type filtering.

import { describe, it, expect } from "vitest";
import type { PlaylistData } from "../../../../../src/workmodes/library/playlists/types";
import type { SessionContext } from "../../../../../src/features/audio/auto-selection-types";
import {
	calculatePlaylistScore,
	selectPlaylist,
	filterPlaylistsByType,
	getActiveTags,
} from "../../../../../src/features/audio/auto-selection";

// Helper: Create minimal playlist
function createPlaylist(
	name: string,
	type: "ambience" | "music",
	tags?: {
		terrain?: string[];
		weather?: string[];
		timeOfDay?: string[];
		faction?: string[];
		situation?: string[];
	},
): PlaylistData {
	return {
		name,
		type,
		tracks: [],
		terrain_tags: tags?.terrain?.map((value) => ({ value })),
		weather_tags: tags?.weather?.map((value) => ({ value })),
		time_of_day_tags: tags?.timeOfDay?.map((value) => ({ value })),
		faction_tags: tags?.faction?.map((value) => ({ value })),
		situation_tags: tags?.situation?.map((value) => ({ value })),
	};
}

describe("Auto-Selection - Scoring", () => {
	it("calculates score for exact single-tag match", () => {
		const playlist = createPlaylist("forest-ambience", "ambience", { terrain: ["Forest"] });
		const context: SessionContext = { terrain: "Forest" };

		const match = calculatePlaylistScore(playlist, context);

		expect(match.playlistName).toBe("forest-ambience");
		expect(match.score).toBe(1.5); // 1 category + 1 tag * 0.5
		expect(match.matchedCategories).toEqual(["terrain"]);
		expect(match.matchedTagCount).toBe(1);
	});

	it("calculates score for multi-category match", () => {
		const playlist = createPlaylist("forest-rain-combat", "music", {
			terrain: ["Forest"],
			weather: ["Rain"],
			situation: ["Combat"],
		});
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Rain",
			situation: "Combat",
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(4.5); // 3 categories + 3 tags * 0.5 = 3 + 1.5
		expect(match.matchedCategories).toEqual(["terrain", "weather", "situation"]);
		expect(match.matchedTagCount).toBe(3);
	});

	it("calculates score for partial match", () => {
		const playlist = createPlaylist("forest-rain", "ambience", {
			terrain: ["Forest"],
			weather: ["Rain"],
		});
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Clear", // Mismatch
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(1.5); // 1 category + 1 tag * 0.5
		expect(match.matchedCategories).toEqual(["terrain"]);
		expect(match.matchedTagCount).toBe(1);
	});

	it("calculates score for no match", () => {
		const playlist = createPlaylist("mountain-ambience", "ambience", { terrain: ["Mountain"] });
		const context: SessionContext = { terrain: "Forest" };

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(0);
		expect(match.matchedCategories).toEqual([]);
		expect(match.matchedTagCount).toBe(0);
	});

	it("calculates score for multiple faction matches", () => {
		const playlist = createPlaylist("undead-hostile", "music", {
			faction: ["Undead", "Hostile"],
		});
		const context: SessionContext = {
			factions: ["Undead", "Hostile", "Fiend"],
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(2.0); // 1 category + 2 tags * 0.5 = 1 + 1
		expect(match.matchedCategories).toEqual(["faction"]);
		expect(match.matchedTagCount).toBe(2);
	});

	it("calculates score for single faction in multi-faction context", () => {
		const playlist = createPlaylist("hostile-music", "music", { faction: ["Hostile"] });
		const context: SessionContext = {
			factions: ["Hostile", "Undead"],
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(1.5); // 1 category + 1 tag * 0.5
		expect(match.matchedCategories).toEqual(["faction"]);
		expect(match.matchedTagCount).toBe(1);
	});

	it("handles empty context", () => {
		const playlist = createPlaylist("forest-ambience", "ambience", { terrain: ["Forest"] });
		const context: SessionContext = {};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(0);
		expect(match.matchedCategories).toEqual([]);
	});

	it("handles playlist with no tags", () => {
		const playlist = createPlaylist("generic-music", "music");
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Rain",
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(0);
		expect(match.matchedCategories).toEqual([]);
	});

	it("handles all five tag categories", () => {
		const playlist = createPlaylist("full-context", "music", {
			terrain: ["Forest"],
			weather: ["Rain"],
			timeOfDay: ["Night"],
			faction: ["Hostile"],
			situation: ["Combat"],
		});
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Rain",
			timeOfDay: "Night",
			factions: ["Hostile"],
			situation: "Combat",
		};

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(7.5); // 5 categories + 5 tags * 0.5 = 5 + 2.5
		expect(match.matchedCategories).toEqual(["terrain", "weather", "timeOfDay", "faction", "situation"]);
		expect(match.matchedTagCount).toBe(5);
	});
});

describe("Auto-Selection - Selection", () => {
	it("selects best matching playlist", () => {
		const playlists = [
			createPlaylist("generic", "ambience"),
			createPlaylist("forest", "ambience", { terrain: ["Forest"] }),
			createPlaylist("forest-rain", "ambience", { terrain: ["Forest"], weather: ["Rain"] }),
		];
		const context: SessionContext = { terrain: "Forest", weather: "Rain" };

		const result = selectPlaylist(playlists, context);

		expect(result.selected?.playlistName).toBe("forest-rain");
		expect(result.selected?.score).toBe(3.0); // 2 categories + 2 tags * 0.5
		expect(result.alternatives).toHaveLength(2);
		expect(result.alternatives[0].playlistName).toBe("forest");
	});

	it("returns alternatives sorted by score", () => {
		const playlists = [
			createPlaylist("mountain", "ambience", { terrain: ["Mountain"] }),
			createPlaylist("forest", "ambience", { terrain: ["Forest"] }),
			createPlaylist("forest-rain", "ambience", { terrain: ["Forest"], weather: ["Rain"] }),
		];
		const context: SessionContext = { terrain: "Forest", weather: "Rain" };

		const result = selectPlaylist(playlists, context);

		expect(result.selected?.playlistName).toBe("forest-rain");
		expect(result.alternatives[0].playlistName).toBe("forest");
		expect(result.alternatives[0].score).toBe(1.5);
		expect(result.alternatives[1].playlistName).toBe("mountain");
		expect(result.alternatives[1].score).toBe(0);
	});

	it("returns null for selected if no matches", () => {
		const playlists = [
			createPlaylist("mountain", "ambience", { terrain: ["Mountain"] }),
			createPlaylist("desert", "ambience", { terrain: ["Desert"] }),
		];
		const context: SessionContext = { terrain: "Forest" };

		const result = selectPlaylist(playlists, context);

		expect(result.selected).toBeNull();
		expect(result.alternatives).toHaveLength(2);
	});

	it("handles empty playlist array", () => {
		const playlists: PlaylistData[] = [];
		const context: SessionContext = { terrain: "Forest" };

		const result = selectPlaylist(playlists, context);

		expect(result.selected).toBeNull();
		expect(result.alternatives).toEqual([]);
	});

	it("includes context in result", () => {
		const playlists = [createPlaylist("forest", "ambience", { terrain: ["Forest"] })];
		const context: SessionContext = { terrain: "Forest", weather: "Rain" };

		const result = selectPlaylist(playlists, context);

		expect(result.context).toEqual(context);
	});
});

describe("Auto-Selection - Type Filtering", () => {
	it("filters ambience playlists", () => {
		const playlists = [
			createPlaylist("forest-ambience", "ambience"),
			createPlaylist("combat-music", "music"),
			createPlaylist("rain-ambience", "ambience"),
		];

		const filtered = filterPlaylistsByType(playlists, "ambience");

		expect(filtered).toHaveLength(2);
		expect(filtered[0].name).toBe("forest-ambience");
		expect(filtered[1].name).toBe("rain-ambience");
	});

	it("filters music playlists", () => {
		const playlists = [
			createPlaylist("forest-ambience", "ambience"),
			createPlaylist("combat-music", "music"),
			createPlaylist("victory-music", "music"),
		];

		const filtered = filterPlaylistsByType(playlists, "music");

		expect(filtered).toHaveLength(2);
		expect(filtered[0].name).toBe("combat-music");
		expect(filtered[1].name).toBe("victory-music");
	});

	it("returns empty array when no playlists match type", () => {
		const playlists = [createPlaylist("forest-ambience", "ambience")];

		const filtered = filterPlaylistsByType(playlists, "music");

		expect(filtered).toEqual([]);
	});
});

describe("Auto-Selection - Helper Functions", () => {
	it("extracts all active tags from context", () => {
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Rain",
			timeOfDay: "Night",
			factions: ["Hostile", "Undead"],
			situation: "Combat",
		};

		const tags = getActiveTags(context);

		expect(tags).toEqual(["Forest", "Rain", "Night", "Hostile", "Undead", "Combat"]);
	});

	it("handles partial context", () => {
		const context: SessionContext = {
			terrain: "Forest",
			situation: "Exploration",
		};

		const tags = getActiveTags(context);

		expect(tags).toEqual(["Forest", "Exploration"]);
	});

	it("handles empty context", () => {
		const context: SessionContext = {};

		const tags = getActiveTags(context);

		expect(tags).toEqual([]);
	});
});

describe("Auto-Selection - Edge Cases", () => {
	it("handles playlists with multiple tags in same category", () => {
		const playlist = createPlaylist("multi-terrain", "ambience", {
			terrain: ["Forest", "Jungle", "Swamp"],
		});
		const context: SessionContext = { terrain: "Forest" };

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(1.5); // 1 category + 1 tag match
		expect(match.matchedCategories).toEqual(["terrain"]);
	});

	it("prefers playlists with more specific matches", () => {
		const playlists = [
			createPlaylist("generic-combat", "music", { situation: ["Combat"] }),
			createPlaylist("forest-combat", "music", { terrain: ["Forest"], situation: ["Combat"] }),
			createPlaylist("forest-rain-combat", "music", {
				terrain: ["Forest"],
				weather: ["Rain"],
				situation: ["Combat"],
			}),
		];
		const context: SessionContext = {
			terrain: "Forest",
			weather: "Rain",
			situation: "Combat",
		};

		const result = selectPlaylist(playlists, context);

		expect(result.selected?.playlistName).toBe("forest-rain-combat");
		expect(result.selected?.score).toBe(4.5);
	});

	it("handles case-sensitive tag matching", () => {
		// Tags should match exactly (case-sensitive)
		const playlist = createPlaylist("forest", "ambience", { terrain: ["Forest"] });
		const context: SessionContext = { terrain: "Forest" }; // Exact match

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(1.5);
	});

	it("treats undefined tags as no tags", () => {
		const playlist = createPlaylist("test", "ambience", {
			terrain: undefined,
			weather: undefined,
		});
		const context: SessionContext = { terrain: "Forest" };

		const match = calculatePlaylistScore(playlist, context);

		expect(match.score).toBe(0);
		expect(match.matchedCategories).toEqual([]);
	});
});
