// src/services/climate/types.ts
// Type re-exports for climate service bridge
//
// This service provides a bridge to the climate feature, allowing other
// features and workmodes to access climate functionality without direct
// feature-to-feature dependencies.

// Re-export all commonly used climate types
export type {
    DiurnalPhase,
    AmplitudeBreakdown,
    BaseTemperatureBreakdown,
    ClimateCalculationResult,
    ClimateInputTile,
} from "@features/climate/climate-types";

export type {
    Season,
} from "@features/climate/temperature-calculator";

export type {
    RainShadowResult,
} from "@features/climate/rain-shadow-calculator";

export type {
    ClimateEngineConfig,
} from "@features/climate/climate-engine";

// Re-export constants and utility functions
export {
    // Phase constants
    PHASE_HOURS,
    PHASE_TEMP_FACTORS,
    PHASES_IN_ORDER,
    // Amplitude modifiers
    TERRAIN_AMPLITUDE_MODIFIERS,
    MOISTURE_AMPLITUDE_MODIFIERS,
    FLORA_AMPLITUDE_MODIFIERS,
    // Temperature constants
    ELEVATION_LAPSE_RATE,
    HIGH_ELEVATION_THRESHOLD,
    HIGH_ELEVATION_MAX_AMPLITUDE_BONUS,
    BASELINE_AMPLITUDE,
    DEFAULT_GLOBAL_BASE_TEMP,
    MIN_AMPLITUDE,
    MAX_AMPLITUDE,
    // Utility functions
    getPhaseFromHour,
    getRepresentativeHour,
    hasClimateData,
    getPhaseLabel,
    getPhaseAbbrev,
} from "@features/climate/climate-types";
