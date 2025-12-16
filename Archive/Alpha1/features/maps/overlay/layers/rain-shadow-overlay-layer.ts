// src/features/maps/overlay/layers/rain-shadow-overlay-layer.ts
// Rain shadow overlay layer - visualizes precipitation blocking by mountains
//
// Renders rain shadow effects as gradient overlays from green (minimal) to brown (severe).
// Shows percentage labels on affected hexes with tooltips indicating blocking mountains.
//
// NOTE: This layer cannot use the gradient factory because it requires:
// - Cross-tile computation (calculateRainShadowMap)
// - Custom state management (shadowMap cache, recalculation)
// - RGBA colors with embedded alpha (not supported by factory)

import type { App, TFile } from "obsidian";
import { coordToKey } from "@geometry";
import type { AxialCoord } from "@geometry";
import { getMapSession } from "../../session";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import {
    calculateRainShadowMap,
    type RainShadowResult,
} from "@services/climate";
import { getHexCoordsFromTiles } from "../layer-utils";

/**
 * Rain shadow color thresholds and colors
 * Green (minimal) → Yellow (moderate) → Brown (heavy)
 */
interface ColorThreshold {
    /** Intensity threshold (0.0 to 1.0) */
    threshold: number;
    /** RGB color components */
    r: number;
    g: number;
    b: number;
    /** Base opacity range */
    opacityMin: number;
    opacityMax: number;
}

const RAIN_SHADOW_THRESHOLDS: ColorThreshold[] = [
    { threshold: 0.25, r: 76, g: 175, b: 80, opacityMin: 0.2, opacityMax: 0.6 },   // Green (0-12.5% reduction)
    { threshold: 0.5, r: 255, g: 193, b: 7, opacityMin: 0.3, opacityMax: 0.8 },    // Yellow (12.5-25% reduction)
    { threshold: 1.0, r: 121, g: 85, b: 72, opacityMin: 0.4, opacityMax: 1.0 },    // Brown (25%+ reduction)
];

/**
 * Calculate rain shadow color based on intensity
 * Green (minimal shadow) → Yellow (moderate shadow) → Brown (heavy shadow)
 *
 * @param modifier Precipitation modifier (-0.5 to 0, negative = drier)
 * @returns RGBA color string with opacity
 */
function getRainShadowColor(modifier: number): string {
    // modifier is -0.5 to 0 (negative = drier)
    // Convert to intensity: 0 to 1 (0 = no shadow, 1 = maximum shadow)
    const intensity = Math.abs(modifier) * 2; // -0.5 -> 1.0, 0 -> 0.0

    // Find the appropriate threshold
    for (const threshold of RAIN_SHADOW_THRESHOLDS) {
        if (intensity < threshold.threshold) {
            const alpha = threshold.opacityMin + (intensity / threshold.threshold) * (threshold.opacityMax - threshold.opacityMin);
            return `rgba(${threshold.r}, ${threshold.g}, ${threshold.b}, ${alpha})`;
        }
    }

    // Heavy shadow (fallback)
    const lastThreshold = RAIN_SHADOW_THRESHOLDS[RAIN_SHADOW_THRESHOLDS.length - 1];
    const alpha = lastThreshold.opacityMin + (intensity - RAIN_SHADOW_THRESHOLDS[RAIN_SHADOW_THRESHOLDS.length - 2].threshold) * (lastThreshold.opacityMax - lastThreshold.opacityMin);
    return `rgba(${lastThreshold.r}, ${lastThreshold.g}, ${lastThreshold.b}, ${alpha})`;
}

/**
 * Calculate fill opacity based on shadow intensity
 * Stronger shadows = more opaque
 */
function getRainShadowOpacity(modifier: number): number {
    const intensity = Math.abs(modifier) * 2; // 0 to 1

    // Minimal shadow (0-12.5%): 0.15-0.25 opacity
    // Moderate shadow (12.5-25%): 0.25-0.4 opacity
    // Heavy shadow (25%+): 0.4-0.6 opacity
    const baseOpacity = 0.15;
    const maxOpacity = 0.6;

    return baseOpacity + intensity * (maxOpacity - baseOpacity);
}

