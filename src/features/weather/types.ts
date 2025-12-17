/**
 * Weather Feature types and interfaces.
 *
 * Weather is a reactive feature that:
 * - Subscribes to time:segment-changed
 * - Calculates weather based on terrain and time
 * - Publishes environment:weather-changed
 */

import type { Result, AppError, Option } from '@core/index';
import type {
  WeatherState,
  WeatherParams,
  PrecipitationType,
  HexCoordinate,
} from '@core/schemas';

// ============================================================================
// Weather Feature Port
// ============================================================================

/**
 * Public interface for the Weather Feature.
 */
export interface WeatherFeaturePort {
  /**
   * Get current weather for the active map.
   * Returns None if no map is loaded or map has no weather.
   */
  getCurrentWeather(): Option<WeatherState>;

  /**
   * Get current weather parameters (numeric values).
   * Returns None if no weather available.
   */
  getCurrentParams(): Option<WeatherParams>;

  /**
   * Get travel speed factor based on current weather.
   * Returns 1.0 if no weather or no precipitation impact.
   */
  getWeatherSpeedFactor(): number;

  /**
   * Force weather recalculation for current map/position.
   * Normally triggered automatically by time:segment-changed.
   */
  recalculateWeather(): Result<WeatherState, AppError>;

  /**
   * Check if weather is loaded for current map.
   */
  isLoaded(): boolean;

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Internal State
// ============================================================================

/**
 * Internal state for the Weather Feature.
 */
export interface InternalWeatherState {
  /** Current weather state (from map or generated) */
  currentWeather: WeatherState | null;

  /** ID of the map this weather belongs to */
  activeMapId: string | null;

  /** Whether weather has been initialized for current map */
  isLoaded: boolean;
}

/**
 * Create initial weather state.
 */
export function createInitialWeatherState(): InternalWeatherState {
  return {
    currentWeather: null,
    activeMapId: null,
    isLoaded: false,
  };
}

// ============================================================================
// Weather Calculation Types
// ============================================================================

/**
 * Context for weather calculation.
 */
export interface WeatherCalculationContext {
  /** Center position for area averaging */
  centerPosition: HexCoordinate;

  /** Current time segment for temperature modifier */
  timeSegment: string;

  /** Previous weather for transition smoothing */
  previousWeather?: WeatherParams;
}

/**
 * Result of weather calculation.
 */
export interface WeatherCalculationResult {
  /** Calculated weather parameters */
  params: WeatherParams;

  /** Derived precipitation type */
  precipitationType: PrecipitationType;
}
