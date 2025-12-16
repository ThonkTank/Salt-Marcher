/**
 * Weather Feature - Procedural weather generation and forecasting
 */

// ============================================================================
// Types
// ============================================================================

export type {
    WeatherType,
    Season,
    WeatherCondition,
    WeatherState,
    ClimateTemplate,
    WeatherGenerationOptions,
    WeatherZone,
} from "./weather-types";

// ============================================================================
// Weather Generation
// ============================================================================

export {
    generateWeather,
    getSeasonForDay,
    advanceWeather,
} from "./weather-generator";

export {
    generateForecast,
    type ForecastOptions,
} from "./weather-forecaster";

// ============================================================================
// Climate Templates
// ============================================================================

export {
    ARCTIC_CLIMATE,
    TEMPERATE_CLIMATE,
    TROPICAL_CLIMATE,
    DESERT_CLIMATE,
    MOUNTAIN_CLIMATE,
    COASTAL_CLIMATE,
    CLIMATE_TEMPLATES,
} from "./climate-templates";

// ============================================================================
// Climate Modifiers
// ============================================================================

export {
    applyClimateModifiers,
    getWindSpeedModifier,
    getVisibilityModifier,
    getMoisturePrecipitationBoost,
} from "./climate-modifiers";

// ============================================================================
// Weather Store (Reactive State)
// ============================================================================

export {
    getWeatherStore,
    type WeatherHistoryEntry,
    type WeatherForecast,
} from "./weather-store";

// ============================================================================
// Utilities
// ============================================================================

export {
    getWeatherIcon,
} from "./weather-icons";

export {
    mapWeatherToTags,
} from "./weather-tag-mapper";
