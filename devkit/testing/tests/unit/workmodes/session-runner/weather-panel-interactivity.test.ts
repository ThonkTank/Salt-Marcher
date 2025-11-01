// devkit/testing/tests/unit/workmodes/session-runner/weather-panel-interactivity.test.ts
// Tests for weather panel history and forecast interactivity

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWeatherPanel } from "../../../../../../src/workmodes/session-runner/travel/ui/weather-panel";
import type { WeatherState } from "../../../../../../src/features/weather/types";
import type { WeatherHistoryEntry, WeatherForecast } from "../../../../../../src/features/weather/weather-store";

// Mock Obsidian's setIcon function
vi.mock("obsidian", () => ({
	setIcon: vi.fn((el: HTMLElement, iconName: string) => {
		el.setAttribute("data-icon", iconName);
	}),
}));

// Mock Obsidian HTMLElement extensions
function extendElement(el: HTMLElement): HTMLElement {
	(el as any).createDiv = function (options?: { cls?: string; text?: string }) {
		const child = document.createElement("div");
		if (options?.cls) child.className = options.cls;
		if (options?.text) child.textContent = options.text;
		this.appendChild(child);
		extendElement(child);
		return child;
	};
	(el as any).createEl = function (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
		const child = document.createElement(tag);
		if (options?.cls) child.className = options.cls;
		if (options?.text) child.textContent = options.text;
		if (options?.attr) {
			Object.entries(options.attr).forEach(([key, value]) => {
				child.setAttribute(key, value);
			});
		}
		this.appendChild(child);
		extendElement(child);
		return child;
	};
	(el as any).createSpan = function (options?: { cls?: string; text?: string }) {
		const child = document.createElement("span");
		if (options?.cls) child.className = options.cls;
		if (options?.text) child.textContent = options.text;
		this.appendChild(child);
		extendElement(child);
		return child;
	};
	(el as any).empty = function () {
		this.innerHTML = "";
		return this;
	};
	return el;
}

