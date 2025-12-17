/**
 * Weather store - in-memory state management.
 *
 * Follows the same pattern as time-store.ts and map-store.ts.
 */

import type { WeatherState } from '@core/schemas';
import type { InternalWeatherState } from './types';
import { createInitialWeatherState } from './types';

// ============================================================================
// Weather Store Interface
// ============================================================================

/**
 * In-memory state store for Weather Feature.
 */
export interface WeatherStore {
  /**
   * Get current state (read-only).
   */
  getState(): Readonly<InternalWeatherState>;

  /**
   * Set current weather.
   */
  setWeather(weather: WeatherState): void;

  /**
   * Set active map ID.
   */
  setActiveMap(mapId: string | null): void;

  /**
   * Mark as loaded.
   */
  setLoaded(loaded: boolean): void;

  /**
   * Clear all state.
   */
  clear(): void;
}

// ============================================================================
// Weather Store Factory
// ============================================================================

/**
 * Create a new weather store instance.
 */
export function createWeatherStore(): WeatherStore {
  let state: InternalWeatherState = createInitialWeatherState();

  return {
    getState(): Readonly<InternalWeatherState> {
      return state;
    },

    setWeather(weather: WeatherState): void {
      state = {
        ...state,
        currentWeather: weather,
        isLoaded: true,
      };
    },

    setActiveMap(mapId: string | null): void {
      state = {
        ...state,
        activeMapId: mapId,
        // Reset weather when map changes
        currentWeather: mapId === state.activeMapId ? state.currentWeather : null,
        isLoaded: mapId === state.activeMapId ? state.isLoaded : false,
      };
    },

    setLoaded(loaded: boolean): void {
      state = {
        ...state,
        isLoaded: loaded,
      };
    },

    clear(): void {
      state = createInitialWeatherState();
    },
  };
}
