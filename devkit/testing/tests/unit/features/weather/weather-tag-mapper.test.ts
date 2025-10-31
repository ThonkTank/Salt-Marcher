// devkit/testing/tests/unit/features/weather/weather-tag-mapper.test.ts
// Tests weather type to tag mapping for encounter and audio integration

import { describe, it, expect } from "vitest";
import { mapWeatherTypeToTags, getPrimaryWeatherTag } from "../../../../../../src/features/weather/weather-tag-mapper";
import type { WeatherType } from "../../../../../../src/features/weather/types";

describe("Weather Tag Mapper", () => {
	describe("mapWeatherTypeToTags", () => {
		it("should map clear weather to clear tag", () => {
			const tags = mapWeatherTypeToTags("clear");
			expect(tags).toEqual(["clear"]);
		});

		it("should map cloudy weather to cloudy tag", () => {
			const tags = mapWeatherTypeToTags("cloudy");
			expect(tags).toEqual(["cloudy"]);
		});

		it("should map rain weather to rain tag", () => {
			const tags = mapWeatherTypeToTags("rain");
			expect(tags).toEqual(["rain"]);
		});

		it("should map storm to multiple tags (storm, rain, wind)", () => {
			const tags = mapWeatherTypeToTags("storm");
			expect(tags).toContain("storm");
			expect(tags).toContain("rain");
			expect(tags).toContain("wind");
			expect(tags.length).toBe(3);
		});

		it("should map snow weather to snow tag", () => {
			const tags = mapWeatherTypeToTags("snow");
			expect(tags).toEqual(["snow"]);
		});

		it("should map fog weather to fog tag", () => {
			const tags = mapWeatherTypeToTags("fog");
			expect(tags).toEqual(["fog"]);
		});

		it("should map wind weather to wind tag", () => {
			const tags = mapWeatherTypeToTags("wind");
			expect(tags).toEqual(["wind"]);
		});

		it("should map hot weather to hot tag", () => {
			const tags = mapWeatherTypeToTags("hot");
			expect(tags).toEqual(["hot"]);
		});

		it("should map cold weather to cold tag", () => {
			const tags = mapWeatherTypeToTags("cold");
			expect(tags).toEqual(["cold"]);
		});

		it("should handle all weather types from TAGS.md", () => {
			const weatherTypes: WeatherType[] = [
				"clear",
				"cloudy",
				"rain",
				"storm",
				"snow",
				"fog",
				"wind",
				"hot",
				"cold",
			];

			for (const weatherType of weatherTypes) {
				const tags = mapWeatherTypeToTags(weatherType);
				expect(tags.length).toBeGreaterThan(0);
				expect(typeof tags[0]).toBe("string");
			}
		});
	});

	describe("getPrimaryWeatherTag", () => {
		it("should return first tag for single-tag weather types", () => {
			expect(getPrimaryWeatherTag("clear")).toBe("clear");
			expect(getPrimaryWeatherTag("rain")).toBe("rain");
			expect(getPrimaryWeatherTag("snow")).toBe("snow");
		});

		it("should return primary tag for multi-tag weather types", () => {
			// Storm should return "storm" as primary (first tag)
			expect(getPrimaryWeatherTag("storm")).toBe("storm");
		});

		it("should return clear as fallback for unknown types", () => {
			// @ts-expect-error Testing fallback for invalid type
			const tag = getPrimaryWeatherTag("invalid" as WeatherType);
			expect(tag).toBe("clear");
		});
	});

	describe("Tag Vocabulary Compliance", () => {
		it("should only return tags from TAGS.md weather vocabulary", () => {
			const validWeatherTags = [
				"clear",
				"cloudy",
				"rain",
				"storm",
				"snow",
				"fog",
				"wind",
				"hot",
				"cold",
			];

			const weatherTypes: WeatherType[] = [
				"clear",
				"cloudy",
				"rain",
				"storm",
				"snow",
				"fog",
				"wind",
				"hot",
				"cold",
			];

			for (const weatherType of weatherTypes) {
				const tags = mapWeatherTypeToTags(weatherType);
				for (const tag of tags) {
					expect(validWeatherTags).toContain(tag);
				}
			}
		});

		it("should return lowercase tags for consistency", () => {
			const weatherTypes: WeatherType[] = [
				"clear",
				"cloudy",
				"rain",
				"storm",
				"snow",
				"fog",
				"wind",
				"hot",
				"cold",
			];

			for (const weatherType of weatherTypes) {
				const tags = mapWeatherTypeToTags(weatherType);
				for (const tag of tags) {
					expect(tag).toBe(tag.toLowerCase());
				}
			}
		});
	});
});
