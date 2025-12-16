// src/features/maps/overlay/layers/gradient-overlay-layer.ts
// Parameterized gradient overlay layer factory and layer implementations
//
// Provides:
// 1. Generic factory for gradient-based overlays (createGradientOverlayLayer)
// 2. Concrete layer implementations:
//    - Elevation: Underwater → Sea level → Mountains → Peaks
//    - Fertility: Barren → Moderate → Fertile
//    - Groundwater: Dry → Moderate → Saturated
//
// All gradient overlays follow the same pattern:
// - Extract numeric value from tile
// - Normalize to 0-1 range
// - Interpolate gradient color
// - Render as fill overlay
//
// CONSOLIDATED: Merged from gradient-overlay-layer.ts, elevation-overlay-layer.ts,
//               fertility-overlay-layer.ts, groundwater-overlay-layer.ts

import type { App, TFile } from "obsidian";
import { coordToKey } from "@geometry";
import type { AxialCoord, CoordKey } from "@geometry";
import type { TileCache, TileRecord } from "../../data/tile-cache";
import type { TileData } from "@services/domain/tile-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import type { HexStop } from "../../rendering/core/gradients";
import { interpolateHexGradient } from "../../rendering/core/gradients";
import { getMapSession } from "../../session";
import { LAYER_PRIORITY } from "../layer-registry";
import { getHexCoordsFromTiles } from "../layer-utils";

/**
 * Configuration for creating a gradient overlay layer
 *
 * Defines all parameters needed to create a gradient-based overlay:
 * - Layer metadata (id, name, priority)
 * - Gradient definition (color stops)
 * - Value extraction logic (how to get the numeric value from a tile)
 * - Value normalization range (min/max for the gradient)
 * - Opacity settings (default and optional dynamic calculation)
 * - Label formatting (optional)
 *
 * @example
 * ```typescript
 * const elevationConfig: GradientLayerConfig = {
 *   id: "elevation-overlay",
 *   name: "Elevation Overlay",
 *   priority: 49,
 *   gradient: ELEVATION_GRADIENT,
 *   getValue: (tile) => tile.elevation,
 *   range: { min: -100, max: 5000 },
 *   defaultOpacity: 0.5,
 *   getLabel: (value) => `${Math.round(value)}m`,
 *   getTooltip: (value) => `Elevation: ${Math.round(value)}m`,
 * };
 * ```
 */
export interface GradientLayerConfig {
    /**
     * Unique layer ID
     * Must be unique across all overlay layers
     */
    id: string;

    /**
     * Display name for UI
     * Shown in layer control panel and debug logs
     */
    name: string;

    /**
     * Layer priority for z-ordering
     * Higher priority = rendered on top
     *
     * Standard priorities:
     * - 0-9: Weather overlays, environmental effects
     * - 10-19: Location influence, region boundaries
     * - 20-29: Faction territories, political boundaries
     * - 30-39: Location markers, POIs
     * - 40-49: Climate overlays (elevation, fertility, etc.)
     * - 50+: Building indicators, UI overlays
     */
    priority: number;

    /**
     * Gradient stops (position 0-1, hex color)
     * Must be sorted by position (ascending)
     *
     * @example
     * ```typescript
     * [
     *   { position: 0.0, color: "#0000ff" },  // Blue at start
     *   { position: 0.5, color: "#ffffff" },  // White at middle
     *   { position: 1.0, color: "#ff0000" },  // Red at end
     * ]
     * ```
     */
    gradient: HexStop[];

    /**
     * Extract numeric value from tile
     * Return undefined to skip rendering this tile
     *
     * @param tile - Tile data (may be partial/undefined)
     * @returns Numeric value or undefined (skip tile)
     *
     * @example
     * ```typescript
     * getValue: (tile) => tile?.elevation ?? 0
     * getValue: (tile) => tile?.fertility  // Skip if undefined
     * ```
     */
    getValue: (tile: TileData | undefined) => number | undefined;

    /**
     * Value range for normalization
     * Values are clamped to this range before gradient interpolation
     *
     * @example
     * ```typescript
     * { min: -100, max: 5000 }  // Elevation in meters
     * { min: 0, max: 100 }      // Fertility/groundwater percentage
     * ```
     */
    range: { min: number; max: number };

