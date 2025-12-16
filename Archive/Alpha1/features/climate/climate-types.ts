// src/features/climate/types.ts
// Diurnal phase types and constants for terrain-derived climate calculations
//
// Climate is DERIVED from terrain properties (terrain, moisture, elevation, flora)
// plus a single editable temperature offset. No climate presets needed.

import type { TileData, TerrainType, FloraType, MoistureLevel } from "@domain";

// ============================================================================
// Diurnal Phase Types
// ============================================================================

/**
 * Six discrete phases of the day for temperature calculation.
 *
 * Design rationale: Discrete phases instead of continuous sine wave
 * because D&D gameplay typically operates in discrete time blocks
 * (travel by day, rest at night, etc.)
 */
export type DiurnalPhase =
    | "dawn"      // 5:00-7:59  - Coldest period, sun just rising
    | "morning"   // 8:00-11:59 - Warming up
    | "midday"    // 12:00-14:59 - Near peak heat
    | "afternoon" // 15:00-17:59 - Peak heat (thermal lag)
    | "evening"   // 18:00-20:59 - Cooling down
    | "night";    // 21:00-4:59  - Cold, dark period

/**
 * Hour ranges for each phase [startHour, endHour] (inclusive).
 * Uses 24-hour format.
 */
export const PHASE_HOURS: Readonly<Record<DiurnalPhase, readonly [number, number]>> = Object.freeze({
    dawn: [5, 7],
    morning: [8, 11],
    midday: [12, 14],
    afternoon: [15, 17],
    evening: [18, 20],
    night: [21, 4], // Wraps around midnight
});

/**
 * Temperature factor for each phase (0.0 = minimum temp, 1.0 = maximum temp).
 *
 * This factor is multiplied by the diurnal amplitude to get the temperature
 * offset from the daily minimum.
 *
 * Example with amplitude 20°C and base temp 15°C:
 * - minTemp = 15 - 10 = 5°C
 * - dawn (0.05): 5 + 0.05 * 20 = 6°C
 * - afternoon (1.0): 5 + 1.0 * 20 = 25°C
 */
export const PHASE_TEMP_FACTORS: Readonly<Record<DiurnalPhase, number>> = Object.freeze({
    dawn: 0.05,       // Near daily minimum
    morning: 0.35,    // Rising
    midday: 0.85,     // High but not peak (sun overhead but thermal lag)
    afternoon: 1.00,  // Daily maximum (peak due to thermal lag)
    evening: 0.65,    // Dropping
    night: 0.15,      // Low but slightly warmer than dawn
});

/**
 * All phases in chronological order (starting from dawn).
 */
export const PHASES_IN_ORDER: readonly DiurnalPhase[] = Object.freeze([
    "dawn",
    "morning",
    "midday",
    "afternoon",
    "evening",
    "night",
]);

// ============================================================================
// Amplitude Modifiers
// ============================================================================

/**
 * Terrain contribution to diurnal amplitude (°C).
 * Mountains have more extreme day/night swings due to thin atmosphere.
 */
export const TERRAIN_AMPLITUDE_MODIFIERS: Readonly<Record<TerrainType, number>> = Object.freeze({
    plains: 0,
    hills: 5,
    mountains: 10,
});

/**
 * Moisture contribution to diurnal amplitude (°C).
 * Water has HIGH thermal mass → dampens temperature swings.
 * Deserts have LOW thermal mass → extreme swings.
 */
export const MOISTURE_AMPLITUDE_MODIFIERS: Readonly<Record<MoistureLevel, number>> = Object.freeze({
    desert: 20,        // Extreme swings (35°C+ day/night difference)
    dry: 8,            // High swings
    lush: 0,           // Baseline
    marshy: -5,        // Dampened by water
    swampy: -8,        // More water = more stable
    ponds: -10,        // Water bodies moderate temperature
    lakes: -12,        // Lakes provide thermal stability
    large_lake: -15,   // Large water bodies strongly moderate
    sea: -18,          // Ocean = extremely stable temperatures
    flood_plains: -6,  // Seasonal water, moderate dampening
});

/**
 * Flora contribution to diurnal amplitude (°C).
 * Vegetation provides shade and evapotranspiration cooling.
 */
export const FLORA_AMPLITUDE_MODIFIERS: Readonly<Record<FloraType, number>> = Object.freeze({
    dense: -8,    // Forest canopy stabilizes temperature
    medium: -4,   // Moderate vegetation cover
    field: -2,    // Light ground cover
    barren: 5,    // No vegetation = more extreme swings
});

// ============================================================================
// Temperature Constants
// ============================================================================

/**
 * Environmental lapse rate: temperature decrease per 1000m elevation.
 * Standard atmospheric value is 6.5°C per 1000m.
 */
export const ELEVATION_LAPSE_RATE = 6.5; // °C per 1000m

/**
 * Elevation threshold for additional amplitude from thin atmosphere.
 * Above 1500m, the thinner air allows more extreme temperature swings.
 */
export const HIGH_ELEVATION_THRESHOLD = 1500; // meters

/**
 * Maximum additional amplitude from high elevation.
 */
export const HIGH_ELEVATION_MAX_AMPLITUDE_BONUS = 5; // °C

