/**
 * Weather Panel UI Component
 *
 * Displays current weather conditions in the Session Runner sidebar.
 * Shows weather icon, conditions, gameplay effects, history, and forecast.
 * Interactive features: expandable history/forecast, hover details.
 */

import { setIcon } from "obsidian";
import type { WeatherState, ClimateTemplate, Season } from "../../../../features/weather/types";
import {
	getWeatherIcon,
	getWeatherLabel,
	getSeverityLabel,
	getWeatherSpeedModifier,
	formatTemperature,
	formatWindSpeed,
	formatPrecipitation,
	formatVisibility,
} from "../../../../features/weather/weather-icons";
import type { WeatherHistoryEntry, WeatherForecast } from "../../../../features/weather/weather-store";
import { getConfidenceLabel } from "../../../../features/weather/weather-forecaster";

/**
 * Weather panel interface
 */
export interface WeatherPanel {
	/** Root element */
	root: HTMLElement;
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
 */
export function createWeatherPanel(host: HTMLElement): WeatherPanel {
	const root = host.createDiv({ cls: "sm-weather-panel" });

	// State
	let lastModifier = 1;
	let baseSpeed: number | undefined;

	// Header
	const header = root.createDiv({ cls: "sm-weather-panel__header" });
	header.createSpan({ cls: "sm-weather-panel__title", text: "Wetter" });

	// Main weather display
	const mainDisplay = root.createDiv({ cls: "sm-weather-panel__main" });

	const iconContainer = mainDisplay.createDiv({ cls: "sm-weather-panel__icon-container" });
	const weatherIcon = iconContainer.createDiv({ cls: "sm-weather-panel__icon" });

	const infoContainer = mainDisplay.createDiv({ cls: "sm-weather-panel__info" });
	const weatherTypeLabel = infoContainer.createDiv({ cls: "sm-weather-panel__weather-type" });
	const severityLabel = infoContainer.createDiv({ cls: "sm-weather-panel__severity" });

	// Details grid
	const details = root.createDiv({ cls: "sm-weather-panel__details" });

	const tempRow = details.createDiv({ cls: "sm-weather-panel__detail-row" });
	tempRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Temperatur" });
	const tempValue = tempRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	const windRow = details.createDiv({ cls: "sm-weather-panel__detail-row" });
	windRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Wind" });
	const windValue = windRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	const precipRow = details.createDiv({ cls: "sm-weather-panel__detail-row" });
	precipRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Niederschlag" });
	const precipValue = precipRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	const visRow = details.createDiv({ cls: "sm-weather-panel__detail-row" });
	visRow.createSpan({ cls: "sm-weather-panel__detail-label", text: "Sicht" });
	const visValue = visRow.createSpan({ cls: "sm-weather-panel__detail-value" });

	// Gameplay effects
	const effects = root.createDiv({ cls: "sm-weather-panel__effects" });
	const effectsTitle = effects.createDiv({
		cls: "sm-weather-panel__effects-title",
		text: "Reiseeffekte",
	});
	const speedModifierRow = effects.createDiv({ cls: "sm-weather-panel__effect-row" });
	speedModifierRow.createSpan({ cls: "sm-weather-panel__effect-label", text: "Geschwindigkeit" });
	const speedModifierValue = speedModifierRow.createSpan({
		cls: "sm-weather-panel__effect-value",
	});

	// Helper text to explain the modifier
	const speedHelperRow = effects.createDiv({ cls: "sm-weather-panel__effect-helper" });
	const speedHelperText = speedHelperRow.createSpan({
		cls: "sm-weather-panel__effect-helper-text",
	});

	// History section (expandable)
	const historySection = root.createDiv({ cls: "sm-weather-panel__history-section" });
	const historyHeader = historySection.createDiv({ cls: "sm-weather-panel__section-header" });
	historyHeader.createSpan({ cls: "sm-weather-panel__section-title", text: "Geschichte" });
	const historyToggle = historyHeader.createSpan({ cls: "sm-weather-panel__toggle", text: "▶" });
	const historyContent = historySection.createDiv({ cls: "sm-weather-panel__history-content" });
	historyContent.style.display = "none";

	// Forecast section (expandable)
	const forecastSection = root.createDiv({ cls: "sm-weather-panel__forecast-section" });
	const forecastHeader = forecastSection.createDiv({ cls: "sm-weather-panel__section-header" });
	forecastHeader.createSpan({ cls: "sm-weather-panel__section-title", text: "Vorhersage" });
	const forecastToggle = forecastHeader.createSpan({ cls: "sm-weather-panel__toggle", text: "▶" });
	const forecastContent = forecastSection.createDiv({ cls: "sm-weather-panel__forecast-content" });
	forecastContent.style.display = "none";

	// Placeholder state
	const placeholder = root.createDiv({
		cls: "sm-weather-panel__placeholder",
		text: "Wähle ein Hex aus, um das Wetter zu sehen",
	});
	placeholder.style.display = "block";
	mainDisplay.style.display = "none";
	details.style.display = "none";
	effects.style.display = "none";
	historySection.style.display = "none";
	forecastSection.style.display = "none";

	// Toggle handlers
	let historyExpanded = false;
	let forecastExpanded = false;

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
		if (!weather) {
			// Show placeholder
			placeholder.style.display = "block";
			mainDisplay.style.display = "none";
			details.style.display = "none";
			effects.style.display = "none";
			historySection.style.display = "none";
			forecastSection.style.display = "none";
			return;
		}

		// Hide placeholder, show content
		placeholder.style.display = "none";
		mainDisplay.style.display = "flex";
		details.style.display = "block";
		effects.style.display = "block";
		historySection.style.display = "block";
		forecastSection.style.display = "block";

		const { currentWeather, temperature, windSpeed, precipitation, visibility } = weather;

		// Update icon
		weatherIcon.empty();
		const iconName = getWeatherIcon(currentWeather.type);
		setIcon(weatherIcon, iconName);

		// Update labels
		weatherTypeLabel.textContent = getWeatherLabel(currentWeather.type);
		severityLabel.textContent = getSeverityLabel(currentWeather.severity);

		// Update details
		tempValue.textContent = formatTemperature(temperature);
		windValue.textContent = formatWindSpeed(windSpeed);
		precipValue.textContent = formatPrecipitation(precipitation);
		visValue.textContent = formatVisibility(visibility);

		// Update speed modifier
		const modifier = getWeatherSpeedModifier(currentWeather.type, currentWeather.severity);
		lastModifier = modifier;
		setSpeedModifier(modifier, baseSpeed);
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
		speedModifierValue.textContent = `${percentage}%`;

		// Color code based on severity
		speedModifierValue.classList.remove(
			"sm-weather-panel__effect-value--good",
			"sm-weather-panel__effect-value--warning",
			"sm-weather-panel__effect-value--bad"
		);

		if (modifier >= 0.9) {
			speedModifierValue.classList.add("sm-weather-panel__effect-value--good");
		} else if (modifier >= 0.7) {
			speedModifierValue.classList.add("sm-weather-panel__effect-value--warning");
		} else {
			speedModifierValue.classList.add("sm-weather-panel__effect-value--bad");
		}

		// Show helper text with before/after speeds if base speed is available
		if (baseSpeed !== undefined && baseSpeed > 0) {
			const modifiedSpeed = baseSpeed * modifier;
			speedHelperText.textContent =
				`Bewegung reduziert auf ${percentage}% der normalen Geschwindigkeit` +
				` (${baseSpeed.toFixed(1)} → ${modifiedSpeed.toFixed(1)} mph)`;
			speedHelperRow.style.display = "block";
		} else {
			// No base speed available, just show generic explanation
			speedHelperText.textContent =
				`Bewegungsgeschwindigkeit auf ${percentage}% der normalen Geschwindigkeit reduziert`;
			speedHelperRow.style.display = "block";
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
	 * Destroy panel
	 */
	const destroy = () => {
		root.remove();
	};

	return {
		root,
		setWeather,
		setSpeedModifier,
		setBaseSpeed,
		setHistory,
		setForecast,
		setPlaceholder,
		destroy,
	};
}
