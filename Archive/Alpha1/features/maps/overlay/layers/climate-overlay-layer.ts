// src/features/maps/overlay/layers/climate-overlay-layer.ts
// Unified parameterized climate overlay layer
//
// Replaces 4 separate climate overlay layers (temperature, precipitation, cloudcover, wind)
// with a single parameterized implementation.
//
// Each channel (temperature/precipitation/cloudcover/wind) has its own:
// - Data field path
// - Color gradient configuration
// - Value range
// - Layer ID and priority

import type { App, TFile } from "obsidian";
import { coordToKey, axialToCanvasPixel } from "@geometry";
import type { AxialCoord } from "@geometry";
import { getMapSession } from "../../session";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import { ClimateEngine, getClimateEngine } from "@services/climate";
import { LAYER_PRIORITY } from "../layer-registry";
import { getHexCoordsFromTiles } from "../layer-utils";

/**
 * Climate data channels supported by the unified overlay
 */
export type ClimateChannel = "temperature" | "precipitation" | "cloudcover" | "wind";

/**
 * Gradient stop for color interpolation
 */
interface GradientStop {
    value: number;  // Normalized 0-1 position in gradient
    r: number;      // Red 0-255
    g: number;      // Green 0-255
    b: number;      // Blue 0-255
}

/**
 * Configuration for a single climate channel
 */
interface ChannelConfig {
    /** Layer identifier */
    layerId: string;
    /** Human-readable layer name */
    name: string;
    /** Rendering priority (lower = behind) */
    priority: number;
    /** Value range (min, max) for normalization */
    range: { min: number; max: number };
    /** Color gradient stops */
    gradient: GradientStop[];
    /** Base opacity (before value-based adjustment) */
    baseOpacity: number;
    /** Opacity multiplier based on normalized value */
    opacityMultiplier: number;
}

/**
 * Channel configurations for all climate overlays
 */
const CHANNEL_CONFIGS: Record<ClimateChannel, ChannelConfig> = {
    temperature: {
        layerId: "temperature-overlay",
        name: "Temperature Overlay",
        priority: LAYER_PRIORITY.TEMPERATURE,
        range: { min: -20, max: 50 },
        // Blue (cold) → White (neutral 15°C) → Red (hot)
        gradient: [
            { value: 0.0, r: 0, g: 100, b: 255 },      // -20°C: Blue
            { value: 0.5, r: 255, g: 255, b: 255 },    // 15°C: White (neutral)
            { value: 1.0, r: 255, g: 100, b: 0 },      // 50°C: Red
        ],
        baseOpacity: 0.15,
        opacityMultiplier: 0.4,
    },
    precipitation: {
        layerId: "precipitation-overlay",
        name: "Precipitation Overlay",
        priority: LAYER_PRIORITY.PRECIPITATION,
        range: { min: 0, max: 3000 },
        // Light blue (dry) → Dark blue (wet)
        gradient: [
            { value: 0.0, r: 200, g: 230, b: 255 },    // 0mm: Light blue
            { value: 1.0, r: 0, g: 50, b: 150 },       // 3000mm: Dark blue
        ],
        baseOpacity: 0.05,
        opacityMultiplier: 0.45,
    },
    cloudcover: {
        layerId: "cloudcover-overlay",
        name: "Cloud Cover Overlay",
        priority: LAYER_PRIORITY.CLOUD_COVER,
        range: { min: 0.0, max: 1.0 },
        // Light gray (clear) → White (overcast)
        gradient: [
            { value: 0.0, r: 220, g: 220, b: 220 },    // 0.0: Light gray
            { value: 1.0, r: 255, g: 255, b: 255 },    // 1.0: White
        ],
        baseOpacity: 0.0,
        opacityMultiplier: 0.5,
    },
    wind: {
        layerId: "wind-overlay",
        name: "Wind Overlay",
        priority: LAYER_PRIORITY.WIND,
        range: { min: 0, max: 200 },
        // Wind uses arrow rendering, not gradient fills
        // These values are placeholders (wind renders via renderWhole)
        gradient: [],
        baseOpacity: 0,
        opacityMultiplier: 0,
    },
};

/**
 * Interpolate color between gradient stops
 */