    /**
     * Default opacity (0-1)
     * Applied to all tiles unless getOpacity() is provided
     *
     * @default 0.5
     */
    defaultOpacity?: number;

    /**
     * Optional dynamic opacity calculation
     * Override default opacity based on tile value
     *
     * @param value - Numeric value (raw, not normalized)
     * @returns Opacity (0-1)
     *
     * @example
     * ```typescript
     * // Higher elevation = more opaque
     * getOpacity: (value) => 0.2 + (Math.abs(value) / 3000) * 0.4
     * ```
     */
    getOpacity?: (value: number) => number;

    /**
     * Optional label formatter
     * Return label text or undefined to hide label
     *
     * @param value - Numeric value (raw, not normalized)
     * @returns Label text or undefined
     *
     * @example
     * ```typescript
     * getLabel: (value) => `${Math.round(value)}m`
     * getLabel: (value) => `${value.toFixed(1)}%`
     * ```
     */
    getLabel?: (value: number) => string | undefined;

    /**
     * Optional tooltip formatter
     * Return tooltip text or undefined to hide tooltip
     *
     * @param value - Numeric value (raw, not normalized)
     * @returns Tooltip text or undefined
     *
     * @example
     * ```typescript
     * getTooltip: (value) => `Elevation: ${Math.round(value)}m above sea level`
     * getTooltip: (value) => `Fertility: ${value}% (${getFertilityClass(value)})`
     * ```
     */
    getTooltip?: (value: number) => string | undefined;

    /**
     * Show labels by default
     * Can be toggled at runtime via layer.setShowLabels()
     *
     * @default true
     */
    showLabelsDefault?: boolean;
}

/**
 * Creates a gradient overlay layer from configuration
 *
 * Factory function that reduces boilerplate for gradient-based overlays.
 * All gradient overlays (elevation, fertility, groundwater, rain shadow, etc.)
 * follow the same pattern:
 * 1. Extract numeric value from tile
 * 2. Normalize to 0-1 range
 * 3. Interpolate gradient color
 * 4. Render as fill overlay
 *
 * This factory encapsulates that pattern, eliminating ~150 LOC of duplication
 * per overlay layer.
 *
 * @param config - Gradient layer configuration
 * @param tileStore - Tile store for reactive updates
 * @returns SimpleOverlayLayer implementation
 *
 * @example
 * ```typescript
 * // Create elevation overlay
 * const elevationLayer = createGradientOverlayLayer({
 *   id: "elevation-overlay",
 *   name: "Elevation Overlay",
 *   priority: 49,
 *   gradient: ELEVATION_GRADIENT,
 *   getValue: (tile) => tile?.elevation,
 *   range: { min: -100, max: 5000 },
 *   defaultOpacity: 0.5,
 *   getLabel: (value) => `${Math.round(value)}m`,
 *   getTooltip: (value) => `Elevation: ${Math.round(value)}m`,
 * }, tileStore);
 *
 * // Create fertility overlay
 * const fertilityLayer = createGradientOverlayLayer({
 *   id: "fertility-overlay",
 *   name: "Fertility Overlay",
 *   priority: 50,
 *   gradient: FERTILITY_GRADIENT,
 *   getValue: (tile) => tile?.fertility,
 *   range: { min: 0, max: 100 },
 *   getLabel: (value) => `${Math.round(value)}%`,
 * }, tileCache);
 * ```
 */
