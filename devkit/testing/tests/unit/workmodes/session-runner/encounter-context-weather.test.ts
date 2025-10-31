// devkit/testing/tests/unit/workmodes/session-runner/encounter-context-weather.test.ts
// Tests weather extraction from weather store in encounter context building

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildEncounterContext } from "../../../../../../src/workmodes/session-runner/util/encounter-context-builder";
import { weatherStore } from "../../../../../../src/features/weather/weather-store";
import type { WeatherState } from "../../../../../../src/features/weather/types";
import type { LogicStateSnapshot } from "../../../../../../src/workmodes/session-runner/travel/domain/types";
import type { App, TFile } from "obsidian";

// Mock plugin-logger
vi.mock("../../../../../../src/app/plugin-logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock Obsidian dependencies
const mockApp = {} as App;
const mockMapFile: TFile = {
	path: "Maps/TestMap.md",
	name: "TestMap.md",
	basename: "TestMap",
} as TFile;

describe("Encounter Context Builder - Weather Integration", () => {
	beforeEach(() => {
		// Clear weather store before each test
		weatherStore.clearAll();
	});

	describe("Weather Extraction", () => {
		it("should extract weather from weather store when available", async () => {
			// Set up weather data
			const weatherState: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: {
					type: "rain",
					severity: 0.5,
					duration: 4,
				},
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 1000,
				lastUpdate: "2024-03-15T12:00:00Z",
			};
			weatherStore.setWeather(mockMapFile.path, weatherState);

			// Build context for the same hex (odd-r coords: 0,0 → cube coords: 0,0,0)
			const state: LogicStateSnapshot = {
				currentTile: { r: 0, c: 0 },
				tokenRC: { r: 0, c: 0 },
			} as LogicStateSnapshot;

			const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

			// Weather tags should contain "rain"
			expect(context.tags.weather).toContain("rain");
		});

		it("should extract multiple weather tags for storm", async () => {
			// Set up storm weather
			const weatherState: WeatherState = {
				hexCoord: { q: 1, r: 1, s: -2 },
				currentWeather: {
					type: "storm",
					severity: 0.8,
					duration: 2,
				},
				temperature: 12,
				windSpeed: 50,
				precipitation: 15,
				visibility: 500,
				lastUpdate: "2024-03-15T12:00:00Z",
			};
			weatherStore.setWeather(mockMapFile.path, weatherState);

			// Build context for hex with odd-r coords that map to cube (1,1,-2)
			// cube to odd-r: col = q + (r - (r&1)) / 2 = 1 + (1 - 1) / 2 = 1
			// row = r = 1
			const state: LogicStateSnapshot = {
				currentTile: { r: 1, c: 1 },
				tokenRC: { r: 1, c: 1 },
			} as LogicStateSnapshot;

			const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

			// Storm should generate storm, rain, and wind tags
			expect(context.tags.weather).toContain("storm");
			expect(context.tags.weather).toContain("rain");
			expect(context.tags.weather).toContain("wind");
		});

		it("should use clear weather as fallback when no weather data exists", async () => {
			// No weather data set up

			const state: LogicStateSnapshot = {
				currentTile: { r: 0, c: 0 },
				tokenRC: { r: 0, c: 0 },
			} as LogicStateSnapshot;

			const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

			// Should default to "clear"
			expect(context.tags.weather).toEqual(["clear"]);
		});

		it("should use clear weather as fallback when hex coords unavailable", async () => {
			// Set up weather but provide no hex coords in state
			const weatherState: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: {
					type: "snow",
					severity: 0.6,
					duration: 6,
				},
				temperature: -5,
				windSpeed: 15,
				precipitation: 3,
				visibility: 800,
				lastUpdate: "2024-03-15T12:00:00Z",
			};
			weatherStore.setWeather(mockMapFile.path, weatherState);

			const state: LogicStateSnapshot = {
				currentTile: null,
				tokenRC: null,
			} as LogicStateSnapshot;

			const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

			// Should default to "clear" since coords unavailable
			expect(context.tags.weather).toEqual(["clear"]);
		});

		it("should convert odd-r coordinates to cube coordinates correctly", async () => {
			// Test coordinate conversion for various hexes
			// Formula: q = col - Math.floor((row - (row & 1)) / 2), r = row, s = -q - r
			const testCases = [
				// { oddR: {r, c}, cube: {q, r, s} }
				{ oddR: { r: 0, c: 0 }, cube: { q: 0, r: 0, s: 0 } },
				{ oddR: { r: 1, c: 0 }, cube: { q: 0, r: 1, s: -1 } },
				{ oddR: { r: 0, c: 1 }, cube: { q: 1, r: 0, s: -1 } },
				{ oddR: { r: 2, c: 2 }, cube: { q: 1, r: 2, s: -3 } }, // Fixed: q = 2 - floor((2-0)/2) = 1
			];

			for (const testCase of testCases) {
				// Set up weather for cube coords
				const weatherState: WeatherState = {
					hexCoord: testCase.cube,
					currentWeather: {
						type: "fog",
						severity: 0.4,
						duration: 3,
					},
					temperature: 10,
					windSpeed: 5,
					precipitation: 0,
					visibility: 200,
					lastUpdate: "2024-03-15T12:00:00Z",
				};
				weatherStore.setWeather(mockMapFile.path, weatherState);

				// Build context with odd-r coords
				const state: LogicStateSnapshot = {
					currentTile: testCase.oddR,
					tokenRC: testCase.oddR,
				} as LogicStateSnapshot;

				const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

				// Should extract weather successfully
				expect(context.tags.weather,
					`Failed for odd-r ${JSON.stringify(testCase.oddR)} → cube ${JSON.stringify(testCase.cube)}`
				).toContain("fog");

				// Clear for next test
				weatherStore.clearAll();
			}
		});

		it("should handle different weather types correctly", async () => {
			const weatherTypes: Array<{ type: "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "wind" | "hot" | "cold"; expectedTags: string[] }> = [
				{ type: "clear", expectedTags: ["clear"] },
				{ type: "cloudy", expectedTags: ["cloudy"] },
				{ type: "rain", expectedTags: ["rain"] },
				{ type: "snow", expectedTags: ["snow"] },
				{ type: "fog", expectedTags: ["fog"] },
				{ type: "wind", expectedTags: ["wind"] },
				{ type: "hot", expectedTags: ["hot"] },
				{ type: "cold", expectedTags: ["cold"] },
			];

			for (const { type, expectedTags } of weatherTypes) {
				const weatherState: WeatherState = {
					hexCoord: { q: 0, r: 0, s: 0 },
					currentWeather: {
						type,
						severity: 0.5,
						duration: 4,
					},
					temperature: 15,
					windSpeed: 10,
					precipitation: 0,
					visibility: 5000,
					lastUpdate: "2024-03-15T12:00:00Z",
				};
				weatherStore.setWeather(mockMapFile.path, weatherState);

				const state: LogicStateSnapshot = {
					currentTile: { r: 0, c: 0 },
					tokenRC: { r: 0, c: 0 },
				} as LogicStateSnapshot;

				const context = await buildEncounterContext(mockApp, mockMapFile, state, 5, 4);

				for (const expectedTag of expectedTags) {
					expect(context.tags.weather).toContain(expectedTag);
				}

				weatherStore.clearAll();
			}
		});
	});

	describe("Weather Store Isolation", () => {
		it("should not leak weather between different map files", async () => {
			// Set up weather on different maps
			const map1: TFile = { path: "Maps/Map1.md" } as TFile;
			const map2: TFile = { path: "Maps/Map2.md" } as TFile;

			const weatherState1: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "rain", severity: 0.5, duration: 4 },
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 1000,
				lastUpdate: "2024-03-15T12:00:00Z",
			};

			const weatherState2: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "snow", severity: 0.7, duration: 6 },
				temperature: -5,
				windSpeed: 15,
				precipitation: 3,
				visibility: 800,
				lastUpdate: "2024-03-15T12:00:00Z",
			};

			weatherStore.setWeather(map1.path, weatherState1);
			weatherStore.setWeather(map2.path, weatherState2);

			// Query map1
			const state: LogicStateSnapshot = {
				currentTile: { r: 0, c: 0 },
				tokenRC: { r: 0, c: 0 },
			} as LogicStateSnapshot;

			const context1 = await buildEncounterContext(mockApp, map1, state, 5, 4);
			expect(context1.tags.weather).toContain("rain");
			expect(context1.tags.weather).not.toContain("snow");

			// Query map2
			const context2 = await buildEncounterContext(mockApp, map2, state, 5, 4);
			expect(context2.tags.weather).toContain("snow");
			expect(context2.tags.weather).not.toContain("rain");
		});
	});
});
