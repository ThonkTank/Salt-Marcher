// devkit/testing/unit/features/weather/weather-icons.test.ts
// Tests for weather icon mapping, labels, and formatting functions.

import { describe, it, expect } from "vitest";
import {
	getWeatherIcon,
	getWeatherLabel,
	getSeverityLabel,
	getWeatherSpeedModifier,
	formatTemperature,
	formatWindSpeed,
	formatPrecipitation,
	formatVisibility,
	WEATHER_ICONS,
	WEATHER_LABELS,
} from "../../../../../src/features/weather/weather-icons";
import type { WeatherType } from "../../../../../src/features/weather/types";

describe("Weather Icons - Icon Mapping", () => {
	it("maps all weather types to icons", () => {
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

		for (const type of weatherTypes) {
			const icon = getWeatherIcon(type);
			expect(icon).toBeDefined();
			expect(icon).toBeTypeOf("string");
			expect(icon.length).toBeGreaterThan(0);
		}
	});

	it("returns expected icon names", () => {
		expect(getWeatherIcon("clear")).toBe("sun");
		expect(getWeatherIcon("cloudy")).toBe("cloud");
		expect(getWeatherIcon("rain")).toBe("cloud-drizzle");
		expect(getWeatherIcon("storm")).toBe("cloud-lightning");
		expect(getWeatherIcon("snow")).toBe("cloud-snow");
		expect(getWeatherIcon("fog")).toBe("cloud-fog");
		expect(getWeatherIcon("wind")).toBe("wind");
		expect(getWeatherIcon("hot")).toBe("thermometer-sun");
		expect(getWeatherIcon("cold")).toBe("thermometer-snowflake");
	});
});

describe("Weather Icons - Labels", () => {
	it("maps all weather types to German labels", () => {
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

		for (const type of weatherTypes) {
			const label = getWeatherLabel(type);
			expect(label).toBeDefined();
			expect(label).toBeTypeOf("string");
			expect(label.length).toBeGreaterThan(0);
		}
	});

	it("returns German labels for weather types", () => {
		expect(getWeatherLabel("clear")).toBe("Klar");
		expect(getWeatherLabel("cloudy")).toBe("Bewölkt");
		expect(getWeatherLabel("rain")).toBe("Regen");
		expect(getWeatherLabel("storm")).toBe("Sturm");
		expect(getWeatherLabel("snow")).toBe("Schnee");
		expect(getWeatherLabel("fog")).toBe("Nebel");
		expect(getWeatherLabel("wind")).toBe("Windig");
		expect(getWeatherLabel("hot")).toBe("Heiß");
		expect(getWeatherLabel("cold")).toBe("Kalt");
	});
});

describe("Weather Icons - Severity Labels", () => {
	it("returns correct severity label for extreme severity (>= 0.8)", () => {
		expect(getSeverityLabel(0.8)).toBe("Extrem");
		expect(getSeverityLabel(0.9)).toBe("Extrem");
		expect(getSeverityLabel(1.0)).toBe("Extrem");
	});

	it("returns correct severity label for strong severity (0.6-0.8)", () => {
		expect(getSeverityLabel(0.6)).toBe("Stark");
		expect(getSeverityLabel(0.7)).toBe("Stark");
		expect(getSeverityLabel(0.79)).toBe("Stark");
	});

	it("returns correct severity label for moderate severity (0.4-0.6)", () => {
		expect(getSeverityLabel(0.4)).toBe("Mäßig");
		expect(getSeverityLabel(0.5)).toBe("Mäßig");
		expect(getSeverityLabel(0.59)).toBe("Mäßig");
	});

	it("returns correct severity label for light severity (0.2-0.4)", () => {
		expect(getSeverityLabel(0.2)).toBe("Leicht");
		expect(getSeverityLabel(0.3)).toBe("Leicht");
		expect(getSeverityLabel(0.39)).toBe("Leicht");
	});

	it("returns correct severity label for minimal severity (< 0.2)", () => {
		expect(getSeverityLabel(0.0)).toBe("Minimal");
		expect(getSeverityLabel(0.1)).toBe("Minimal");
		expect(getSeverityLabel(0.19)).toBe("Minimal");
	});
});

