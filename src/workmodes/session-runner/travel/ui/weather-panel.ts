/**
 * Weather Panel UI Component
 *
 * Displays current weather conditions in the Session Runner sidebar.
 * Shows weather icon, conditions, and gameplay effects.
 */

import { setIcon } from "obsidian";
import type { WeatherState } from "../../../../features/weather/types";
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

	// Placeholder state
	const placeholder = root.createDiv({
		cls: "sm-weather-panel__placeholder",
		text: "Kein Wetter verfügbar",
	});
	placeholder.style.display = "block";
	mainDisplay.style.display = "none";
	details.style.display = "none";
	effects.style.display = "none";

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
			return;
		}

		// Hide placeholder, show content
		placeholder.style.display = "none";
		mainDisplay.style.display = "flex";
		details.style.display = "block";
		effects.style.display = "block";

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
		destroy,
	};
}
