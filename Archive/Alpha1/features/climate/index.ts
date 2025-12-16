// src/features/climate/index.ts
// Barrel export for terrain-derived climate system
//
// This module provides climate calculations based on terrain properties.
// No climate presets needed - climate is derived from terrain, moisture,
// elevation, and flora, with only temperature offset being directly editable.

// ============================================================================
// Types
// ============================================================================

export type {
    DiurnalPhase,
    AmplitudeBreakdown,
    BaseTemperatureBreakdown,
    ClimateCalculationResult,
    ClimateInputTile,
} from "./climate-types";

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
} from "./climate-types";

// ============================================================================
// Amplitude Calculator
// ============================================================================

export {
    calculateDiurnalAmplitude,
    getAmplitudeBreakdown,
    formatAmplitudeBreakdown,
    getAmplitudeDescription,
} from "./amplitude-calculator";

// ============================================================================
// Temperature Calculator
// ============================================================================

export type { Season } from "./temperature-calculator";

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
} from "./temperature-calculator";

// ============================================================================
// Rain Shadow Calculator
// ============================================================================

export type { RainShadowResult } from "./rain-shadow-calculator";

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
} from "./rain-shadow-calculator";

// ============================================================================
// Climate Engine
// ============================================================================

export type { ClimateEngineConfig } from "./climate-engine";

export {
    ClimateEngine,
    getClimateEngine,
    resetClimateEngine,
} from "./climate-engine";

// ============================================================================
// Derivation Engine (Moisture + Flora)
// ============================================================================

export type { DerivationInput, DerivationResult } from "./derivation-engine";

export {
    MOISTURE_MIDPOINTS,
    mapToMoistureLevel,
    deriveMoisture,
    deriveFlora,
    deriveForTile,
    deriveForMap,
} from "./derivation-engine";

// ============================================================================
// Terrain Derivation (Relative to Neighbors)
// ============================================================================

export type {
    TerrainDerivationInput,
    TerrainDerivationResult,
    TerrainAnalysis,
} from "./terrain-derivation";

export {
    // Constants
    MOUNTAIN_RELATIVE_THRESHOLD,
    HILL_RELATIVE_THRESHOLD,
    MOUNTAIN_ABSOLUTE_THRESHOLD,
    HILL_ABSOLUTE_THRESHOLD,
    // Core derivation
    deriveTerrain,
    deriveTerrainForTile,
    deriveTerrainForMap,
    // Analysis
    analyzeTerrainDerivation,
} from "./terrain-derivation";