describe("Weather Icons - Speed Modifiers", () => {
	it("returns 1.0 (no penalty) for clear weather", () => {
		expect(getWeatherSpeedModifier("clear", 0)).toBe(1);
		expect(getWeatherSpeedModifier("clear", 0.5)).toBe(1);
		expect(getWeatherSpeedModifier("clear", 1.0)).toBe(1);
	});

	it("returns 1.0 (no penalty) for cloudy weather", () => {
		expect(getWeatherSpeedModifier("cloudy", 0)).toBe(1);
		expect(getWeatherSpeedModifier("cloudy", 0.5)).toBe(1);
		expect(getWeatherSpeedModifier("cloudy", 1.0)).toBe(1);
	});

	it("applies correct penalty for snow (-25% to -50%)", () => {
		expect(getWeatherSpeedModifier("snow", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("snow", 0.5)).toBe(0.75);
		expect(getWeatherSpeedModifier("snow", 1.0)).toBe(0.5);
	});

	it("applies correct penalty for storm (-20% to -40%)", () => {
		expect(getWeatherSpeedModifier("storm", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("storm", 0.5)).toBe(0.8);
		expect(getWeatherSpeedModifier("storm", 1.0)).toBe(0.6);
	});

	it("applies correct penalty for rain (-10% to -25%)", () => {
		expect(getWeatherSpeedModifier("rain", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("rain", 0.5)).toBeCloseTo(0.875);
		expect(getWeatherSpeedModifier("rain", 1.0)).toBe(0.75);
	});

	it("applies correct penalty for fog (-15% to -30%)", () => {
		expect(getWeatherSpeedModifier("fog", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("fog", 0.5)).toBe(0.85);
		expect(getWeatherSpeedModifier("fog", 1.0)).toBe(0.7);
	});

	it("applies correct penalty for wind (-5% to -20%)", () => {
		expect(getWeatherSpeedModifier("wind", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("wind", 0.5)).toBe(0.9);
		expect(getWeatherSpeedModifier("wind", 1.0)).toBe(0.8);
	});

	it("applies correct penalty for hot (-10% to -20%)", () => {
		expect(getWeatherSpeedModifier("hot", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("hot", 0.5)).toBe(0.9);
		expect(getWeatherSpeedModifier("hot", 1.0)).toBe(0.8);
	});

	it("applies correct penalty for cold (-15% to -25%)", () => {
		expect(getWeatherSpeedModifier("cold", 0)).toBe(1.0);
		expect(getWeatherSpeedModifier("cold", 0.5)).toBeCloseTo(0.875);
		expect(getWeatherSpeedModifier("cold", 1.0)).toBe(0.75);
	});
});

describe("Weather Icons - Formatting", () => {
	it("formats temperature correctly", () => {
		expect(formatTemperature(0)).toBe("0°C");
		expect(formatTemperature(15)).toBe("15°C");
		expect(formatTemperature(-10)).toBe("-10°C");
		expect(formatTemperature(25.7)).toBe("26°C");
		expect(formatTemperature(-5.3)).toBe("-5°C");
	});

	it("formats wind speed correctly", () => {
		expect(formatWindSpeed(0)).toBe("0 km/h");
		expect(formatWindSpeed(10)).toBe("10 km/h");
		expect(formatWindSpeed(25.7)).toBe("26 km/h");
		expect(formatWindSpeed(50)).toBe("50 km/h");
	});

	it("formats precipitation correctly", () => {
		expect(formatPrecipitation(0)).toBe("Kein Niederschlag");
		expect(formatPrecipitation(0.05)).toBe("Kein Niederschlag");
		expect(formatPrecipitation(0.1)).toBe("Leichter Niederschlag");
		expect(formatPrecipitation(2.4)).toBe("Leichter Niederschlag");
		expect(formatPrecipitation(2.5)).toBe("Mäßiger Niederschlag");
		expect(formatPrecipitation(9.9)).toBe("Mäßiger Niederschlag");
		expect(formatPrecipitation(10)).toBe("Starker Niederschlag");
		expect(formatPrecipitation(50)).toBe("Starker Niederschlag");
	});

	it("formats visibility correctly", () => {
		expect(formatVisibility(100)).toBe("Sehr schlecht");
		expect(formatVisibility(199)).toBe("Sehr schlecht");
		expect(formatVisibility(200)).toBe("Schlecht");
		expect(formatVisibility(999)).toBe("Schlecht");
		expect(formatVisibility(1000)).toBe("Mäßig");
		expect(formatVisibility(4999)).toBe("Mäßig");
		expect(formatVisibility(5000)).toBe("Gut");
		expect(formatVisibility(9999)).toBe("Gut");
		expect(formatVisibility(10000)).toBe("Ausgezeichnet");
		expect(formatVisibility(20000)).toBe("Ausgezeichnet");
	});
});

describe("Weather Icons - Complete Coverage", () => {
	it("has icons for all weather types", () => {
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

		for (const type of weatherTypes) {
			expect(WEATHER_ICONS[type]).toBeDefined();
		}
	});

	it("has labels for all weather types", () => {
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

		for (const type of weatherTypes) {
			expect(WEATHER_LABELS[type]).toBeDefined();
		}
	});
});
