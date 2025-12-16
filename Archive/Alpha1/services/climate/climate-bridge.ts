// src/services/climate/climate-bridge.ts
// Climate service bridge - provides access to climate feature functionality
//
// This service acts as a facade/bridge to the climate feature, allowing other
// features and workmodes to access climate calculations without creating
// direct feature-to-feature dependencies.
//
// Design: This is a thin wrapper that re-exports the climate feature API.
// The actual climate logic remains in src/features/climate/.

import {
    ClimateEngine,
    getClimateEngine,
    resetClimateEngine,
} from "@features/climate/climate-engine";

import {
    calculateDiurnalAmplitude,
    getAmplitudeBreakdown,
    formatAmplitudeBreakdown,
    getAmplitudeDescription,
} from "@features/climate/amplitude-calculator";

import {
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
} from "@features/climate/temperature-calculator";

import {
    // Constants
    MOUNTAIN_THRESHOLD,
    MAX_SHADOW_RANGE,
    MAX_SHADOW_MODIFIER,
    DEFAULT_MAX_RAYCAST_DISTANCE,
    CACHE_SIZE,
    WIND_BUCKET_SIZE,
    // Direction functions
    bearingToHexDirection,
    oppositeDirection,
    // Shadow calculation functions
    calculateShadowRange,
    calculateShadowModifier,
    calculateRainShadow,
    calculateRainShadowMap,
    // Cache management
    clearRainShadowCache,
    getRainShadowCacheSize,
    // Utility functions
    formatRainShadowResult,
    isLikelyInRainShadow,
} from "@features/climate/rain-shadow-calculator";

// ============================================================================
// Climate Engine Access
// ============================================================================

/**
 * Get the default ClimateEngine instance.
 * Creates one on first call with default configuration.
 *
 * Use this for accessing terrain-derived climate calculations.
 */
export { getClimateEngine, ClimateEngine, resetClimateEngine };

// ============================================================================
// Amplitude Calculator
// ============================================================================

/**
 * Calculate and format diurnal temperature amplitude.
 * Amplitude represents the day/night temperature swing.
 */
export {
    calculateDiurnalAmplitude,
    getAmplitudeBreakdown,
    formatAmplitudeBreakdown,
    getAmplitudeDescription,
};

// ============================================================================
// Temperature Calculator
// ============================================================================

/**
 * Calculate base temperatures and phase-specific temperatures.
 */
export {
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
};

// ============================================================================
// Rain Shadow Calculator
// ============================================================================

/**
 * Calculate rain shadow effects from mountains blocking precipitation.
 */
export {
    // Constants
    MOUNTAIN_THRESHOLD,
    MAX_SHADOW_RANGE,
    MAX_SHADOW_MODIFIER,
    DEFAULT_MAX_RAYCAST_DISTANCE,
    CACHE_SIZE,
    WIND_BUCKET_SIZE,
    // Direction functions
    bearingToHexDirection,
    oppositeDirection,
    // Shadow calculation functions
    calculateShadowRange,
    calculateShadowModifier,
    calculateRainShadow,
    calculateRainShadowMap,
    // Cache management
    clearRainShadowCache,
    getRainShadowCacheSize,
    // Utility functions
    formatRainShadowResult,
    isLikelyInRainShadow,
};
