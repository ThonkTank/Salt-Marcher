/**
 * Weather Panel UI Component
 *
 * Displays current weather conditions in the Session Runner sidebar.
 * Shows weather icon, conditions, gameplay effects, next update timing, history, and forecast.
 * Interactive features: expandable history/forecast, hover details.
 */

import { setIcon } from "obsidian";
import { getConfidenceLabel } from "@features/weather/weather-forecaster";
import {
	getWeatherIcon,
	getWeatherLabel,
	getSeverityLabel,
	getWeatherSpeedModifier,
	formatTemperature,
	formatWindSpeed,
	formatPrecipitation,
	formatVisibility,
} from "@features/weather/weather-icons";
import type { WeatherState } from "@features/weather/weather-types";
import type { WeatherHistoryEntry, WeatherForecast } from "@features/weather/weather-store";

/**
 * Weather panel interface
 * Creates content directly in provided host element (no wrapper)
 */
export interface WeatherPanel {
	/** Update weather display */
	setWeather(weather: WeatherState | null): void;
	/** Update movement speed modifier display with base speed for context */
	setSpeedModifier(modifier: number, baseSpeed?: number): void;
	/** Update base speed for modifier calculations (uses last modifier) */
	setBaseSpeed(speed: number): void;
	/** Set weather history (last 7 days) */
	setHistory(history: WeatherHistoryEntry[]): void;
	/** Set weather forecast (next 3 days) */
	setForecast(forecast: WeatherForecast[]): void;
	/** Set placeholder error message */
	setPlaceholder(message: string): void;
	/** Destroy panel */
	destroy(): void;
}

/**
 * Create weather panel component
 * Creates content directly in the provided host element (no wrapper div)
 */
