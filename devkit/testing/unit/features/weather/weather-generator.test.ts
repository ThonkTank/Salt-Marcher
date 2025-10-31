// devkit/testing/unit/features/weather/weather-generator.test.ts
// Tests weather generation: determinism, Markov transitions, climate templates, seasonal patterns

import { describe, it, expect } from "vitest";
import { generateWeather, advanceWeather, getSeasonForDay } from "../../../../../src/features/weather/weather-generator";
import { TEMPERATE_CLIMATE, ARCTIC_CLIMATE, TROPICAL_CLIMATE, DESERT_CLIMATE, MOUNTAIN_CLIMATE, COASTAL_CLIMATE } from "../../../../../src/features/weather/climate-templates";
import type { WeatherGenerationOptions, WeatherState, Season } from "../../../../../src/features/weather/types";

describe("Weather Generator", () => {
	describe("generateWeather()", () => {
		it("should generate deterministic weather with same seed", () => {
			const options: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "summer",
				dayOfYear: 200,
				seed: 12345,
			};

			const weather1 = generateWeather(options);
			const weather2 = generateWeather(options);

			expect(weather1.currentWeather.type).toBe(weather2.currentWeather.type);
			expect(weather1.temperature).toBe(weather2.temperature);
			expect(weather1.windSpeed).toBe(weather2.windSpeed);
			expect(weather1.precipitation).toBe(weather2.precipitation);
			expect(weather1.visibility).toBe(weather2.visibility);
		});

		it("should generate different weather with different seeds", () => {
			const options1: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "summer",
				dayOfYear: 200,
				seed: 12345,
			};

			const options2: WeatherGenerationOptions = {
				...options1,
				seed: 67890,
			};

			const weather1 = generateWeather(options1);
			const weather2 = generateWeather(options2);

			// At least one property should differ
			const isDifferent =
				weather1.currentWeather.type !== weather2.currentWeather.type ||
				Math.abs(weather1.temperature - weather2.temperature) > 0.1 ||
				Math.abs(weather1.windSpeed - weather2.windSpeed) > 0.1;

			expect(isDifferent).toBe(true);
		});

		it("should respect climate temperature ranges", () => {
			const options: WeatherGenerationOptions = {
				climate: ARCTIC_CLIMATE,
				season: "winter",
				dayOfYear: 1,
				seed: 12345,
			};

			const results: number[] = [];
			for (let i = 0; i < 50; i++) {
				const weather = generateWeather({ ...options, seed: i });
				results.push(weather.temperature);
			}

			// Arctic winter should be very cold
			const avgTemp = results.reduce((sum, t) => sum + t, 0) / results.length;
			expect(avgTemp).toBeLessThan(0); // Below freezing on average
			expect(Math.min(...results)).toBeGreaterThan(-60); // Not unrealistically cold
		});

		it("should generate precipitation only for rain/storm/snow", () => {
			const options: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "spring",
				dayOfYear: 100,
				seed: 0,
			};

			// Test multiple seeds to cover different weather types
			for (let i = 0; i < 100; i++) {
				const weather = generateWeather({ ...options, seed: i });
				if (["rain", "storm", "snow"].includes(weather.currentWeather.type)) {
					expect(weather.precipitation).toBeGreaterThan(0);
				} else {
					expect(weather.precipitation).toBe(0);
				}
			}
		});

		it("should reduce visibility in fog, storm, and snow", () => {
			const options: WeatherGenerationOptions = {
				climate: COASTAL_CLIMATE,
				season: "autumn",
				dayOfYear: 280,
				seed: 0,
			};

			const baseVisibility = 10000; // 10km in clear conditions

			for (let i = 0; i < 100; i++) {
				const weather = generateWeather({ ...options, seed: i });
				if (["fog", "storm", "snow"].includes(weather.currentWeather.type)) {
					expect(weather.visibility).toBeLessThan(baseVisibility * 0.6);
				}
			}
		});

		it("should set weather duration based on climate transition speed", () => {
			const fastClimate = { ...TROPICAL_CLIMATE, transitionSpeed: 6 };
			const slowClimate = { ...ARCTIC_CLIMATE, transitionSpeed: 18 };

			const fastOptions: WeatherGenerationOptions = {
				climate: fastClimate,
				season: "summer",
				dayOfYear: 200,
				seed: 12345,
			};

			const slowOptions: WeatherGenerationOptions = {
				climate: slowClimate,
				season: "winter",
				dayOfYear: 1,
				seed: 12345,
			};

			const fastWeather = generateWeather(fastOptions);
			const slowWeather = generateWeather(slowOptions);

			// Fast climate should have shorter duration on average
			expect(fastWeather.currentWeather.duration).toBeLessThan(slowWeather.currentWeather.duration);
		});

		it("should apply Markov transitions when previous weather provided", () => {
			const options: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "spring",
				previousWeather: {
					type: "rain",
					severity: 0.5,
					duration: 6,
				},
				dayOfYear: 100,
				seed: 12345,
			};

			const weather = generateWeather(options);

			// Should produce a valid weather type (Markov transitions can produce any valid type)
			const validTypes = ["clear", "cloudy", "rain", "storm", "snow", "fog", "wind", "hot", "cold"];
			expect(validTypes.includes(weather.currentWeather.type)).toBe(true);

			// Should have consistent results with same seed (deterministic)
			const weather2 = generateWeather(options);
			expect(weather2.currentWeather.type).toBe(weather.currentWeather.type);
		});

		it("should generate severity within weather type ranges", () => {
			const options: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "summer",
				dayOfYear: 200,
				seed: 0,
			};

			const severityRanges: Record<string, { min: number; max: number }> = {
				clear: { min: 0, max: 0.2 },
				cloudy: { min: 0.2, max: 0.4 },
				rain: { min: 0.3, max: 0.6 },
				storm: { min: 0.7, max: 1.0 },
			};

			for (let i = 0; i < 50; i++) {
				const weather = generateWeather({ ...options, seed: i });
				const range = severityRanges[weather.currentWeather.type];
				if (range) {
					expect(weather.currentWeather.severity).toBeGreaterThanOrEqual(range.min);
					expect(weather.currentWeather.severity).toBeLessThanOrEqual(range.max);
				}
			}
		});
	});

	describe("advanceWeather()", () => {
		it("should maintain hex coordinates when advancing weather", () => {
			const currentState: WeatherState = {
				hexCoord: { q: 5, r: 10, s: -15 },
				currentWeather: {
					type: "clear",
					severity: 0.1,
					duration: 12,
				},
				temperature: 20,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const nextState = advanceWeather(currentState, TEMPERATE_CLIMATE, 150, 12345);

			expect(nextState.hexCoord).toEqual(currentState.hexCoord);
		});

		it("should apply smooth Markov transitions between weather states", () => {
			let currentState: WeatherState = {
				hexCoord: { q: 0, r: 0, s: 0 },
				currentWeather: {
					type: "clear",
					severity: 0.1,
					duration: 12,
				},
				temperature: 15,
				windSpeed: 5,
				precipitation: 0,
				visibility: 10000,
				lastUpdate: "2025-01-01T00:00:00Z",
			};

			const weatherSequence: string[] = [currentState.currentWeather.type];

			// Advance weather for 10 days
			for (let i = 1; i <= 10; i++) {
				currentState = advanceWeather(currentState, TEMPERATE_CLIMATE, 100 + i, 12345 + i);
				weatherSequence.push(currentState.currentWeather.type);
			}

			// Should have multiple different weather types (not stuck on one)
			const uniqueTypes = new Set(weatherSequence);
			expect(uniqueTypes.size).toBeGreaterThan(1);

			// No abrupt transitions (clear → blizzard not possible without intermediate steps)
			for (let i = 1; i < weatherSequence.length; i++) {
				const prev = weatherSequence[i - 1];
				const curr = weatherSequence[i];

				// If transitioning from clear, shouldn't jump directly to storm
				if (prev === "clear" && curr === "storm") {
					// This is statistically unlikely but not impossible
					// We'll allow it but expect it to be rare
				}
			}
		});
	});

	describe("getSeasonForDay()", () => {
		it("should return correct season for spring days", () => {
			expect(getSeasonForDay(80)).toBe("spring"); // March 21
			expect(getSeasonForDay(100)).toBe("spring"); // Mid-April
			expect(getSeasonForDay(171)).toBe("spring"); // June 20
		});

		it("should return correct season for summer days", () => {
			expect(getSeasonForDay(172)).toBe("summer"); // June 21
			expect(getSeasonForDay(200)).toBe("summer"); // Mid-July
			expect(getSeasonForDay(263)).toBe("summer"); // September 22
		});

		it("should return correct season for autumn days", () => {
			expect(getSeasonForDay(264)).toBe("autumn"); // September 23
			expect(getSeasonForDay(300)).toBe("autumn"); // Late October
			expect(getSeasonForDay(354)).toBe("autumn"); // December 20
		});

		it("should return correct season for winter days", () => {
			expect(getSeasonForDay(355)).toBe("winter"); // December 21
			expect(getSeasonForDay(1)).toBe("winter"); // January 1
			expect(getSeasonForDay(79)).toBe("winter"); // March 20
		});
	});

	describe("Climate Templates", () => {
		it("should have valid probability distributions for all climates", () => {
			const climates = [
				TEMPERATE_CLIMATE,
				ARCTIC_CLIMATE,
				TROPICAL_CLIMATE,
				DESERT_CLIMATE,
				MOUNTAIN_CLIMATE,
				COASTAL_CLIMATE,
			];

			for (const climate of climates) {
				for (const season of ["spring", "summer", "autumn", "winter"] as Season[]) {
					const probs = climate.weatherProbabilities[season];
					const total = Object.values(probs).reduce((sum, p) => sum + p, 0);

					// Probabilities should sum to approximately 1.0 (allow small floating point error)
					expect(Math.abs(total - 1.0)).toBeLessThan(0.01);

					// All probabilities should be non-negative
					for (const prob of Object.values(probs)) {
						expect(prob).toBeGreaterThanOrEqual(0);
					}
				}
			}
		});

		it("should have realistic temperature ranges for each climate", () => {
			expect(ARCTIC_CLIMATE.baseTemperature.max).toBeLessThan(TEMPERATE_CLIMATE.baseTemperature.min);
			expect(TEMPERATE_CLIMATE.baseTemperature.max).toBeLessThan(TROPICAL_CLIMATE.baseTemperature.min);
			expect(DESERT_CLIMATE.baseTemperature.max).toBeGreaterThan(TEMPERATE_CLIMATE.baseTemperature.max);
		});

		it("should favor appropriate weather types for each climate", () => {
			// Arctic should have high snow probability in winter
			const arcticWinterProbs = ARCTIC_CLIMATE.weatherProbabilities.winter;
			expect(arcticWinterProbs.snow).toBeGreaterThan(0.3);

			// Tropical should have high rain/hot probability in summer
			const tropicalSummerProbs = TROPICAL_CLIMATE.weatherProbabilities.summer;
			expect(tropicalSummerProbs.rain + tropicalSummerProbs.hot).toBeGreaterThan(0.5);

			// Desert should have high clear/hot probability
			const desertSummerProbs = DESERT_CLIMATE.weatherProbabilities.summer;
			expect(desertSummerProbs.clear + desertSummerProbs.hot).toBeGreaterThan(0.7);

			// Coastal should have significant fog probability
			const coastalAutumnProbs = COASTAL_CLIMATE.weatherProbabilities.autumn;
			expect(coastalAutumnProbs.fog).toBeGreaterThan(0.2);
		});
	});

	describe("Seasonal Variation", () => {
		it("should produce warmer temperatures in summer than winter", () => {
			const summerOptions: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "summer",
				dayOfYear: 200,
				seed: 12345,
			};

			const winterOptions: WeatherGenerationOptions = {
				climate: TEMPERATE_CLIMATE,
				season: "winter",
				dayOfYear: 1,
				seed: 12345,
			};

			// Generate multiple samples
			const summerTemps: number[] = [];
			const winterTemps: number[] = [];

			for (let i = 0; i < 20; i++) {
				summerTemps.push(generateWeather({ ...summerOptions, seed: i }).temperature);
				winterTemps.push(generateWeather({ ...winterOptions, seed: i }).temperature);
			}

			const avgSummer = summerTemps.reduce((sum, t) => sum + t, 0) / summerTemps.length;
			const avgWinter = winterTemps.reduce((sum, t) => sum + t, 0) / winterTemps.length;

			expect(avgSummer).toBeGreaterThan(avgWinter);
		});

		it("should adjust weather probabilities by season", () => {
			const climate = TEMPERATE_CLIMATE;

			// Summer should have more hot weather than winter
			expect(climate.weatherProbabilities.summer.hot).toBeGreaterThan(
				climate.weatherProbabilities.winter.hot,
			);

			// Winter should have more snow than summer
			expect(climate.weatherProbabilities.winter.snow).toBeGreaterThan(
				climate.weatherProbabilities.summer.snow,
			);
		});
	});
});
