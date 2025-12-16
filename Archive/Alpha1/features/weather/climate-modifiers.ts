// src/features/weather/climate-modifiers.ts
// Apply per-hex climate modifiers to base climate templates

import type { ClimateTemplate } from "./weather-types";
import type { TileData } from "../maps/data/tile-repository";

/**
 * Apply per-hex climate modifiers to a base climate template.
 *
 * Modifiers are ADDITIVE (not overrides):
 * - Temperature: Base ± tile.climate.temperature offset
 * - Wind: Base + tile.climate.wind offset
 * - Cloud Cover/Sunlight: Affects visibility and weather probabilities
 *
 * @param baseClimate - Base climate template (from region/biome)
 * @param tileData - Optional tile data with climate modifiers
 * @returns Modified climate template with hex-specific adjustments
 */
export function applyClimateModifiers(
    baseClimate: ClimateTemplate,
    tileData: TileData | null
): ClimateTemplate {
    if (!tileData?.climate) {
        return baseClimate;
    }

    const modified: ClimateTemplate = { ...baseClimate };

    // Temperature modifiers
    if (tileData.climate.temperature) {
        const { min, max, avg } = tileData.climate.temperature;

        // Apply min/max offsets
        if (min !== undefined) {
            modified.baseTemperature = {
                ...modified.baseTemperature,
                min: modified.baseTemperature.min + min,
            };
        }

        if (max !== undefined) {
            modified.baseTemperature = {
                ...modified.baseTemperature,
                max: modified.baseTemperature.max + max,
            };
        }

        // Avg modifier shifts entire range
        if (avg !== undefined) {
            modified.baseTemperature = {
                min: modified.baseTemperature.min + avg,
                max: modified.baseTemperature.max + avg,
            };
        }
    }

    // Precipitation modifiers
    // Note: Precipitation affects weather probabilities (rain/snow)
    // This is applied in the weather generator when selecting weather type
    // For now, we just pass the climate template through unchanged
    // The weather generator will check tile.climate.precipitation separately

    // Wind modifiers
    // Note: Wind direction is not part of ClimateTemplate (only affects WeatherState)
    // Wind speed modifier is applied in weather generator when calculating wind speed

    // Cloud cover / Sunlight modifiers
    // Note: These affect visibility and weather type probabilities
    // Applied in weather generator when calculating visibility

    return modified;
}

/**
 * Calculate wind speed modifier from tile climate data
 *
 * @param tileData - Optional tile data with climate modifiers
 * @returns Wind speed offset (km/h), or 0 if no modifier
 */
export function getWindSpeedModifier(tileData: TileData | null): number {
    return tileData?.climate?.wind?.speed ?? 0;
}

/**
 * Calculate visibility modifier from tile climate data
 * Combines cloud cover and sunlight modifiers
 *
 * @param tileData - Optional tile data with climate modifiers
 * @returns Visibility multiplier (0.0 to 1.5+)
 */
export function getVisibilityModifier(tileData: TileData | null): number {
    if (!tileData?.climate) {
        return 1.0;
    }

    let multiplier = 1.0;

    // Cloud cover reduces visibility (0.0 = clear, 1.0 = overcast)
    if (tileData.climate.cloudCover !== undefined) {
        // More cloud cover → less visibility
        multiplier *= (1 - tileData.climate.cloudCover * 0.5);
    }

    // Sunlight increases visibility (-1.0 to +1.0)
    if (tileData.climate.sunlight !== undefined) {
        // More sunlight → better visibility
        multiplier *= (1 + tileData.climate.sunlight * 0.3);
    }

    return Math.max(0, multiplier);
}

/**
 * Calculate precipitation/fog probability boost from moisture
 * High moisture increases fog and rain probability
 *
 * @param tileData - Optional tile data with moisture level
 * @returns Precipitation multiplier (1.0 to 1.5)
 */
export function getMoisturePrecipitationBoost(tileData: TileData | null): number {
    if (!tileData?.moisture || tileData.moisture <= 0.6) {
        return 1.0; // No boost below 0.6
    }

    // Linear boost: 0.6 = 1.0x, 1.0 = 1.5x (50% increase)
    // Formula: 1.0 + (moisture - 0.6) * 1.25
    // Result range: 1.0 (at 0.6) to 1.5 (at 1.0)
    return 1.0 + (tileData.moisture - 0.6) * 1.25;
}