export function createGradientOverlayLayer(
    config: GradientLayerConfig,
    tileCache: TileCache
): SimpleOverlayLayer {
    // Local state
    let showLabels = config.showLabelsDefault ?? true;

    // Compute default opacity
    const defaultOpacity = config.defaultOpacity ?? 0.5;

    return {
        id: config.id,
        name: config.name,
        priority: config.priority,

        getCoordinates(): readonly AxialCoord[] {
            const state = tileCache.getState();
            if (!state.loaded) return [];

            return getHexCoordsFromTiles(state.tiles);
        },

        getRenderData(coord: AxialCoord): OverlayRenderData | null {
            const state = tileCache.getState();
            if (!state.loaded) return null;

            const key = coordToKey(coord);
            const record = state.tiles.get(key);
            const tileData = record?.data as TileData | undefined;

            // Extract value from tile (may be undefined)
            const rawValue = config.getValue(tileData);

            // Skip tile if no value
            if (rawValue === undefined) return null;

            // Normalize value to 0-1 range
            const { min, max } = config.range;
            const normalized = (rawValue - min) / (max - min);

            // Interpolate gradient color
            const color = interpolateHexGradient(normalized, config.gradient);

            // Calculate opacity (use custom function or default)
            const opacity = config.getOpacity ? config.getOpacity(rawValue) : defaultOpacity;

            // Build label (if formatter provided and labels enabled)
            const label =
                showLabels && config.getLabel
                    ? config.getLabel(rawValue)
                    : undefined;

            // Build tooltip (if formatter provided)
            const tooltip = config.getTooltip ? config.getTooltip(rawValue) : undefined;

            return {
                type: "fill",
                color,
                fillOpacity: String(opacity),
                strokeWidth: "0",
                metadata: {
                    label,
                    tooltip,
                    value: rawValue,
                },
            };
        },

        subscribe(callback: () => void): () => void {
            // TileCache.subscribe takes a callback that receives state
            // But SimpleOverlayLayer expects a no-arg callback
            return tileCache.subscribe(() => callback());
        },

        destroy(): void {
            // TileCache is managed externally - nothing to clean up
        },

        /**
         * Set whether labels should be shown
         * (Extension method, not part of SimpleOverlayLayer interface)
         */
        setShowLabels(show: boolean): void {
            showLabels = show;
        },
    };
}

// =============================================================================
// GRADIENT CONFIGURATIONS
// =============================================================================

/**
 * Elevation gradient stops
 * Deep Blue (underwater) → Cyan → Green → Yellow → Brown → White (peaks)
 */
const ELEVATION_GRADIENT: HexStop[] = [
    { position: 0.00, color: "#0066CC" },  // Deep Blue - underwater (-100m)
    { position: 0.02, color: "#00CCCC" },  // Cyan - sea level (0m)
    { position: 0.12, color: "#66CC66" },  // Green - lowlands (500m)
    { position: 0.31, color: "#CCCC00" },  // Yellow - hills (1500m)
    { position: 0.71, color: "#996633" },  // Brown - mountains (3500m)
    { position: 1.00, color: "#FFFFFF" },  // White - peaks (5000m)
];

/**
 * Fertility gradient stops
 * Gray (barren) → Yellow-Green → Forest Green (fertile)
 */
const FERTILITY_GRADIENT: HexStop[] = [
    { position: 0.0, color: "#808080" },  // Gray - barren
    { position: 0.5, color: "#9ACD32" },  // Yellow-Green
    { position: 1.0, color: "#228B22" },  // Forest Green - fertile
];

/**
 * Groundwater gradient stops
 * Tan (dry) → Light Blue → Deep Blue (saturated)
 */
const GROUNDWATER_GRADIENT: HexStop[] = [
    { position: 0.0, color: "#D4A574" },  // Tan - dry
    { position: 0.5, color: "#87CEEB" },  // Light Blue
    { position: 1.0, color: "#4169E1" },  // Deep Blue - saturated
];

// =============================================================================
// LAYER FACTORIES
// =============================================================================

/**
 * Create elevation overlay layer
 *
 * Renders elevation data as multi-color gradient from underwater to peaks.
 * Shows elevation with visual intensity matching deviation from sea level.
 * Priority: 49 (lowest climate layer, foundational base layer)
 *
 * Range: -100m to 5000m
 * Opacity: 0.2-0.6 (higher deviation from sea level = more opaque)
 *
 * @example
 * ```typescript
 * const elevationLayer = createElevationOverlayLayer(app, mapFile);
 * overlayManager.register(elevationLayer);
 * ```
 */
