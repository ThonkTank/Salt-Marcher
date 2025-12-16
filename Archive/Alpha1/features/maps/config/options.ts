// src/core/options.ts
// Parser und Typen für Hex-Map Optionen.
//
// Map options are stored in the ```hex3x3 codeblock at the top of each map file.
// They include hex rendering settings (hexPixelSize) and climate settings (base temperature, wind direction).
//
// Example hex3x3 block:
// ```hex3x3
// hexPixelSize: 42
// baseTemperature: 15
// windDirection: 270
// basePrecipitation: 800
// sizeInDays: 14
// coastEdges: N,SE
// ```

import type { HexPixelSize } from "@services/geometry/geometry-types";
import { HexPixelSize as HexPixelSizeBuilder } from "@services/geometry/geometry-types";
import { HEX_BLOCK_CONTENT_REGEX } from "./constants";

/**
 * Compass direction used to identify hex edges with water.
 * N = North, NE = Northeast, SE = Southeast, S = South, SW = Southwest, NW = Northwest
 */
export type CompassDirection = "N" | "NE" | "SE" | "S" | "SW" | "NW";

/**
 * Map generation settings.
 * These settings are used during guided map creation to configure initial terrain distribution.
 */
export interface MapGenerationSettings {
    /** Edges with water/coast (e.g., ["N", "SE"]) */
    coastEdges: CompassDirection[];
    /** Original size input in travel days (used to calculate hex radius) */
    sizeInDays: number;
}

/**
 * Climate settings for a map.
 * These settings affect all climate calculations for tiles on this map.
 */
export interface MapClimateSettings {
    /** Global base temperature for the world in °C (default: 15°C) */
    globalBaseTemperature: number;
    /** Prevailing wind direction for rain shadow calculations in degrees (default: 270° = West) */
    globalWindDirection: number;
    /** Annual precipitation in mm (default: 800mm) */
    basePrecipitation: number;
}

/** Default climate settings for new maps */
export const DEFAULT_MAP_CLIMATE_SETTINGS: MapClimateSettings = {
    globalBaseTemperature: 15,
    globalWindDirection: 270,
    basePrecipitation: 800,
};

/**
 * Hex Map Options (JSON-only storage)
 *
 * After removing legacy .md tile support, only hexPixelSize is needed.
 * All tiles are stored in a single .tiles.json file adjacent to the map.
 */
export type HexOptions = {
    /** Hex size in pixels (default: 42, min: 12, max: 200) */
    hexPixelSize: HexPixelSize;
    /** Climate settings for this map */
    climate: MapClimateSettings;
    /** Optional generation settings (for guided map creation) */
    generation?: MapGenerationSettings;
};

/** Default hex options */
export const DEFAULT_HEX_OPTIONS: HexOptions = {
    hexPixelSize: HexPixelSizeBuilder.DEFAULT,
    climate: DEFAULT_MAP_CLIMATE_SETTINGS,
};

/**
 * Parse hex map options from markdown codeblock.
 *
 * Extracts ```hex3x3 block content and parses hexPixelSize, climate settings, and generation settings.
 * Supports both `hexPixelSize:` (new) and `radius:` (legacy) for backward compatibility.
 * Ignores legacy folder/folderPrefix/prefix keys (backward compatible).
 *
 * @param src - Full markdown content or codeblock content
 * @returns Parsed options with defaults applied
 */
export function parseOptions(src: string): HexOptions {
    // Extract hexmap/hex3x3 codeblock if present
    const blockMatch = src.match(HEX_BLOCK_CONTENT_REGEX);
    // Capture group 1 is identifier (hex3x3|hexmap), group 2 is content
    const body = blockMatch ? blockMatch[2] : src;

    // Start with defaults
    const options: HexOptions = {
        ...DEFAULT_HEX_OPTIONS,
        climate: { ...DEFAULT_MAP_CLIMATE_SETTINGS }
    };

    // Track generation settings separately
    let sizeInDays: number | undefined;
    let coastEdges: CompassDirection[] | undefined;

    // Parse key-value lines
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const match = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(line);
        if (!match) continue;

        const key = match[1].toLowerCase();
        const value = match[2].trim();

        // Parse hexPixelSize (new) or radius (legacy)
        if (key === "hexpixelsize" || key === "radius") {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed >= 12 && parsed <= 200) {
                options.hexPixelSize = HexPixelSizeBuilder.create(parsed);
            }
        }
        // Parse climate settings
        else if (key === "basetemperature" || key === "globalbasetemperature") {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
                options.climate.globalBaseTemperature = parsed;
            }
        }
        else if (key === "winddirection" || key === "globalwinddirection") {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
                // Normalize to 0-360 range
                options.climate.globalWindDirection = ((parsed % 360) + 360) % 360;
            }
        }
        else if (key === "baseprecipitation") {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed >= 0) {
                options.climate.basePrecipitation = parsed;
            }
        }
        // Parse generation settings
        else if (key === "sizeindays") {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
                sizeInDays = parsed;
            }
        }
        else if (key === "coastedges") {
            // Parse comma-separated compass directions (e.g., "N,SE,SW")
            const directions = value
                .split(",")
                .map(d => d.trim().toUpperCase())
                .filter(d => ["N", "NE", "SE", "S", "SW", "NW"].includes(d)) as CompassDirection[];
            if (directions.length > 0) {
                coastEdges = directions;
            }
        }
    }

    // Add generation settings if both fields are present
    if (sizeInDays !== undefined && coastEdges !== undefined) {
        options.generation = { sizeInDays, coastEdges };
    }

    // Validate hexPixelSize bounds (should be guaranteed by builder, but double-check)
    const pixelValue = options.hexPixelSize as number;
    if (pixelValue < 12) {
        options.hexPixelSize = HexPixelSizeBuilder.create(12);
    } else if (pixelValue > 200) {
        options.hexPixelSize = HexPixelSizeBuilder.create(200);
    }

    return options;
}
