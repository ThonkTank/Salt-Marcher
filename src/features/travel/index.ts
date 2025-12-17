/**
 * Travel Feature - Public API
 *
 * Provides hex-to-hex travel with time calculation and multi-hex route travel.
 */

// Types
export type {
  TravelFeaturePort,
  TravelResult,
  TravelState,
  TravelStatus,
  Route,
  RouteSegment,
  PauseReason,
} from './types';
export {
  calculateHexTraversalTime,
  HEX_SIZE_MILES,
  createInitialTravelState,
} from './types';

// Store
export { createTravelStore, type TravelStore } from './travel-store';

// Service
export { createTravelService, type TravelServiceDeps } from './travel-service';
