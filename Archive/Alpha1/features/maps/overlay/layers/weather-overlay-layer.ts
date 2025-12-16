// src/features/maps/overlay/layers/weather-overlay-layer.ts
// Weather overlay layer adapter for generic overlay system
//
// Renders weather conditions as emoji icons on hexes.
// Shows current weather type with severity-based styling.

import type { App, TFile } from "obsidian";
import {
    getWeatherOverlayStore,
    type WeatherOverlayState,
    type WeatherOverlayEntry
} from "../../state/weather-overlay-store";
import type { WeatherType } from "@features/weather/weather-types";
import type { HexCoord } from "../../rendering/rendering-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import { axialToCanvasPixel } from "@geometry";
import { LAYER_PRIORITY } from "../layer-registry";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Weather type to emoji mapping
 */
const WEATHER_EMOJI: Record<WeatherType, string> = {
    clear: "☀️",
    cloudy: "☁️",
    rain: "🌧️",
    storm: "⚡",
    snow: "❄️",
    fog: "🌫️",
    wind: "💨",
    hot: "🔥",
    cold: "🧊",
};

/**
 * Base font size for weather icons
 */
const BASE_WEATHER_ICON_SIZE = 20; // px

/**
 * Create weather overlay layer
 *
 * Renders weather icons as SVG text elements positioned at hex centers.
 * Priority: WEATHER (lowest priority - renders first, behind all other overlays)
 *
 * @example
 * ```typescript
 * const weatherLayer = createWeatherOverlayLayer(app, mapFile, radius, base, padding);
 * overlayManager.register(weatherLayer);
 * ```
 */
export function createWeatherOverlayLayer(
    app: App,
    mapFile: TFile,
    radius: number,
    base: HexCoord,
    padding: number
): SimpleOverlayLayer {
    const store = getWeatherOverlayStore(app, mapFile);

    // Helper to get pixel center from axial coordinate
    const centerOf = (coord: HexCoord): { cx: number; cy: number } => {
        const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
        return { cx: x, cy: y };
    };

    /**
     * Create weather icon SVG element
     */
    const createWeatherIcon = (coord: HexCoord, weatherType: WeatherType, severity: number): SVGTextElement => {
        const { cx, cy } = centerOf(coord);
        const emoji = WEATHER_EMOJI[weatherType];

        const icon = document.createElementNS(SVG_NS, "text");
        icon.setAttribute("class", "sm-weather-icon");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("pointer-events", "none");
        icon.setAttribute("dominant-baseline", "middle");

        // Scale icon size based on severity (0.7-1.3x base size)
        const scale = 0.7 + (severity * 0.6);
        const fontSize = BASE_WEATHER_ICON_SIZE * scale;
        icon.setAttribute("font-size", `${fontSize}px`);

        // Opacity based on severity (more severe = more opaque)
        const opacity = 0.4 + (severity * 0.4); // 0.4 to 0.8
        icon.setAttribute("opacity", String(opacity));

        // Position at hex center
        icon.setAttribute("x", String(cx));
        icon.setAttribute("y", String(cy));

        icon.textContent = emoji;

        return icon;
    };

    /**
     * Update existing weather icon
     */
    const updateWeatherIcon = (element: SVGElement, coord: HexCoord) => {
        const entry = store.get(coord);
        if (!entry) return;

        const emoji = WEATHER_EMOJI[entry.weatherType];
        const scale = 0.7 + (entry.severity * 0.6);
        const fontSize = BASE_WEATHER_ICON_SIZE * scale;
        const opacity = 0.4 + (entry.severity * 0.4);

        element.textContent = emoji;
        element.setAttribute("font-size", `${fontSize}px`);
        element.setAttribute("opacity", String(opacity));

        // Update position in case hex geometry changed
        const { cx, cy } = centerOf(coord);
        element.setAttribute("x", String(cx));
        element.setAttribute("y", String(cy));
    };

    return {
        id: "weather-overlay",
        name: "Weather",
        priority: LAYER_PRIORITY.WEATHER, // Lowest priority - renders first, behind everything

        subscribe(callback: () => void): () => void {
            return store.state.subscribe(callback);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            const entry = store.get(coord);
            if (!entry) return null;

            return {
                type: "svg",
                createElement: (coord: HexCoord) => createWeatherIcon(coord, entry.weatherType, entry.severity),
                updateElement: updateWeatherIcon,
                metadata: {
                    label: entry.weatherType,
                    tooltip: `${entry.weatherType} (${Math.round(entry.severity * 100)}% severity, ${Math.round(entry.temperature)}°C)`,
                    weatherType: entry.weatherType,
                    severity: entry.severity,
                    temperature: entry.temperature,
                },
            };
        },

        getCoordinates(): readonly HexCoord[] {
            return store.list().map(entry => entry.coord);
        },

        destroy(): void {
            // Store cleanup handled by resetWeatherOverlayStore
        },
    };
}

/**
 * Get weather emoji for a given weather type
 * Utility function for UI integration
 */
export function getWeatherEmoji(weatherType: WeatherType): string {
    return WEATHER_EMOJI[weatherType];
}

/**
 * Get weather description for tooltip
 */
export function getWeatherDescription(weatherType: WeatherType, severity: number, temperature: number): string {
    const severityLabel = severity < 0.3 ? "mild" : severity < 0.7 ? "moderate" : "severe";
    return `${weatherType} (${severityLabel}, ${Math.round(temperature)}°C)`;
}