function interpolateColor(gradient: GradientStop[], normalized: number): string {
    // Clamp to 0-1 range
    const clamped = Math.max(0, Math.min(1, normalized));

    // Find the two gradient stops to interpolate between
    let lowerStop = gradient[0];
    let upperStop = gradient[gradient.length - 1];

    for (let i = 0; i < gradient.length - 1; i++) {
        if (clamped >= gradient[i].value && clamped <= gradient[i + 1].value) {
            lowerStop = gradient[i];
            upperStop = gradient[i + 1];
            break;
        }
    }

    // Calculate interpolation factor within this segment
    const segmentRange = upperStop.value - lowerStop.value;
    const t = segmentRange === 0 ? 0 : (clamped - lowerStop.value) / segmentRange;

    // Interpolate RGB values
    const r = Math.floor(lowerStop.r + (upperStop.r - lowerStop.r) * t);
    const g = Math.floor(lowerStop.g + (upperStop.g - lowerStop.g) * t);
    const b = Math.floor(lowerStop.b + (upperStop.b - lowerStop.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Calculate opacity based on normalized value and config
 */
function calculateOpacity(normalized: number, config: ChannelConfig): number {
    // For temperature: opacity increases with deviation from neutral (0.5)
    if (config.layerId === "temperature-overlay") {
        const deviation = Math.abs(normalized - 0.5);
        return config.baseOpacity + (deviation * 2) * config.opacityMultiplier;
    }

    // For other channels: opacity increases linearly with value
    return config.baseOpacity + normalized * config.opacityMultiplier;
}

/**
 * Format temperature label for display
 */
function formatTempLabel(temp: number, offset: number): string {
    const tempStr = `${Math.round(temp)}°`;
    if (offset === 0) return tempStr;
    const offsetStr = offset > 0 ? `+${offset}` : `${offset}`;
    return `${tempStr} (${offsetStr})`;
}

/**
 * Wind arrow rendering helpers
 */
const SVG_NS = "http://www.w3.org/2000/svg";

function getArrowSize(speed: number): { length: number; width: number } {
    const clamped = Math.max(0, Math.min(200, speed));
    const normalized = clamped / 200;
    return {
        length: 10 + normalized * 30,
        width: 4 + normalized * 8,
    };
}

function getArrowColor(speed: number): string {
    if (speed < 20) return "rgba(128, 128, 128, 0.6)";  // Gray - calm
    if (speed < 60) return "rgba(100, 149, 237, 0.7)";  // Cornflower blue - moderate
    if (speed < 100) return "rgba(138, 43, 226, 0.8)";  // Blue violet - strong
    return "rgba(148, 0, 211, 0.9)";                    // Dark violet - gale
}

/**
 * Create a unified climate overlay layer for the specified channel
 *
 * @param channel - Climate data channel to visualize
 * @param app - Obsidian App instance
 * @param mapFile - Map file reference
 * @param radius - Hex radius (required for wind layer)
 * @param base - Base coordinate (required for wind layer)
 * @param padding - Hex padding (required for wind layer)
 *
 * @example
 * ```typescript
 * // Temperature overlay
 * const tempLayer = createClimateOverlayLayer("temperature", app, mapFile);
 * overlayManager.register(tempLayer);
 *
 * // Wind overlay (requires geometry parameters)
 * const windLayer = createClimateOverlayLayer("wind", app, mapFile, radius, base, padding);
 * overlayManager.register(windLayer);
 * ```
 */
export function createClimateOverlayLayer(
    channel: ClimateChannel,
    app: App,
    mapFile: TFile,
    radius?: number,
    base?: AxialCoord,
    padding?: number
): SimpleOverlayLayer {
    const config = CHANNEL_CONFIGS[channel];
    const { tileCache } = getMapSession(app, mapFile);

    // Wind layer needs coordinate-to-pixel conversion
    const centerOf = (channel === "wind" && radius !== undefined && base !== undefined && padding !== undefined)
        ? (coord: AxialCoord): { cx: number; cy: number } => {
            const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
            return { cx: x, cy: y };
        }
        : undefined;

    // Temperature layer needs climate engine
    const climateEngine = channel === "temperature" ? getClimateEngine() : undefined;

    // Local state for temperature layer
    let showLabels = true;
    let currentDayOfYear = 180; // Default to summer (day 180)

    return {
        id: config.layerId,
        name: config.name,
        priority: config.priority,

        getCoordinates(): readonly AxialCoord[] {
            const state = tileCache.getState();
            if (!state.loaded) return [];

            // Temperature renders all tiles
            if (channel === "temperature") {
                return getHexCoordsFromTiles(state.tiles);
            }

            // Other channels only render tiles with data
            const coords: AxialCoord[] = [];
            for (const record of state.tiles.values()) {
                const hasData = (() => {
                    switch (channel) {
                        case "precipitation":
                            return record.data.climate?.precipitation?.rainfall !== undefined;
                        case "cloudcover":
                            return record.data.climate?.cloudCover !== undefined &&
                                   record.data.climate.cloudCover > 0;
                        case "wind":
                            return record.data.climate?.wind?.speed !== undefined &&
                                   record.data.climate?.wind?.direction !== undefined;
                        default:
                            return false;
                    }
                })();

                if (hasData) {
                    coords.push(record.coord);
                }
            }

            return coords;
        },

        getRenderData(coord: AxialCoord): OverlayRenderData | null {
            // Wind uses renderWhole() instead
            if (channel === "wind") {
                return null;
            }

            const state = tileCache.getState();
            if (!state.loaded) return null;

            const key = coordToKey(coord);
            const record = state.tiles.get(key);
            if (!record) return null;

            const tileData = record.data;

            // Extract value and calculate color/opacity based on channel
            let value: number;
            let label: string | undefined;
            let tooltip: string;
            let metadata: Record<string, unknown>;

            switch (channel) {
                case "temperature": {
                    // Get temperature offset from tile (if any)
                    const offset = tileData?.climate?.temperatureOffset ?? 0;

                    // Build climate input tile from tile data
                    const climateInputTile = tileData ? {
                        terrain: tileData.terrain,
                        moisture: tileData.moisture,
                        flora: tileData.flora,
                        elevation: tileData.elevation,
                        climate: tileData.climate,
                    } : undefined;

                    // Calculate temperature using climate engine
                    // Use midday (12:00) for a representative temperature
                    const calculatedTemp = climateEngine!.getTemperatureAt(
                        climateInputTile,
                        12, // Hour: midday
                        currentDayOfYear
                    );

                    value = calculatedTemp;

                    // Build label: "23° (+5)" format
                    label = showLabels ? formatTempLabel(calculatedTemp, offset) : undefined;

                    const offsetStr = offset > 0 ? `+${offset}` : offset === 0 ? "0" : `${offset}`;
                    tooltip = `Temperatur: ${Math.round(calculatedTemp)}°C (Offset: ${offsetStr}°C)`;
                    metadata = {
                        label,
                        tooltip,
                        calculatedTemp,
                        offset,
                    };
                    break;
                }

                case "precipitation": {
                    const rainfall = tileData.climate?.precipitation?.rainfall;
                    if (rainfall === undefined) return null;

                    value = rainfall;
                    label = "Precipitation";
                    tooltip = `Rainfall: ${rainfall}mm/year`;
                    metadata = { label, tooltip, rainfall };
                    break;
                }

                case "cloudcover": {
                    const cloudCover = tileData.climate?.cloudCover;
                    if (cloudCover === undefined || cloudCover <= 0) return null;

                    value = cloudCover;
                    label = "Cloud Cover";
                    tooltip = `Clouds: ${(cloudCover * 100).toFixed(0)}%`;
                    metadata = { label, tooltip, cloudCover };
                    break;
                }

                default:
                    return null;
            }

            // Normalize value to 0-1 range
            const normalized = (value - config.range.min) / (config.range.max - config.range.min);

            // Calculate color and opacity
            const color = interpolateColor(config.gradient, normalized);
            const opacity = calculateOpacity(normalized, config);

            return {
                type: "fill",
                color,
                fillOpacity: String(opacity),
                strokeWidth: "0",
                metadata,
            };
        },

        renderWhole(group: SVGGElement, hexToPixel: (coord: AxialCoord) => { x: number; y: number }): void {
            // Only wind layer uses renderWhole
            if (channel !== "wind" || !centerOf) return;

            // Clear previous render
            group.innerHTML = '';

            const state = tileCache.getState();
            if (!state.loaded) return;

            // Render arrows for all hexes with wind data
            for (const record of state.tiles.values()) {
                const windData = record.data.climate?.wind;
                if (!windData?.speed || windData.speed <= 0) continue;

                const { speed, direction } = windData;
                const coord = record.coord;
                const { cx: x, cy: y } = centerOf(coord);
                const { length, width } = getArrowSize(speed);
                const color = getArrowColor(speed);

                // Create arrow group
                const g = document.createElementNS(SVG_NS, "g");
                g.setAttribute("class", "sm-wind-arrow");

                // Arrow path (pointing upward initially, will be rotated)
                const path = document.createElementNS(SVG_NS, "path");
                const arrowPath = `
                    M 0,-${length / 2}
                    L -${width / 2},${length / 2}
                    L 0,${length / 2 - width}
                    L ${width / 2},${length / 2}
                    Z
                `;
                path.setAttribute("d", arrowPath);
                path.setAttribute("fill", color);
                path.setAttribute("stroke", "rgba(0, 0, 0, 0.3)");
                path.setAttribute("stroke-width", "1");

                g.appendChild(path);

                // Position and rotate arrow
                // Direction: 0° = North (up), rotate clockwise
                g.setAttribute("transform", `translate(${x}, ${y}) rotate(${direction})`);

                group.appendChild(g);
            }
        },

        subscribe(callback: () => void): () => void {
            return tileCache.subscribe(callback);
        },

        destroy(): void {
            // TileStore is managed externally - nothing to clean up
        },
    };
}