export function createWeatherPanel(host: HTMLElement): WeatherPanel {
	// State
	let lastModifier = 1;
	let baseSpeed: number | undefined;
	let currentWeatherState: WeatherState | null = null;

	// Compact header display (2 lines)
	const compactHeader = host.createDiv({ cls: "sm-weather-panel__compact-header" });

	// Line 1: Icon + Weather Type (Severity) + Temperature
	const headerLine1 = compactHeader.createDiv({ cls: "sm-weather-panel__header-line1" });
	const weatherIcon = headerLine1.createDiv({ cls: "sm-weather-panel__icon" });
	const weatherLabel = headerLine1.createSpan({ cls: "sm-weather-panel__weather-label" });
	const tempValue = headerLine1.createSpan({ cls: "sm-weather-panel__temp-value" });

	// Line 2: Speed modifier + Next update timing
	const headerLine2 = compactHeader.createDiv({ cls: "sm-weather-panel__header-line2" });
	const speedDisplay = headerLine2.createSpan({ cls: "sm-weather-panel__speed-display" });
	speedDisplay.createSpan({ cls: "sm-weather-panel__speed-label", text: "Speed: " });
	const speedValue = speedDisplay.createSpan({ cls: "sm-weather-panel__speed-value" });
	const nextUpdateDisplay = headerLine2.createSpan({ cls: "sm-weather-panel__next-update-display" });
	nextUpdateDisplay.createSpan({ cls: "sm-weather-panel__next-label", text: "Next: " });
	const nextUpdateValue = nextUpdateDisplay.createSpan({ cls: "sm-weather-panel__next-value" });

	// Details section (expandable, collapsed by default)
	const detailsSection = host.createDiv({ cls: "sm-weather-panel__details-section" });
	const detailsHeader = detailsSection.createDiv({ cls: "sm-weather-panel__section-header" });
	detailsHeader.createSpan({ cls: "sm-weather-panel__section-title", text: "Details" });
	const detailsToggle = detailsHeader.createSpan({ cls: "sm-weather-panel__toggle", text: "▶" });
	const detailsContent = detailsSection.createDiv({ cls: "sm-weather-panel__details-content" });
	detailsContent.style.display = "none";

	const windRow = detailsContent.createDiv({ cls: "sm-weather-panel__detail-row" });
	windRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Wind" });
	const windValue = windRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	const precipRow = detailsContent.createDiv({ cls: "sm-weather-panel__detail-row" });
	precipRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Niederschlag" });
	const precipValue = precipRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	const visRow = detailsContent.createDiv({ cls: "sm-weather-panel__detail-row" });
	visRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Sicht" });
	const visValue = visRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	// History section (expandable, collapsed by default)
	const historySection = host.createDiv({ cls: "sm-weather-panel__history-section" });
	const historyHeader = historySection.createDiv({ cls: "sm-weather-panel__section-header" });
	historyHeader.createSpan({ cls: "sm-weather-panel__section-title", text: "History (7 days)" });
	const historyToggle = historyHeader.createSpan({ cls: "sm-weather-panel__toggle", text: "▶" });
	const historyContent = historySection.createDiv({ cls: "sm-weather-panel__history-content" });
	historyContent.style.display = "none";

	// Forecast section (expandable, collapsed by default)
	const forecastSection = host.createDiv({ cls: "sm-weather-panel__forecast-section" });
	const forecastHeader = forecastSection.createDiv({ cls: "sm-weather-panel__section-header" });
	forecastHeader.createSpan({ cls: "sm-weather-panel__section-title", text: "Forecast (3 days)" });
	const forecastToggle = forecastHeader.createSpan({ cls: "sm-weather-panel__toggle", text: "▶" });
	const forecastContent = forecastSection.createDiv({ cls: "sm-weather-panel__forecast-content" });
	forecastContent.style.display = "none";

	// Placeholder state
	const placeholder = host.createDiv({
		cls: "sm-weather-panel__placeholder",
		text: "Wähle ein Hex aus, um das Wetter zu sehen",
	});
	placeholder.style.display = "block";
	compactHeader.style.display = "none";
	detailsSection.style.display = "none";
	historySection.style.display = "none";
	forecastSection.style.display = "none";

	// Toggle handlers (default collapsed for compact design)
	let detailsExpanded = false;
	let historyExpanded = false;
	let forecastExpanded = false;

	detailsHeader.onclick = () => {
		detailsExpanded = !detailsExpanded;
		detailsContent.style.display = detailsExpanded ? "block" : "none";
		detailsToggle.textContent = detailsExpanded ? "▼" : "▶";
	};

	historyHeader.onclick = () => {
		historyExpanded = !historyExpanded;
		historyContent.style.display = historyExpanded ? "block" : "none";
		historyToggle.textContent = historyExpanded ? "▼" : "▶";
	};

	forecastHeader.onclick = () => {
		forecastExpanded = !forecastExpanded;
		forecastContent.style.display = forecastExpanded ? "block" : "none";
		forecastToggle.textContent = forecastExpanded ? "▼" : "▶";
	};

	/**
	 * Update weather display
	 */
	const setWeather = (weather: WeatherState | null) => {
		currentWeatherState = weather;

		if (!weather) {
			// Show placeholder
			placeholder.style.display = "block";
			compactHeader.style.display = "none";
			detailsSection.style.display = "none";
			historySection.style.display = "none";
			forecastSection.style.display = "none";
			return;
		}

		// Hide placeholder, show content
		placeholder.style.display = "none";
		compactHeader.style.display = "block";
		detailsSection.style.display = "block";
		historySection.style.display = "block";
		forecastSection.style.display = "block";

		const { currentWeather, temperature, windSpeed, precipitation, visibility } = weather;

		// Update icon with severity indicator
		weatherIcon.empty();
		const iconName = getWeatherIcon(currentWeather.type);
		setIcon(weatherIcon, iconName);

		// Apply severity-based color coding to icon
		weatherIcon.classList.remove(
			"sm-weather-panel__icon--minimal",
			"sm-weather-panel__icon--light",
			"sm-weather-panel__icon--moderate",
			"sm-weather-panel__icon--severe",
			"sm-weather-panel__icon--extreme"
		);

		const severity = currentWeather.severity;
		if (severity >= 0.8) {
			weatherIcon.classList.add("sm-weather-panel__icon--extreme");
		} else if (severity >= 0.6) {
			weatherIcon.classList.add("sm-weather-panel__icon--severe");
		} else if (severity >= 0.4) {
			weatherIcon.classList.add("sm-weather-panel__icon--moderate");
		} else if (severity >= 0.2) {
			weatherIcon.classList.add("sm-weather-panel__icon--light");
		} else {
			weatherIcon.classList.add("sm-weather-panel__icon--minimal");
		}

		// Update compact header line 1: Weather label + Temperature
		const weatherTypeText = getWeatherLabel(currentWeather.type);
		const severityText = getSeverityLabel(currentWeather.severity);
		weatherLabel.textContent = `${weatherTypeText} (${severityText})`;
		tempValue.textContent = formatTemperature(temperature);

		// Update compact header line 2: Speed modifier + Next update timing
		const modifier = getWeatherSpeedModifier(currentWeather.type, currentWeather.severity);
		lastModifier = modifier;
		const percentage = Math.round(modifier * 100);
		speedValue.textContent = `${percentage}%`;

		// Color code speed value
		speedValue.classList.remove(
			"sm-weather-panel__speed-value--good",
			"sm-weather-panel__speed-value--warning",
			"sm-weather-panel__speed-value--bad"
		);
		if (modifier >= 0.9) {
			speedValue.classList.add("sm-weather-panel__speed-value--good");
		} else if (modifier >= 0.7) {
			speedValue.classList.add("sm-weather-panel__speed-value--warning");
		} else {
			speedValue.classList.add("sm-weather-panel__speed-value--bad");
		}

		// Update next update timing
		const duration = currentWeather.duration ?? 0;
		const hoursText = duration === 1 ? "h" : "h";
		nextUpdateValue.textContent = `${duration}${hoursText}`;

		// Update detail values (for expandable section)
		windValue.textContent = formatWindSpeed(windSpeed);
		precipValue.textContent = formatPrecipitation(precipitation);
		visValue.textContent = formatVisibility(visibility);
	};

	/**
	 * Update movement speed modifier display
	 */
	const setSpeedModifier = (modifier: number, speed?: number) => {
		lastModifier = modifier;
		if (speed !== undefined) {
			baseSpeed = speed;
		}

		const percentage = Math.round(modifier * 100);
		speedValue.textContent = `${percentage}%`;

		// Color code based on severity
		speedValue.classList.remove(
			"sm-weather-panel__speed-value--good",
			"sm-weather-panel__speed-value--warning",
			"sm-weather-panel__speed-value--bad"
		);

		if (modifier >= 0.9) {
			speedValue.classList.add("sm-weather-panel__speed-value--good");
		} else if (modifier >= 0.7) {
			speedValue.classList.add("sm-weather-panel__speed-value--warning");
		} else {
			speedValue.classList.add("sm-weather-panel__speed-value--bad");
		}
	};

	/**
	 * Update base speed (refreshes display with last modifier)
	 */
	const setBaseSpeed = (speed: number) => {
		baseSpeed = speed;
		setSpeedModifier(lastModifier, speed);
	};

	/**
	 * Set weather history (last 7 days)
	 */
	const setHistory = (history: WeatherHistoryEntry[]) => {
		historyContent.empty();

		if (history.length === 0) {
			historyContent.createSpan({
				cls: "sm-weather-panel__empty-message",
				text: "Keine Verlaufsdaten verfügbar",
			});
			return;
		}

		// Display history entries (most recent first)
		const reversed = [...history].reverse();
		for (const entry of reversed) {
			const entryEl = historyContent.createDiv({ cls: "sm-weather-panel__history-entry" });

			// Date
			const date = new Date(entry.date);
			const dateStr = date.toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			});
			entryEl.createSpan({ cls: "sm-weather-panel__history-date", text: dateStr });

			// Weather icon and label
			const iconEl = entryEl.createSpan({ cls: "sm-weather-panel__history-icon" });
			setIcon(iconEl, getWeatherIcon(entry.weather.currentWeather.type));

			const labelEl = entryEl.createSpan({ cls: "sm-weather-panel__history-label" });
			labelEl.textContent = `${getWeatherLabel(entry.weather.currentWeather.type)} (${formatTemperature(entry.weather.temperature)})`;
		}
	};

	/**
	 * Set weather forecast (next 3 days)
	 */
	const setForecast = (forecast: WeatherForecast[]) => {
		forecastContent.empty();

		if (forecast.length === 0) {
			forecastContent.createSpan({
				cls: "sm-weather-panel__empty-message",
				text: "Keine Vorhersage verfügbar",
			});
			return;
		}

		// Display forecast entries
		for (const entry of forecast) {
			const entryEl = forecastContent.createDiv({ cls: "sm-weather-panel__forecast-entry" });

			// Date
			const date = new Date(entry.date);
			const dateStr = date.toLocaleDateString("de-DE", {
				weekday: "short",
				day: "2-digit",
				month: "2-digit",
			});
			entryEl.createSpan({ cls: "sm-weather-panel__forecast-date", text: dateStr });

			// Weather icon and label
			const iconEl = entryEl.createSpan({ cls: "sm-weather-panel__forecast-icon" });
			setIcon(iconEl, getWeatherIcon(entry.weather.currentWeather.type));

			const labelEl = entryEl.createSpan({ cls: "sm-weather-panel__forecast-label" });
			labelEl.textContent = `${getWeatherLabel(entry.weather.currentWeather.type)} (${formatTemperature(entry.weather.temperature)})`;

			// Confidence indicator
			const confidenceEl = entryEl.createSpan({ cls: "sm-weather-panel__forecast-confidence" });
			confidenceEl.textContent = getConfidenceLabel(entry.confidence);

			// Color code by confidence
			if (entry.confidence >= 0.7) {
				confidenceEl.classList.add("sm-weather-panel__forecast-confidence--high");
			} else if (entry.confidence >= 0.5) {
				confidenceEl.classList.add("sm-weather-panel__forecast-confidence--medium");
			} else {
				confidenceEl.classList.add("sm-weather-panel__forecast-confidence--low");
			}
		}
	};

	/**
	 * Set placeholder error message
	 */
	const setPlaceholder = (message: string) => {
		placeholder.textContent = message;
	};

	/**
	 * Destroy panel (clears host content)
	 */
	const destroy = () => {
		host.empty();
	};

	return {
		setWeather,
		setSpeedModifier,
		setBaseSpeed,
		setHistory,
		setForecast,
		setPlaceholder,
		destroy,
	};
}
