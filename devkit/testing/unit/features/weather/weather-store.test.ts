// devkit/testing/unit/features/weather/weather-store.test.ts
// Tests weather store: set/get weather, batch updates, pruning, active map filtering

import { describe, it, expect, beforeEach } from "vitest";
import { weatherStore } from "../../../../../src/features/weather/weather-store";
import type { WeatherState } from "../../../../../src/features/weather/types";
import { get } from "svelte/store";

describe("Weather Store", () => {
	beforeEach(() => {
		// Clear store before each test
		weatherStore.clearAll();
	});

	describe("setWeather() and getWeather()", () => {
		it("should store and retrieve weather for a hex", () => {
			const weather: WeatherState = {
				hexCoord: { q: 5, r: 10, s: -15 },
				currentWeather: {
					type: "rain",
					severity: 0.5,
					duration: 6,
				},
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 5000,
				lastUpdate: "2025-01-01T12:00:00Z",
			};

			weatherStore.setWeather("map1", weather);
			const retrieved = weatherStore.getWeather("map1", 5, 10, -15);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.currentWeather.type).toBe("rain");
			expect(retrieved?.temperature).toBe(15);
			expect(retrieved?.windSpeed).toBe(20);
		});

		it("should return null for non-existent hex", () => {
			const retrieved = weatherStore.getWeather("map1", 99, 99, -198);
			expect(retrieved).toBeNull();
		});

		it("should isolate weather by map path", () => {
			const weather1: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const weather2: WeatherState = {
				...weather1,
				temperature: 10, // Different temp
			};

			weatherStore.setWeather("map1", weather1);
			weatherStore.setWeather("map2", weather2);

			const retrieved1 = weatherStore.getWeather("map1", 0, 0, 0);
			const retrieved2 = weatherStore.getWeather("map2", 0, 0, 0);

			expect(retrieved1?.temperature).toBe(20);
			expect(retrieved2?.temperature).toBe(10);
		});

		it("should update existing weather when set again", () => {
			const initial: WeatherState = {
				hexCoord: { q: 1, r: 2, s: -3 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const updated: WeatherState = {
				...initial,
				currentWeather: { type: "rain", severity: 0.5, duration: 6 },
				temperature: 15,
			};

			weatherStore.setWeather("map1", initial);
			weatherStore.setWeather("map1", updated);

			const retrieved = weatherStore.getWeather("map1", 1, 2, -3);
			expect(retrieved?.currentWeather.type).toBe("rain");
			expect(retrieved?.temperature).toBe(15);
		});
	});

	describe("setWeatherBatch()", () => {
		it("should set multiple weather states at once", () => {
			const weathers: WeatherState[] = [
				{
					hexCoord: { q: 0, r: 0, s: 0 },
					currentWeather: { type: "clear", severity: 0.1, duration: 12 },
					temperature: 20,
					windSpeed: 5,
					precipitation: 0,
					visibility: 10000,
					lastUpdate: "2025-01-01T00:00:00Z",
				},
				{
					hexCoord: { q: 1, r: 0, s: -1 },
					currentWeather: { type: "cloudy", severity: 0.3, duration: 8 },
					temperature: 18,
					windSpeed: 10,
					precipitation: 0,
					visibility: 8000,
					lastUpdate: "2025-01-01T00:00:00Z",
				},
				{
					hexCoord: { q: 0, r: 1, s: -1 },
					currentWeather: { type: "rain", severity: 0.5, duration: 6 },
					temperature: 15,
					windSpeed: 20,
					precipitation: 5,
					visibility: 5000,
					lastUpdate: "2025-01-01T00:00:00Z",
				},
			];

			weatherStore.setWeatherBatch("map1", weathers);

			expect(weatherStore.getWeather("map1", 0, 0, 0)?.currentWeather.type).toBe("clear");
			expect(weatherStore.getWeather("map1", 1, 0, -1)?.currentWeather.type).toBe("cloudy");
			expect(weatherStore.getWeather("map1", 0, 1, -1)?.currentWeather.type).toBe("rain");
		});

		it("should handle empty batch", () => {
			weatherStore.setWeatherBatch("map1", []);
			const retrieved = weatherStore.getWeather("map1", 0, 0, 0);
			expect(retrieved).toBeNull();
		});
	});

	describe("clearMap()", () => {
		it("should clear all weather for a specific map", () => {
			const weather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather);
			weatherStore.setWeather("map2", { ...weather, hexCoord: { q: 1, r: 1, s: -2 } });

			weatherStore.clearMap("map1");

			expect(weatherStore.getWeather("map1", 0, 0, 0)).toBeNull();
			expect(weatherStore.getWeather("map2", 1, 1, -2)).not.toBeNull();
		});

		it("should not error when clearing empty map", () => {
			expect(() => weatherStore.clearMap("nonexistent")).not.toThrow();
		});
	});

	describe("clearAll()", () => {
		it("should clear all weather data", () => {
			const weather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather);
			weatherStore.setWeather("map2", { ...weather, hexCoord: { q: 1, r: 1, s: -2 } });

			weatherStore.clearAll();

			expect(weatherStore.getWeather("map1", 0, 0, 0)).toBeNull();
			expect(weatherStore.getWeather("map2", 1, 1, -2)).toBeNull();
		});
	});

	describe("setActiveMap() and getActiveMapWeather()", () => {
		it("should return weather only for active map", () => {
			const weather1: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const weather2: WeatherState = {
				hexCoord: { q: 1, r: 1, s: -2 },
				currentWeather: { type: "rain", severity: 0.5, duration: 6 },
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 5000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather1);
			weatherStore.setWeather("map2", weather2);
			weatherStore.setActiveMap("map1");

			const activeWeather = get(weatherStore.getActiveMapWeather());

			expect(activeWeather).toHaveLength(1);
			expect(activeWeather[0].hexCoord).toEqual({ q: 0, r: 0, s: 0 });
		});

		it("should return empty array when no active map", () => {
			const weather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather);
			weatherStore.setActiveMap(null);

			const activeWeather = get(weatherStore.getActiveMapWeather());
			expect(activeWeather).toHaveLength(0);
		});

		it("should update reactive store when active map changes", () => {
			const weather1: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const weather2: WeatherState = {
				hexCoord: { q: 1, r: 1, s: -2 },
				currentWeather: { type: "rain", severity: 0.5, duration: 6 },
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 5000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather1);
			weatherStore.setWeather("map2", weather2);

			weatherStore.setActiveMap("map1");
			let activeWeather = get(weatherStore.getActiveMapWeather());
			expect(activeWeather).toHaveLength(1);
			expect(activeWeather[0].temperature).toBe(20);

			weatherStore.setActiveMap("map2");
			activeWeather = get(weatherStore.getActiveMapWeather());
			expect(activeWeather).toHaveLength(1);
			expect(activeWeather[0].temperature).toBe(15);
		});
	});

	describe("getHexWeather()", () => {
		it("should return reactive store for specific hex", () => {
			const weather: WeatherState = {
				hexCoord: { q: 5, r: 10, s: -15 },
				currentWeather: { type: "storm", severity: 0.8, duration: 4 },
				temperature: 12,
				windSpeed: 50,
				precipitation: 15,
				visibility: 3000,
				lastUpdate: "2025-01-01T15:00:00Z",
			};

			const hexStore = weatherStore.getHexWeather("map1", 5, 10, -15);
			let hexWeather = get(hexStore);
			expect(hexWeather).toBeNull();

			weatherStore.setWeather("map1", weather);
			hexWeather = get(hexStore);
			expect(hexWeather?.currentWeather.type).toBe("storm");
		});
	});

	describe("pruneOldWeather()", () => {
		it("should remove weather older than cutoff age", () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

			const oldWeather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: oldDate.toISOString(),
			};

			const recentWeather: WeatherState = {
				hexCoord: { q: 1, r: 1, s: -2 },
				currentWeather: { type: "rain", severity: 0.5, duration: 6 },
				temperature: 15,
				windSpeed: 20,
				precipitation: 5,
				visibility: 5000,
				lastUpdate: recentDate.toISOString(),
			};

			weatherStore.setWeather("map1", oldWeather);
			weatherStore.setWeather("map1", recentWeather);

			weatherStore.pruneOldWeather(30); // Remove weather older than 30 days

			expect(weatherStore.getWeather("map1", 0, 0, 0)).toBeNull();
			expect(weatherStore.getWeather("map1", 1, 1, -2)).not.toBeNull();
		});

		it("should keep all weather when none older than cutoff", () => {
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

			const weather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: recentDate.toISOString(),
			};

			weatherStore.setWeather("map1", weather);
			weatherStore.pruneOldWeather(30);

			expect(weatherStore.getWeather("map1", 0, 0, 0)).not.toBeNull();
		});
	});

	describe("subscribe()", () => {
		it("should notify subscribers of changes", () => {
			let notificationCount = 0;
			const unsubscribe = weatherStore.subscribe(() => {
				notificationCount++;
			});

			const weather: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: { type: "clear", severity: 0.1, duration: 12 },
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			weatherStore.setWeather("map1", weather);

			// Should have been notified (initial + 1 update)
			expect(notificationCount).toBeGreaterThanOrEqual(2);

			unsubscribe();
		});
	});
});
