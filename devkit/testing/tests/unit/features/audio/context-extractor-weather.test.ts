// devkit/testing/tests/unit/features/audio/context-extractor-weather.test.ts
// Tests weather extraction from weather store in audio context extraction

import { describe, it, expect, beforeEach } from "vitest";
import { extractSessionContext } from "../../../../../../src/features/audio/context-extractor";
import { weatherStore } from "../../../../../../src/features/weather/weather-store";
import type { WeatherState } from "../../../../../../src/features/weather/types";
import type { App, TFile } from "obsidian";

// Mock Obsidian dependencies
const mockApp = {
	vault: {
		read: async () => "---\nsmType: Tile\nterrain: Forest\n---\n",
	},
} as unknown as App;

const mockMapFile: TFile = {
	path: "Maps/TestMap.md",
	name: "TestMap.md",
	basename: "TestMap",
} as TFile;

describe("Audio Context Extractor - Weather Integration", () => {
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

			// Extract context for the same hex (odd-r coords: 0,0 → cube coords: 0,0,0)
			const context = await extractSessionContext(mockApp, mockMapFile, { r: 0, c: 0 });

			// Weather should be extracted
			expect(context.weather).toBe("rain");
		});

		it("should return primary weather tag for complex weather types", async () => {
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

			// Extract context for hex with odd-r coords that map to cube (1,1,-2)
			// cube to odd-r: col = q + (r - (r&1)) / 2 = 1 + (1 - 1) / 2 = 1, row = r = 1
			const context = await extractSessionContext(mockApp, mockMapFile, { r: 1, c: 1 });

			// Should return primary tag "storm"
			expect(context.weather).toBe("storm");
		});

		it("should return undefined when no weather data exists", async () => {
			// No weather data set up

			const context = await extractSessionContext(mockApp, mockMapFile, { r: 0, c: 0 });

			// Should be undefined (not "clear" - audio system handles missing weather)
			expect(context.weather).toBeUndefined();
		});

		it("should prefer additionalContext weather over weather store", async () => {
			// Set up weather in store
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

			// But provide explicit weather in additionalContext
			const context = await extractSessionContext(
				mockApp,
				mockMapFile,
				{ r: 0, c: 0 },
				{ weather: "snow" },
			);

			// Should use provided weather, not store weather
			expect(context.weather).toBe("snow");
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

				// Extract context with odd-r coords
				const context = await extractSessionContext(mockApp, mockMapFile, testCase.oddR);

				// Should extract weather successfully
				expect(context.weather).toBe("fog");

				// Clear for next test
				weatherStore.clearAll();
			}
		});

		it("should handle different weather types correctly", async () => {
			const weatherTypes: Array<{ type: "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "wind" | "hot" | "cold"; expectedTag: string }> = [
				{ type: "clear", expectedTag: "clear" },
				{ type: "cloudy", expectedTag: "cloudy" },
				{ type: "rain", expectedTag: "rain" },
				{ type: "storm", expectedTag: "storm" }, // Primary tag
				{ type: "snow", expectedTag: "snow" },
				{ type: "fog", expectedTag: "fog" },
				{ type: "wind", expectedTag: "wind" },
				{ type: "hot", expectedTag: "hot" },
				{ type: "cold", expectedTag: "cold" },
			];

			for (const { type, expectedTag } of weatherTypes) {
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

				const context = await extractSessionContext(mockApp, mockMapFile, { r: 0, c: 0 });

				expect(context.weather).toBe(expectedTag);

				weatherStore.clearAll();
			}
		});

		it("should gracefully handle weather store errors", async () => {
			// Create invalid weather state that might cause errors
			// (but shouldn't crash the extraction)

			// Should not throw and return undefined weather
			const context = await extractSessionContext(mockApp, mockMapFile, { r: 999, c: 999 });

			expect(context.weather).toBeUndefined();
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
			const context1 = await extractSessionContext(mockApp, map1, { r: 0, c: 0 });
			expect(context1.weather).toBe("rain");

			// Query map2
			const context2 = await extractSessionContext(mockApp, map2, { r: 0, c: 0 });
			expect(context2.weather).toBe("snow");
		});
	});

	describe("Integration with Other Context", () => {
		it("should extract weather alongside terrain and other context", async () => {
			// Set up weather
			const weatherState: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "fog", severity: 0.6, duration: 3 },
				temperature: 10,
				windSpeed: 5,
				precipitation: 0,
				visibility: 200,
				lastUpdate: "2024-03-15T12:00:00Z",
			};
			weatherStore.setWeather(mockMapFile.path, weatherState);

			const context = await extractSessionContext(
				mockApp,
				mockMapFile,
				{ r: 0, c: 0 },
				{
					timeOfDay: "night",
					situation: "stealth",
				},
			);

			// Should have all context
			expect(context.weather).toBe("fog");
			expect(context.timeOfDay).toBe("night");
			expect(context.situation).toBe("stealth");
		});
	});
});
