/**
 * Weather service - main orchestrator for the Weather Feature.
 *
 * Responsibilities:
 * - Subscribe to time:segment-changed and map:loaded
 * - Calculate weather based on terrain and time
 * - Publish environment:weather-changed
 * - Provide weather queries for Travel
 */

import type { Result, AppError, Option, Unsubscribe } from '@core/index';
import { ok, err, some, none, createError, isNone, isSome } from '@core/index';
import type { EventBus } from '@core/events';
import {
  EventTypes,
  createEvent,
  newCorrelationId,
  type TimeSegmentChangedPayload,
  type MapLoadedPayload,
} from '@core/events';
import { now } from '@core/types';
import type {
  WeatherState,
  WeatherParams,
  TerrainWeatherRanges,
  HexCoordinate,
  TimeSegment,
  GameDateTime,
} from '@core/schemas';
import { DEFAULT_WEATHER_RANGES } from '@core/schemas';
import type { MapFeaturePort } from '../map';
import type { PartyFeaturePort } from '../party';
import type { TimeFeaturePort } from '../time';
import type { WeatherFeaturePort } from './types';
import type { WeatherStore } from './weather-store';
import {
  calculateAreaWeather,
  createWeatherState,
  transitionWeather,
  getWeatherSpeedFactor,
} from './weather-utils';

// ============================================================================
// Weather Service Dependencies
// ============================================================================

/**
 * Dependencies for creating the weather service.
 */
export interface WeatherServiceDeps {
  store: WeatherStore;
  mapFeature: MapFeaturePort;
  partyFeature: PartyFeaturePort;
  timeFeature: TimeFeaturePort;
  eventBus: EventBus;
}

// ============================================================================
// Weather Service Factory
// ============================================================================

/**
 * Create the weather service.
 */
export function createWeatherService(deps: WeatherServiceDeps): WeatherFeaturePort {
  const { store, mapFeature, partyFeature, timeFeature, eventBus } = deps;

  const subscriptions: Unsubscribe[] = [];

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  /**
   * Get weather ranges for a tile from terrain definition.
   */
  function getTileWeatherRanges(coord: HexCoordinate): TerrainWeatherRanges | null {
    const terrain = mapFeature.getTerrainAt(coord);
    if (isNone(terrain)) return null;

    const terrainDef = terrain.value;
    return terrainDef.weatherRanges ?? DEFAULT_WEATHER_RANGES;
  }

  /**
   * Get party position for weather calculation.
   */
  function getPartyPosition(): HexCoordinate | null {
    const position = partyFeature.getPosition();
    if (isNone(position)) return null;
    return position.value;
  }

  /**
   * Calculate new weather for current state.
   */
  function calculateNewWeather(
    position: HexCoordinate,
    timeSegment: TimeSegment,
    previousWeather?: WeatherParams
  ): WeatherParams {
    // Calculate area-averaged weather
    const baseWeather = calculateAreaWeather(
      position,
      getTileWeatherRanges,
      timeSegment
    );

    // Apply transition if we have previous weather
    if (previousWeather) {
      return transitionWeather(previousWeather, baseWeather);
    }

    return baseWeather;
  }

  /**
   * Publish weather changed event.
   */
  function publishWeatherChanged(
    previousWeather: WeatherState | null,
    newWeather: WeatherState,
    trigger: 'segment-change' | 'location-change' | 'map-loaded',
    correlationId?: string
  ): void {
    const payload = {
      previousWeather: previousWeather ?? newWeather,
      newWeather,
      trigger,
    };

    eventBus.publish(
      createEvent(EventTypes.ENVIRONMENT_WEATHER_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'weather-feature',
      })
    );
  }

  /**
   * Publish state changed event.
   */
  function publishStateChanged(correlationId?: string): void {
    const state = store.getState();

    eventBus.publish(
      createEvent(
        EventTypes.ENVIRONMENT_STATE_CHANGED,
        { state },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'weather-feature',
        }
      )
    );
  }

  // --------------------------------------------------------------------------
  // Core Weather Operations
  // --------------------------------------------------------------------------

  /**
   * Initialize or update weather for the current map.
   */
  function initializeWeather(correlationId?: string): Result<WeatherState, AppError> {
    // Get current map
    const mapOption = mapFeature.getCurrentMap();
    if (isNone(mapOption)) {
      return err(createError('NO_MAP_LOADED', 'No map is currently loaded'));
    }

    const map = mapOption.value;

    // Check if map is indoor (no weather)
    if (map.type !== 'overworld') {
      // Indoor maps don't have weather
      store.clear();
      return err(createError('NO_WEATHER_INDOOR', 'Indoor maps do not have weather'));
    }

    // Update active map
    store.setActiveMap(map.id);

    // Check if map already has weather (session continuity)
    if (map.currentWeather) {
      store.setWeather(map.currentWeather);
      publishWeatherChanged(null, map.currentWeather, 'map-loaded', correlationId);
      return ok(map.currentWeather);
    }

    // Generate new weather
    const position = getPartyPosition();
    if (!position) {
      // Use default spawn point or map center
      const defaultPos = map.defaultSpawnPoint ?? { q: 0, r: 0 };
      return generateWeatherAt(defaultPos, correlationId);
    }

    return generateWeatherAt(position, correlationId);
  }

  /**
   * Generate weather at a specific position.
   */
  function generateWeatherAt(
    position: HexCoordinate,
    correlationId?: string
  ): Result<WeatherState, AppError> {
    const timeSegment = timeFeature.getTimeSegment();
    const currentTime = timeFeature.getCurrentTime();

    const previousWeather = store.getState().currentWeather;
    const params = calculateNewWeather(
      position,
      timeSegment,
      previousWeather?.params
    );

    const weather = createWeatherState(params, currentTime);
    store.setWeather(weather);

    publishWeatherChanged(previousWeather, weather, 'segment-change', correlationId);
    publishStateChanged(correlationId);

    return ok(weather);
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  function setupEventHandlers(): void {
    // Subscribe to time segment changes
    subscriptions.push(
      eventBus.subscribe<TimeSegmentChangedPayload>(
        EventTypes.TIME_SEGMENT_CHANGED,
        (event) => {
          // Recalculate weather when time segment changes
          const position = getPartyPosition();
          if (position) {
            generateWeatherAt(position, event.correlationId);
          }
        }
      )
    );

    // Subscribe to map loaded events
    subscriptions.push(
      eventBus.subscribe<MapLoadedPayload>(
        EventTypes.MAP_LOADED,
        (event) => {
          // Initialize weather for new map
          initializeWeather(event.correlationId);
        }
      )
    );
  }

  // Initialize event handlers
  setupEventHandlers();

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  return {
    getCurrentWeather(): Option<WeatherState> {
      const state = store.getState();
      return state.currentWeather ? some(state.currentWeather) : none();
    },

    getCurrentParams(): Option<WeatherParams> {
      const state = store.getState();
      return state.currentWeather ? some(state.currentWeather.params) : none();
    },

    getWeatherSpeedFactor(): number {
      const state = store.getState();
      return getWeatherSpeedFactor(state.currentWeather);
    },

    recalculateWeather(): Result<WeatherState, AppError> {
      const position = getPartyPosition();
      if (!position) {
        return err(createError('NO_POSITION', 'Party position not available'));
      }
      return generateWeatherAt(position);
    },

    isLoaded(): boolean {
      return store.getState().isLoaded;
    },

    dispose(): void {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
      store.clear();
    },
  };
}
