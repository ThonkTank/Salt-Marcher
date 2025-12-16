// src/features/climate/amplitude-calculator.ts
// Calculate diurnal temperature amplitude from terrain properties
//
// Amplitude = how much temperature swings between day and night.
// Deserts: 35°C+ swing. Coastal/swampy: ~3°C swing.

import type { AmplitudeBreakdown, ClimateInputTile } from "./climate-types";
import {
    TERRAIN_AMPLITUDE_MODIFIERS,
    MOISTURE_AMPLITUDE_MODIFIERS,
    FLORA_AMPLITUDE_MODIFIERS,
    BASELINE_AMPLITUDE,
    HIGH_ELEVATION_THRESHOLD,
    HIGH_ELEVATION_MAX_AMPLITUDE_BONUS,
    MIN_AMPLITUDE,
    MAX_AMPLITUDE,
} from "./climate-types";

/**
 * Calculate the diurnal amplitude (day/night temperature swing) for a tile.
 *
 * Amplitude is derived from:
 * 1. Terrain type (mountains = more swing due to thin atmosphere)
 * 2. Moisture level (water = stability, desert = extreme swings)
 * 3. Flora type (vegetation = stability, barren = swings)
 * 4. Elevation (>1500m = thinner atmosphere = more swings)
 *
 * @param tile Tile data with terrain, moisture, flora, elevation
 * @returns Calculated amplitude in °C (clamped to MIN_AMPLITUDE-MAX_AMPLITUDE)
 *
 * @example
 * // Desert: extreme swings
 * calculateDiurnalAmplitude({ moisture: "desert" })
 * // => 28 (8 baseline + 20 desert)
 *
 * // Swamp with dense vegetation: minimal swings
 * calculateDiurnalAmplitude({ moisture: "swampy", flora: "dense" })
 * // => 2 (8 - 8 - 8, clamped to 2)
 *
 * // High mountain: extreme swings
 * calculateDiurnalAmplitude({ terrain: "mountains", moisture: "dry", elevation: 3000 })
 * // => 26 (8 + 10 + 8 + ~3 elevation)
 */
export function calculateDiurnalAmplitude(tile: ClimateInputTile | undefined): number {
    if (!tile) return BASELINE_AMPLITUDE;

    let amplitude = BASELINE_AMPLITUDE;

    // Terrain modifier
    if (tile.terrain) {
        amplitude += TERRAIN_AMPLITUDE_MODIFIERS[tile.terrain] ?? 0;
    }

    // Moisture modifier (biggest influence!)
    if (tile.moisture) {
        amplitude += MOISTURE_AMPLITUDE_MODIFIERS[tile.moisture] ?? 0;
    }

    // Flora modifier
    if (tile.flora) {
        amplitude += FLORA_AMPLITUDE_MODIFIERS[tile.flora] ?? 0;
    }

    // High elevation bonus (thin atmosphere)
    const elevation = tile.elevation ?? 0;
    if (elevation > HIGH_ELEVATION_THRESHOLD) {
        // Linear increase from 0 to MAX_BONUS over 2500m above threshold
        const heightAboveThreshold = elevation - HIGH_ELEVATION_THRESHOLD;
        const bonus = Math.min(
            HIGH_ELEVATION_MAX_AMPLITUDE_BONUS,
            (heightAboveThreshold / 2500) * HIGH_ELEVATION_MAX_AMPLITUDE_BONUS
        );
        amplitude += bonus;
    }

    // Clamp to reasonable bounds
    return Math.max(MIN_AMPLITUDE, Math.min(MAX_AMPLITUDE, amplitude));
}

/**
 * Calculate amplitude with full breakdown for UI display.
 *
 * Returns detailed information about each factor's contribution,
 * allowing the inspector to show "why" a hex has its climate.
 *
 * @param tile Tile data
 * @returns Breakdown of all amplitude contributions
 *
 * @example
 * const breakdown = getAmplitudeBreakdown({ terrain: "mountains", moisture: "desert" });
 * // breakdown = {
 * //   baseline: 8,
 * //   terrainContribution: 10,
 * //   moistureContribution: 20,
 * //   floraContribution: 0,
 * //   elevationContribution: 0,
 * //   total: 38
 * // }
 */