/**
 * Baseline diurnal amplitude for temperate climate with no modifiers.
 */
export const BASELINE_AMPLITUDE = 8; // °C

/**
 * Default global base temperature for maps (temperate Earth average).
 */
export const DEFAULT_GLOBAL_BASE_TEMP = 15; // °C

/**
 * Amplitude bounds to prevent unrealistic values.
 */
export const MIN_AMPLITUDE = 2; // °C (maritime tropical minimum)
export const MAX_AMPLITUDE = 50; // °C (extreme desert maximum)

// ============================================================================
// Result Interfaces
// ============================================================================

/**
 * Result of amplitude calculation with source breakdown.
 * Allows UI to show WHY the amplitude is what it is.
 */
export interface AmplitudeBreakdown {
    /** Base amplitude before modifiers */
    baseline: number;
    /** Contribution from terrain type */
    terrainContribution: number;
    /** Contribution from moisture level */
    moistureContribution: number;
    /** Contribution from flora type */
    floraContribution: number;
    /** Additional contribution from high elevation */
    elevationContribution: number;
    /** Final calculated amplitude (clamped) */
    total: number;
}

/**
 * Result of base temperature calculation with source breakdown.
 */
export interface BaseTemperatureBreakdown {
    /** Global map base temperature */
    globalBase: number;
    /** Seasonal temperature offset */
    seasonalOffset: number;
    /** Elevation lapse rate adjustment */
    elevationAdjustment: number;
    /** User-painted temperature offset (from Temperature Brush) */
    temperatureOffset: number;
    /** Final base temperature */
    total: number;
}

/**
 * Complete climate calculation result for a single tile.
 */
export interface ClimateCalculationResult {
    /** Temperature at the requested hour/phase */
    temperature: number;
    /** Current diurnal phase */
    phase: DiurnalPhase;
    /** Base temperature (daily average) */
    baseTemperature: number;
    /** Diurnal amplitude (max - min temperature) */
    amplitude: number;
    /** All phase temperatures for the day */
    phaseTemperatures: Record<DiurnalPhase, number>;
    /** Detailed amplitude breakdown for UI */
    amplitudeBreakdown: AmplitudeBreakdown;
    /** Detailed base temperature breakdown for UI */
    baseBreakdown: BaseTemperatureBreakdown;
}

/**
 * Minimal tile data required for climate calculations.
 * Subset of TileData interface to avoid circular dependencies.
 */
export interface ClimateInputTile {
    terrain?: TerrainType;
    moisture?: MoistureLevel;
    flora?: FloraType;
    elevation?: number;
    climate?: {
        temperatureOffset?: number;
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the diurnal phase for a given hour of day.
 *
 * @param hour Hour in 24-hour format (0-23)
 * @returns The diurnal phase for that hour
 *
 * @example
 * getPhaseFromHour(6)   // => "dawn"
 * getPhaseFromHour(14)  // => "midday"
 * getPhaseFromHour(22)  // => "night"
 * getPhaseFromHour(3)   // => "night"
 */
export function getPhaseFromHour(hour: number): DiurnalPhase {
    // Normalize hour to 0-23
    const normalizedHour = ((hour % 24) + 24) % 24;

    // Night wraps around midnight (21-4)
    if (normalizedHour >= 21 || normalizedHour <= 4) {
        return "night";
    }
    if (normalizedHour >= 5 && normalizedHour <= 7) {
        return "dawn";
    }
    if (normalizedHour >= 8 && normalizedHour <= 11) {
        return "morning";
    }
    if (normalizedHour >= 12 && normalizedHour <= 14) {
        return "midday";
    }
    if (normalizedHour >= 15 && normalizedHour <= 17) {
        return "afternoon";
    }
    // 18-20
    return "evening";
}

/**
 * Get the representative hour for a phase (midpoint).
 * Useful for weather generation or simulation.
 */
export function getRepresentativeHour(phase: DiurnalPhase): number {
    switch (phase) {
        case "dawn": return 6;
        case "morning": return 10;
        case "midday": return 13;
        case "afternoon": return 16;
        case "evening": return 19;
        case "night": return 1; // Middle of night period
    }
}

/**
 * Check if a tile has valid climate input data.
 */
export function hasClimateData(tile: ClimateInputTile | undefined): boolean {
    if (!tile) return false;
    // At minimum, we need terrain OR moisture to calculate amplitude
    return tile.terrain !== undefined || tile.moisture !== undefined;
}

/**
 * Get the German label for a diurnal phase.
 */
export function getPhaseLabel(phase: DiurnalPhase): string {
    const labels: Record<DiurnalPhase, string> = {
        dawn: "Morgendämmerung",
        morning: "Morgen",
        midday: "Mittag",
        afternoon: "Nachmittag",
        evening: "Abend",
        night: "Nacht",
    };
    return labels[phase];
}

/**
 * Get short English abbreviation for a phase (for graphs).
 */
export function getPhaseAbbrev(phase: DiurnalPhase): string {
    const abbrevs: Record<DiurnalPhase, string> = {
        dawn: "Dawn",
        morning: "Morn",
        midday: "Mid",
        afternoon: "Aftn",
        evening: "Eve",
        night: "Ngt",
    };
    return abbrevs[phase];
}
