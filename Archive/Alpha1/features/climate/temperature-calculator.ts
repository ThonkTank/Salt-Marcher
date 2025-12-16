// src/features/climate/temperature-calculator.ts
// Calculate base temperature and phase temperatures
//
// Temperature = GlobalBase + SeasonalOffset - ElevationLapse + TempOffset
// PhaseTemp = minTemp + (amplitude * phaseFactor)

import type {
    DiurnalPhase,
    BaseTemperatureBreakdown,
    ClimateInputTile,
} from "./climate-types";
import {
    PHASE_TEMP_FACTORS,
    PHASES_IN_ORDER,
    ELEVATION_LAPSE_RATE,
    DEFAULT_GLOBAL_BASE_TEMP,
} from "./climate-types";

// ============================================================================
// Season Types
// ============================================================================

/**
 * Season enumeration for temperature calculation.
 * Note: These are northern hemisphere seasons by default.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * Seasonal temperature offsets from base temperature.
 * These modify the global base temp based on time of year.
 */
export const SEASONAL_OFFSETS: Readonly<Record<Season, number>> = Object.freeze({
    spring: 0,     // Neutral
    summer: 8,     // +8°C warmer
    autumn: 0,     // Neutral
    winter: -10,   // -10°C colder
});

// ============================================================================
// Base Temperature Calculation
// ============================================================================

/**
 * Calculate the base temperature for a tile.
 *
 * Base temperature is the "daily average" before applying diurnal variation.
 * It considers:
 * 1. Global map base temperature (world's average temp)
 * 2. Season (summer is warmer, winter is colder)
 * 3. Elevation (higher = colder, using lapse rate)
 * 4. Temperature offset (user-painted via Temperature Brush)
 *
 * @param tile Tile with elevation and climate.temperatureOffset
 * @param season Current season
 * @param globalBaseTemp Map-wide base temperature (default 15°C)
 * @returns Base temperature in °C
 *
 * @example
 * // Sea level in summer
 * calculateBaseTemperature({ elevation: 0 }, "summer", 15)
 * // => 23 (15 + 8 seasonal)
 *
 * // 3000m mountain in summer
 * calculateBaseTemperature({ elevation: 3000 }, "summer", 15)
 * // => 3.5 (15 + 8 - 19.5 elevation)
 *
 * // With +10°C user offset
 * calculateBaseTemperature({ climate: { temperatureOffset: 10 } }, "summer", 15)
 * // => 33 (15 + 8 + 10)
 */
export function calculateBaseTemperature(
    tile: ClimateInputTile | undefined,
    season: Season,
    globalBaseTemp: number = DEFAULT_GLOBAL_BASE_TEMP
): number {
    let temp = globalBaseTemp;

    // Seasonal offset
    temp += SEASONAL_OFFSETS[season] ?? 0;

    // Elevation lapse rate (-6.5°C per 1000m)
    const elevation = tile?.elevation ?? 0;
    if (elevation > 0) {
        temp -= (elevation / 1000) * ELEVATION_LAPSE_RATE;
    }

    // User-painted temperature offset
    const tempOffset = tile?.climate?.temperatureOffset ?? 0;
    temp += tempOffset;

    return temp;
}

/**
 * Calculate base temperature with full breakdown for UI display.
 *
 * @param tile Tile data
 * @param season Current season
 * @param globalBaseTemp Map-wide base temperature
 * @returns Detailed breakdown of temperature factors
 */
export function getBaseTemperatureBreakdown(
    tile: ClimateInputTile | undefined,
    season: Season,
    globalBaseTemp: number = DEFAULT_GLOBAL_BASE_TEMP
): BaseTemperatureBreakdown {
    const seasonalOffset = SEASONAL_OFFSETS[season] ?? 0;

    const elevation = tile?.elevation ?? 0;
    const elevationAdjustment = elevation > 0
        ? -(elevation / 1000) * ELEVATION_LAPSE_RATE
        : 0;

    const temperatureOffset = tile?.climate?.temperatureOffset ?? 0;

    const total = globalBaseTemp + seasonalOffset + elevationAdjustment + temperatureOffset;

    return {
        globalBase: globalBaseTemp,
        seasonalOffset,
        elevationAdjustment,
        temperatureOffset,
        total,
    };
}

/**
 * Format base temperature breakdown for display in inspector.
 *
 * @param breakdown Temperature breakdown from getBaseTemperatureBreakdown
 * @param tile Original tile for labels
 * @param season Current season
 * @returns Array of formatted strings for UI
 */