export function getAmplitudeBreakdown(tile: ClimateInputTile | undefined): AmplitudeBreakdown {
    const baseline = BASELINE_AMPLITUDE;
    const terrainContribution = tile?.terrain
        ? (TERRAIN_AMPLITUDE_MODIFIERS[tile.terrain] ?? 0)
        : 0;
    const moistureContribution = tile?.moisture
        ? (MOISTURE_AMPLITUDE_MODIFIERS[tile.moisture] ?? 0)
        : 0;
    const floraContribution = tile?.flora
        ? (FLORA_AMPLITUDE_MODIFIERS[tile.flora] ?? 0)
        : 0;

    // High elevation contribution
    let elevationContribution = 0;
    const elevation = tile?.elevation ?? 0;
    if (elevation > HIGH_ELEVATION_THRESHOLD) {
        const heightAboveThreshold = elevation - HIGH_ELEVATION_THRESHOLD;
        elevationContribution = Math.min(
            HIGH_ELEVATION_MAX_AMPLITUDE_BONUS,
            (heightAboveThreshold / 2500) * HIGH_ELEVATION_MAX_AMPLITUDE_BONUS
        );
    }

    // Calculate raw total
    const rawTotal = baseline
        + terrainContribution
        + moistureContribution
        + floraContribution
        + elevationContribution;

    // Clamp total
    const total = Math.max(MIN_AMPLITUDE, Math.min(MAX_AMPLITUDE, rawTotal));

    return {
        baseline,
        terrainContribution,
        moistureContribution,
        floraContribution,
        elevationContribution,
        total,
    };
}

/**
 * Format amplitude breakdown for display in inspector.
 *
 * @param breakdown Amplitude breakdown from getAmplitudeBreakdown
 * @param tile Original tile for labels
 * @returns Array of formatted strings for UI
 *
 * @example
 * formatAmplitudeBreakdown(breakdown, tile)
 * // => [
 * //   "Terrain (mountains): +10°C",
 * //   "Moisture (desert): +20°C",
 * //   "Elevation (3000m): +3°C"
 * // ]
 */
export function formatAmplitudeBreakdown(
    breakdown: AmplitudeBreakdown,
    tile: ClimateInputTile | undefined
): string[] {
    const lines: string[] = [];

    // Only show non-zero contributions
    if (breakdown.terrainContribution !== 0 && tile?.terrain) {
        const sign = breakdown.terrainContribution > 0 ? "+" : "";
        lines.push(`Terrain (${tile.terrain}): ${sign}${breakdown.terrainContribution.toFixed(0)}°C Amp`);
    }

    if (breakdown.moistureContribution !== 0 && tile?.moisture) {
        const sign = breakdown.moistureContribution > 0 ? "+" : "";
        lines.push(`Moisture (${tile.moisture}): ${sign}${breakdown.moistureContribution.toFixed(0)}°C Amp`);
    }

    if (breakdown.floraContribution !== 0 && tile?.flora) {
        const sign = breakdown.floraContribution > 0 ? "+" : "";
        lines.push(`Flora (${tile.flora}): ${sign}${breakdown.floraContribution.toFixed(0)}°C Amp`);
    }

    if (breakdown.elevationContribution > 0.5 && tile?.elevation) {
        lines.push(`Elevation (${tile.elevation}m): +${breakdown.elevationContribution.toFixed(1)}°C Amp`);
    }

    return lines;
}

/**
 * Get a human-readable description of the amplitude.
 */
export function getAmplitudeDescription(amplitude: number): string {
    if (amplitude < 5) return "Sehr stabil (maritim)";
    if (amplitude < 10) return "Stabil";
    if (amplitude < 15) return "Gemäßigt";
    if (amplitude < 25) return "Variabel";
    if (amplitude < 35) return "Extrem variabel";
    return "Extreme Schwankungen (Wüste)";
}
