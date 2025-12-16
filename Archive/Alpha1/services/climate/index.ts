// src/services/climate/index.ts
// Barrel export for climate service bridge
//
// This service provides access to climate feature functionality for other
// features and workmodes, avoiding direct feature-to-feature dependencies.

// Export all types
export type {
    DiurnalPhase,
    AmplitudeBreakdown,
    BaseTemperatureBreakdown,
    ClimateCalculationResult,
    ClimateInputTile,
    Season,
    RainShadowResult,
    ClimateEngineConfig,
} from "./climate-types";

// Export constants and utilities from types
export {
    PHASE_HOURS,
    PHASE_TEMP_FACTORS,
    PHASES_IN_ORDER,
    TERRAIN_AMPLITUDE_MODIFIERS,
    MOISTURE_AMPLITUDE_MODIFIERS,
    FLORA_AMPLITUDE_MODIFIERS,
    ELEVATION_LAPSE_RATE,
    HIGH_ELEVATION_THRESHOLD,
    HIGH_ELEVATION_MAX_AMPLITUDE_BONUS,
    BASELINE_AMPLITUDE,
    DEFAULT_GLOBAL_BASE_TEMP,
    MIN_AMPLITUDE,
    MAX_AMPLITUDE,
    getPhaseFromHour,
    getRepresentativeHour,
    hasClimateData,
    getPhaseLabel,
    getPhaseAbbrev,
} from "./climate-types";

// Export all climate bridge functionality
export {
    // Climate Engine
    getClimateEngine,
    ClimateEngine,
    resetClimateEngine,
    // Amplitude Calculator
    calculateDiurnalAmplitude,
    getAmplitudeBreakdown,
    formatAmplitudeBreakdown,
    getAmplitudeDescription,
    // Temperature Calculator
    SEASONAL_OFFSETS,
    calculateBaseTemperature,
    getBaseTemperatureBreakdown,
    formatBaseTemperatureBreakdown,
    getSeasonLabel,
    getPhaseTemperature,
    getAllPhaseTemperatures,
    getDailyMinMax,
    getSeasonFromDay,
    getSeasonalSineOffset,
    // Rain Shadow Calculator
    MOUNTAIN_THRESHOLD,
    MAX_SHADOW_RANGE,
    MAX_SHADOW_MODIFIER,
    DEFAULT_MAX_RAYCAST_DISTANCE,
    CACHE_SIZE,
    WIND_BUCKET_SIZE,
    bearingToHexDirection,
    oppositeDirection,
    calculateShadowRange,
    calculateShadowModifier,
    calculateRainShadow,
    calculateRainShadowMap,
    clearRainShadowCache,
    getRainShadowCacheSize,
    formatRainShadowResult,
    isLikelyInRainShadow,
} from "./climate-bridge";