export function createElevationOverlayLayer(
    app: App,
    mapFile: TFile
): SimpleOverlayLayer {
    const { tileCache } = getMapSession(app, mapFile);

    const config: GradientLayerConfig = {
        id: "elevation-overlay",
        name: "Elevation Overlay",
        priority: LAYER_PRIORITY.CLIMATE - 1, // Priority 49 (foundational)

        gradient: ELEVATION_GRADIENT,

        getValue: (tile) => tile?.elevation ?? 0, // Default to sea level

        range: { min: -100, max: 5000 },

        // Greater deviation from sea level = more opaque
        getOpacity: (elevation: number) => {
            const deviation = Math.abs(elevation);
            const opacity = 0.2 + (deviation / 3000) * 0.4;
            return Math.min(0.6, opacity); // Cap at 60%
        },

        getLabel: (elevation: number) => `${Math.round(elevation)}m`,

        getTooltip: (elevation: number) => `Elevation: ${Math.round(elevation)}m`,
    };

    return createGradientOverlayLayer(config, tileCache);
}

/**
 * Create fertility overlay layer
 *
 * Renders fertility data as gray-to-green gradient.
 * Shows soil fertility levels with visual intensity matching fertility.
 * Priority: 51 (low base layer, above groundwater)
 *
 * Range: 0-100 (stored as 0.0-1.0)
 * Opacity: 0.15-0.55 (barren areas transparent, fertile areas semi-opaque)
 *
 * @example
 * ```typescript
 * const fertilityLayer = createFertilityOverlayLayer(app, mapFile);
 * overlayManager.register(fertilityLayer);
 * ```
 */
export function createFertilityOverlayLayer(
    app: App,
    mapFile: TFile
): SimpleOverlayLayer {
    const { tileCache } = getMapSession(app, mapFile);

    const config: GradientLayerConfig = {
        id: "fertility-overlay",
        name: "Fertility Overlay",
        priority: LAYER_PRIORITY.CLIMATE + 1, // Priority 51 (above groundwater)

        gradient: FERTILITY_GRADIENT,

        getValue: (tile) => tile?.fertility ?? 0.5, // Default to 50%

        range: { min: 0, max: 1 }, // Stored as 0.0-1.0

        // Higher fertility = more opaque
        getOpacity: (fertility: number) => 0.15 + fertility * 0.4,

        getLabel: (fertility: number) => `${Math.round(fertility * 100)}%`,

        getTooltip: (fertility: number) => `Fertility: ${Math.round(fertility * 100)}%`,
    };

    return createGradientOverlayLayer(config, tileCache);
}

/**
 * Create groundwater overlay layer
 *
 * Renders groundwater saturation data as tan-to-blue gradient.
 * Shows groundwater levels with visual intensity matching saturation.
 * Priority: 50 (CLIMATE priority, base environmental layer)
 *
 * Range: 0-100 (stored as 0.0-1.0)
 * Opacity: 0.15-0.55 (dry areas transparent, saturated areas semi-opaque)
 *
 * @example
 * ```typescript
 * const groundwaterLayer = createGroundwaterOverlayLayer(app, mapFile);
 * overlayManager.register(groundwaterLayer);
 * ```
 */
export function createGroundwaterOverlayLayer(
    app: App,
    mapFile: TFile
): SimpleOverlayLayer {
    const { tileCache } = getMapSession(app, mapFile);

    const config: GradientLayerConfig = {
        id: "groundwater-overlay",
        name: "Groundwater Overlay",
        priority: LAYER_PRIORITY.CLIMATE, // Priority 50 (base environmental layer)

        gradient: GROUNDWATER_GRADIENT,

        getValue: (tile) => tile?.groundwater ?? 0.5, // Default to 50%

        range: { min: 0, max: 1 }, // Stored as 0.0-1.0

        // Higher saturation = more opaque
        getOpacity: (groundwater: number) => 0.15 + groundwater * 0.4,

        getLabel: (groundwater: number) => `${Math.round(groundwater * 100)}%`,

        getTooltip: (groundwater: number) => `Groundwater: ${Math.round(groundwater * 100)}%`,
    };

    return createGradientOverlayLayer(config, tileCache);
}
