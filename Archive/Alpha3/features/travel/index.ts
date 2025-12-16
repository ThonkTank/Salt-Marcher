/**
 * Travel Feature - Public API
 *
 * Coordinates Geography and Time features for overland travel.
 */

// Types
export type {
  TravelFeaturePort,
  TravelState,
  TravelStatus,
  TravelProgress,
  TravelStateListener,
  Route,
  RouteSegment,
  Waypoint,
  TravelConfig,
  TravelStartedPayload,
  TravelCompletedPayload,
  TravelPausedPayload,
  TravelWaypointReachedPayload,
  PositionChangedPayload,
} from './types';

export { DEFAULT_TRAVEL_CONFIG } from './types';

// Factory
export { createTravelOrchestrator } from './orchestrator';

// Utilities
export {
  formatDuration,
  durationToMinutes,
  minutesToDuration,
  addDurations,
} from './travel-utils';
