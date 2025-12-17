/**
 * Weather Feature - Public API
 *
 * Reactive weather system based on terrain, time, and location.
 */

// Types
export type { WeatherFeaturePort, InternalWeatherState } from './types';

// Store
export { createWeatherStore, type WeatherStore } from './weather-store';

// Service
export { createWeatherService, type WeatherServiceDeps } from './weather-service';

// Utils (for testing and direct use)
export {
  generateFromRange,
  classifyTemperature,
  classifyWind,
  classifyPrecipitation,
  deriveCategories,
  generateWeatherFromRanges,
  calculateAreaWeather,
  transitionWeather,
  getWeatherSpeedFactor,
  getSpeedFactorFromPrecipitation,
  createWeatherState,
} from './weather-utils';