/**
 * Format rain shadow percentage for label display
 *
 * @param modifier Precipitation modifier (-0.5 to 0)
 * @returns Formatted percentage string (e.g., "-25%")
 */
function formatShadowPercentage(modifier: number): string {
    const percentage = Math.round(modifier * 100);
    return `${percentage}%`;
}

/**
 * Create rain shadow overlay layer
 *
 * Renders rain shadow effects as colored overlays with percentage labels.
 * Priority: 4 (after temperature/precipitation/cloudcover, before weather)
 *
 * @param app Obsidian app instance
 * @param mapFile Map file (for tile store scoping)
 * @param defaultWindDirection Default wind direction in degrees (default: 270° = West wind)
 *
 * @example
 * ```typescript
 * const rainShadowLayer = createRainShadowOverlayLayer(app, mapFile, 270);
 * overlayManager.register(rainShadowLayer);
 * ```
 */
export function createRainShadowOverlayLayer(
    app: App,
    mapFile: TFile,
    defaultWindDirection: number = 270 // Default: West wind
): SimpleOverlayLayer {
    const { tileCache } = getMapSession(app, mapFile);

    // Local state for rain shadow calculations
    let shadowMap = new Map<string, RainShadowResult>();
    let windDirection = defaultWindDirection;

    /**
     * Recalculate rain shadows for entire map
     * Called when tile data changes
     */
    function recalculateShadows(): void {
        const state = tileCache.getState();
        if (!state.loaded) {
            shadowMap = new Map();
            return;
        }

        // Build elevation map for rain shadow calculator
        const elevationMap = new Map<string, { elevation?: number }>();
        for (const record of state.tiles.values()) {
            const key = coordToKey(record.coord);
            elevationMap.set(key, {
                elevation: record.data.elevation,
            });
        }

        // Calculate rain shadows for entire map
        shadowMap = calculateRainShadowMap(elevationMap, windDirection);
    }

    // Initial calculation
    recalculateShadows();

    return {
        id: "rain-shadow-overlay",
        name: "Rain Shadow Overlay",
        priority: 4,

        getCoordinates(): readonly AxialCoord[] {
            const state = tileCache.getState();
            if (!state.loaded) return [];

            return getHexCoordsFromTiles(shadowMap);
        },

        getRenderData(coord: AxialCoord): OverlayRenderData | null {
            const key = coordToKey(coord);
            const shadowResult = shadowMap.get(key);

            if (!shadowResult) {
                return null; // No rain shadow at this coordinate
            }

            const color = getRainShadowColor(shadowResult.modifier);
            const opacity = getRainShadowOpacity(shadowResult.modifier);

            const percentageLabel = formatShadowPercentage(shadowResult.modifier);
            const blockingCoordStr = `(${shadowResult.blockingCoord.q},${shadowResult.blockingCoord.r})`;
            const tooltip = `Rain Shadow: ${percentageLabel}\nBlocked by mountain at ${blockingCoordStr}`;

            return {
                type: "fill",
                color,
                fillOpacity: String(opacity),
                strokeWidth: "0",
                metadata: {
                    label: percentageLabel,
                    tooltip,
                    modifier: shadowResult.modifier,
                    blockingCoord: shadowResult.blockingCoord,
                    blockingElevation: shadowResult.blockingElevation,
                    distance: shadowResult.distance,
                    shadowRange: shadowResult.shadowRange,
                },
            };
        },

        subscribe(callback: () => void): () => void {
            return tileCache.subscribe(() => {
                // Recalculate shadows when tile data changes
                recalculateShadows();
                callback();
            });
        },

        destroy(): void {
            // Clear local state
            shadowMap.clear();
        },
    };
}