describe("Weather Panel Interactivity", () => {
	let container: HTMLElement;
	let panel: ReturnType<typeof createWeatherPanel>;

	beforeEach(() => {
		container = extendElement(document.createElement("div"));
		document.body.appendChild(container);
		panel = createWeatherPanel(container);
	});

	it("should display placeholder when no weather available", () => {
		panel.setWeather(null);

		const placeholder = container.querySelector(".sm-weather-panel__placeholder") as HTMLElement;
		expect(placeholder).toBeTruthy();
		expect(placeholder.style.display).toBe("block");
		expect(placeholder.textContent).toContain("Wähle ein Hex aus");
	});

	it("should display weather history when provided", () => {
		const weather: WeatherState = {
			hexCoord: { q: 0, r: 0, s: 0 },
			currentWeather: {
				type: "rain",
				severity: "moderate",
			},
			temperature: 15,
			windSpeed: 20,
			precipitation: 5,
			visibility: 1000,
			climate: "temperate",
			season: "spring",
			lastUpdate: "2025-01-01T12:00:00Z",
		};

		const history: WeatherHistoryEntry[] = [
			{
				weather: {
					...weather,
					currentWeather: { type: "clear", severity: "none" },
					temperature: 20,
					lastUpdate: "2024-12-30T12:00:00Z",
				},
				date: "2024-12-30T12:00:00Z",
			},
			{
				weather: {
					...weather,
					currentWeather: { type: "cloudy", severity: "light" },
					temperature: 18,
					lastUpdate: "2024-12-31T12:00:00Z",
				},
				date: "2024-12-31T12:00:00Z",
			},
		];

		panel.setWeather(weather);
		panel.setHistory(history);

		// History section should be visible
		const historySection = container.querySelector(".sm-weather-panel__history-section") as HTMLElement;
		expect(historySection).toBeTruthy();
		expect(historySection.style.display).toBe("block");

		// Should show 2 history entries
		const historyEntries = container.querySelectorAll(".sm-weather-panel__history-entry");
		expect(historyEntries.length).toBe(2);

		// Should show dates and weather types (reversed, most recent first)
		const firstEntry = historyEntries[0] as HTMLElement;
		expect(firstEntry.textContent).toContain("31.12.2024");
		expect(firstEntry.textContent).toContain("Bewölkt");

		const secondEntry = historyEntries[1] as HTMLElement;
		expect(secondEntry.textContent).toContain("30.12.2024");
		expect(secondEntry.textContent).toContain("Klar");
	});

	it("should display weather forecast when provided", () => {
		const weather: WeatherState = {
			hexCoord: { q: 0, r: 0, s: 0 },
			currentWeather: {
				type: "clear",
				severity: "none",
			},
			temperature: 20,
			windSpeed: 10,
			precipitation: 0,
			visibility: 5000,
			climate: "temperate",
			season: "spring",
			lastUpdate: "2025-01-01T12:00:00Z",
		};

		const forecast: WeatherForecast[] = [
			{
				weather: {
					...weather,
					currentWeather: { type: "cloudy", severity: "light" },
					temperature: 18,
					lastUpdate: "2025-01-02T12:00:00Z",
				},
				date: "2025-01-02T12:00:00Z",
				confidence: 0.9,
			},
			{
				weather: {
					...weather,
					currentWeather: { type: "rain", severity: "moderate" },
					temperature: 15,
					lastUpdate: "2025-01-03T12:00:00Z",
				},
				date: "2025-01-03T12:00:00Z",
				confidence: 0.7,
			},
			{
				weather: {
					...weather,
					currentWeather: { type: "storm", severity: "heavy" },
					temperature: 12,
					lastUpdate: "2025-01-04T12:00:00Z",
				},
				date: "2025-01-04T12:00:00Z",
				confidence: 0.5,
			},
		];

		panel.setWeather(weather);
		panel.setForecast(forecast);

		// Forecast section should be visible
		const forecastSection = container.querySelector(".sm-weather-panel__forecast-section") as HTMLElement;
		expect(forecastSection).toBeTruthy();
		expect(forecastSection.style.display).toBe("block");

		// Should show 3 forecast entries
		const forecastEntries = container.querySelectorAll(".sm-weather-panel__forecast-entry");
		expect(forecastEntries.length).toBe(3);

		// Should show dates, weather types, and confidence
		const firstEntry = forecastEntries[0] as HTMLElement;
		expect(firstEntry.textContent).toContain("Do., 02.01.");
		expect(firstEntry.textContent).toContain("Bewölkt");
		expect(firstEntry.textContent).toContain("Sehr sicher");

		const secondEntry = forecastEntries[1] as HTMLElement;
		expect(secondEntry.textContent).toContain("Fr., 03.01.");
		expect(secondEntry.textContent).toContain("Regen");
		expect(secondEntry.textContent).toContain("Wahrscheinlich");

		const thirdEntry = forecastEntries[2] as HTMLElement;
		expect(thirdEntry.textContent).toContain("Sa., 04.01.");
		expect(thirdEntry.textContent).toContain("Sturm");
		expect(thirdEntry.textContent).toContain("Möglich");
	});

	it("should hide history/forecast sections when data is empty", () => {
		const weather: WeatherState = {
			hexCoord: { q: 0, r: 0, s: 0 },
			currentWeather: {
				type: "clear",
				severity: "none",
			},
			temperature: 20,
			windSpeed: 10,
			precipitation: 0,
			visibility: 5000,
			climate: "temperate",
			season: "spring",
			lastUpdate: "2025-01-01T12:00:00Z",
		};

		panel.setWeather(weather);
		panel.setHistory([]);
		panel.setForecast([]);

		// Sections should be visible but show empty state
		const historyContent = container.querySelector(".sm-weather-panel__history-content") as HTMLElement;
		const forecastContent = container.querySelector(".sm-weather-panel__forecast-content") as HTMLElement;

		expect(historyContent.textContent).toContain("Keine Verlaufsdaten verfügbar");
		expect(forecastContent.textContent).toContain("Keine Vorhersage verfügbar");
	});

	it("should toggle history section expansion", () => {
		const weather: WeatherState = {
			hexCoord: { q: 0, r: 0, s: 0 },
			currentWeather: { type: "clear", severity: "none" },
			temperature: 20,
			windSpeed: 10,
			precipitation: 0,
			visibility: 5000,
			climate: "temperate",
			season: "spring",
			lastUpdate: "2025-01-01T12:00:00Z",
		};

		panel.setWeather(weather);
		panel.setHistory([
			{
				weather,
				date: "2024-12-30T12:00:00Z",
			},
		]);

		const historyHeader = container.querySelector(".sm-weather-panel__history-section .sm-weather-panel__section-header") as HTMLElement;
		const historyContent = container.querySelector(".sm-weather-panel__history-content") as HTMLElement;
		const historyToggle = container.querySelector(".sm-weather-panel__history-section .sm-weather-panel__toggle") as HTMLElement;

		// Initially collapsed
		expect(historyContent.style.display).toBe("none");
		expect(historyToggle.textContent).toBe("▶");

		// Click to expand
		historyHeader.click();
		expect(historyContent.style.display).toBe("block");
		expect(historyToggle.textContent).toBe("▼");

		// Click to collapse
		historyHeader.click();
		expect(historyContent.style.display).toBe("none");
		expect(historyToggle.textContent).toBe("▶");
	});

	it("should toggle forecast section expansion", () => {
		const weather: WeatherState = {
			hexCoord: { q: 0, r: 0, s: 0 },
			currentWeather: { type: "clear", severity: "none" },
			temperature: 20,
			windSpeed: 10,
			precipitation: 0,
			visibility: 5000,
			climate: "temperate",
			season: "spring",
			lastUpdate: "2025-01-01T12:00:00Z",
		};

		panel.setWeather(weather);
		panel.setForecast([
			{
				weather,
				date: "2025-01-02T12:00:00Z",
				confidence: 0.9,
			},
		]);

		const forecastHeader = container.querySelector(".sm-weather-panel__forecast-section .sm-weather-panel__section-header") as HTMLElement;
		const forecastContent = container.querySelector(".sm-weather-panel__forecast-content") as HTMLElement;
		const forecastToggle = container.querySelector(".sm-weather-panel__forecast-section .sm-weather-panel__toggle") as HTMLElement;

		// Initially collapsed
		expect(forecastContent.style.display).toBe("none");
		expect(forecastToggle.textContent).toBe("▶");

		// Click to expand
		forecastHeader.click();
		expect(forecastContent.style.display).toBe("block");
		expect(forecastToggle.textContent).toBe("▼");

		// Click to collapse
		forecastHeader.click();
		expect(forecastContent.style.display).toBe("none");
		expect(forecastToggle.textContent).toBe("▶");
	});
});