export function formatBaseTemperatureBreakdown(
    breakdown: BaseTemperatureBreakdown,
    tile: ClimateInputTile | undefined,
    season: Season
): string[] {
    const lines: string[] = [];

    // Global base is always shown
    lines.push(`Basis: ${breakdown.globalBase.toFixed(0)}°C`);

    // Seasonal offset
    if (breakdown.seasonalOffset !== 0) {
        const sign = breakdown.seasonalOffset > 0 ? "+" : "";
        const seasonLabel = getSeasonLabel(season);
        lines.push(`${seasonLabel}: ${sign}${breakdown.seasonalOffset.toFixed(0)}°C`);
    }

    // Elevation adjustment
    if (Math.abs(breakdown.elevationAdjustment) >= 0.5) {
        const elevation = tile?.elevation ?? 0;
        lines.push(`Elevation (${elevation}m): ${breakdown.elevationAdjustment.toFixed(1)}°C`);
    }

    // User temperature offset
    if (breakdown.temperatureOffset !== 0) {
        const sign = breakdown.temperatureOffset > 0 ? "+" : "";
        lines.push(`Temp-Offset: ${sign}${breakdown.temperatureOffset.toFixed(0)}°C`);
    }

    return lines;
}

/**
 * Get German label for season.
 */
export function getSeasonLabel(season: Season): string {
    const labels: Record<Season, string> = {
        spring: "Frühling",
        summer: "Sommer",
        autumn: "Herbst",
        winter: "Winter",
    };
    return labels[season];
}

// ============================================================================
// Phase Temperature Calculation
// ============================================================================

/**
 * Calculate temperature for a specific diurnal phase.
 *
 * The formula:
 * 1. minTemp = baseTemp - (amplitude / 2)
 * 2. phaseTemp = minTemp + (amplitude * phaseFactor)
 *
 * This ensures:
 * - Dawn (factor 0.05) ≈ minTemp
 * - Afternoon (factor 1.0) = minTemp + amplitude = maxTemp
 * - Average over all phases ≈ baseTemp
 *
 * @param baseTemp Daily base temperature
 * @param amplitude Diurnal amplitude (day/night swing)
 * @param phase Time of day
 * @returns Temperature in °C for that phase
 *
 * @example
 * // Base 20°C, amplitude 30°C (desert)
 * getPhaseTemperature(20, 30, "dawn")      // => 6.5 (cold night)
 * getPhaseTemperature(20, 30, "afternoon") // => 35 (hot day)
 */
export function getPhaseTemperature(
    baseTemp: number,
    amplitude: number,
    phase: DiurnalPhase
): number {
    const factor = PHASE_TEMP_FACTORS[phase];
    const minTemp = baseTemp - (amplitude / 2);
    return minTemp + (amplitude * factor);
}

/**
 * Calculate temperatures for all 6 diurnal phases.
 *
 * @param baseTemp Daily base temperature
 * @param amplitude Diurnal amplitude
 * @returns Object with temperature for each phase
 *
 * @example
 * getAllPhaseTemperatures(20, 30)
 * // => { dawn: 6.5, morning: 15.5, midday: 30.5, afternoon: 35, evening: 24.5, night: 9.5 }
 */
export function getAllPhaseTemperatures(
    baseTemp: number,
    amplitude: number
): Record<DiurnalPhase, number> {
    const result: Partial<Record<DiurnalPhase, number>> = {};

    for (const phase of PHASES_IN_ORDER) {
        result[phase] = getPhaseTemperature(baseTemp, amplitude, phase);
    }

    return result as Record<DiurnalPhase, number>;
}

/**
 * Get daily minimum and maximum temperatures.
 *
 * @param baseTemp Daily base temperature
 * @param amplitude Diurnal amplitude
 * @returns Object with min and max temperatures
 */
export function getDailyMinMax(
    baseTemp: number,
    amplitude: number
): { min: number; max: number } {
    const minTemp = baseTemp - (amplitude / 2);
    const maxTemp = minTemp + amplitude;
    return { min: minTemp, max: maxTemp };
}

// ============================================================================
// Season Helpers
// ============================================================================

/**
 * Determine season from day of year (northern hemisphere).
 *
 * Standard seasonal boundaries:
 * - Spring: Mar 20 - Jun 20 (days 79-171)
 * - Summer: Jun 21 - Sep 22 (days 172-265)
 * - Autumn: Sep 23 - Dec 20 (days 266-354)
 * - Winter: Dec 21 - Mar 19 (days 355-365, 1-78)
 *
 * @param dayOfYear Day number (1-365)
 * @returns Season for that day
 */
export function getSeasonFromDay(dayOfYear: number): Season {
    // Normalize to 1-365
    const day = ((dayOfYear - 1) % 365) + 1;

    if (day >= 79 && day <= 171) return "spring";
    if (day >= 172 && day <= 265) return "summer";
    if (day >= 266 && day <= 354) return "autumn";
    return "winter";
}

/**
 * Calculate seasonal offset using sine wave for smoother transitions.
 * Alternative to discrete seasonal offsets.
 *
 * Peak warmth at day 172 (summer solstice), coldest at day 355 (winter solstice).
 *
 * @param dayOfYear Day number (1-365)
 * @param amplitude Maximum seasonal swing (default 9°C, giving -9 to +9)
 * @returns Seasonal temperature offset
 */
export function getSeasonalSineOffset(
    dayOfYear: number,
    amplitude: number = 9
): number {
    // Day 172 = peak warmth (summer solstice)
    // Sine wave with period 365 days
    const phase = ((dayOfYear - 172) / 365) * 2 * Math.PI;
    return amplitude * Math.cos(phase);
}
