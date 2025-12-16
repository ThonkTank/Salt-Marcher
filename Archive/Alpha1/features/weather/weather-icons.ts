/**
 * Weather Icon Mapping
 *
 * Maps weather types to appropriate icons for UI display.
 * Uses Lucide icons (available in Obsidian) for consistent styling.
 */

import type { WeatherType } from "./weather-types";

/**
 * Icon names from Lucide icon set
 * Reference: https://lucide.dev/icons/
 */
export const WEATHER_ICONS: Record<WeatherType, string> = {
	clear: "sun",
	cloudy: "cloud",
	rain: "cloud-drizzle",
	storm: "cloud-lightning",
	snow: "cloud-snow",
	fog: "cloud-fog",
	wind: "wind",
	hot: "thermometer-sun",
	cold: "thermometer-snowflake",
};

/**
 * Get icon name for weather type
 */
export function getWeatherIcon(weatherType: WeatherType): string {
	return WEATHER_ICONS[weatherType];
}

/**
 * Get display label for weather type (German UI strings)
 */
export const WEATHER_LABELS: Record<WeatherType, string> = {
	clear: "Klar",
	cloudy: "Bewölkt",
	rain: "Regen",
	storm: "Sturm",
	snow: "Schnee",
	fog: "Nebel",
	wind: "Windig",
	hot: "Heiß",
	cold: "Kalt",
};

/**
 * Get localized label for weather type
 */
export function getWeatherLabel(weatherType: WeatherType): string {
	return WEATHER_LABELS[weatherType];
}

/**
 * Get severity description (0-1 scale → text)
 */
export function getSeverityLabel(severity: number): string {
	if (severity >= 0.8) return "Extrem";
	if (severity >= 0.6) return "Stark";
	if (severity >= 0.4) return "Mäßig";
	if (severity >= 0.2) return "Leicht";
	return "Minimal";
}

/**
 * Get movement speed modifier based on weather
 * Returns multiplier (1.0 = normal, 0.5 = half speed)
 */
export function getWeatherSpeedModifier(weatherType: WeatherType, severity: number): number {
	switch (weatherType) {
		case "snow":
			// Snow: -25% to -50% based on severity
			return 1 - severity * 0.5;
		case "storm":
			// Storm: -20% to -40% based on severity
			return 1 - severity * 0.4;
		case "rain":
			// Rain: -10% to -25% based on severity
			return 1 - severity * 0.25;
		case "fog":
			// Fog: -15% to -30% based on severity
			return 1 - severity * 0.3;
		case "wind":
			// Strong wind: -5% to -20% based on severity
			return 1 - severity * 0.2;
		case "hot":
			// Extreme heat: -10% to -20% based on severity
			return 1 - severity * 0.2;
		case "cold":
			// Extreme cold: -15% to -25% based on severity
			return 1 - severity * 0.25;
		case "clear":
		case "cloudy":
		default:
			return 1; // No penalty
	}
}

/**
 * Format temperature for display
 */
export function formatTemperature(celsius: number): string {
	return `${Math.round(celsius)}°C`;
}

/**
 * Format wind speed for display
 */
export function formatWindSpeed(kmh: number): string {
	return `${Math.round(kmh)} km/h`;
}

/**
 * Format precipitation for display
 * Shows both categorical description and precise value for calculations
 */
export function formatPrecipitation(mmPerHour: number): string {
	const rounded = Math.round(mmPerHour * 10) / 10; // Round to 1 decimal place

	if (mmPerHour < 0.1) return "Kein Niederschlag";
	if (mmPerHour < 2.5) return `Leichter Niederschlag (${rounded} mm/h)`;
	if (mmPerHour < 10) return `Mäßiger Niederschlag (${rounded} mm/h)`;
	return `Starker Niederschlag (${rounded} mm/h)`;
}

/**
 * Format visibility for display
 * Shows both categorical description and precise value for calculations
 */
export function formatVisibility(meters: number): string {
	const rounded = Math.round(meters);

	if (meters >= 10000) return `Ausgezeichnet (${(rounded / 1000).toFixed(1)} km)`;
	if (meters >= 5000) return `Gut (${(rounded / 1000).toFixed(1)} km)`;
	if (meters >= 1000) return `Mäßig (${rounded} m)`;
	if (meters >= 200) return `Schlecht (${rounded} m)`;
	return `Sehr schlecht (${rounded} m)`;
}
