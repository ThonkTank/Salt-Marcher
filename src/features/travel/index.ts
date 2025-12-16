/**
 * Travel Feature - Public API
 *
 * Provides hex-to-hex travel with time calculation.
 */

// Types
export type { TravelFeaturePort, TravelResult } from './types';
export { calculateHexTraversalTime, HEX_SIZE_MILES } from './types';

// Service
export { createTravelService, type TravelServiceDeps } from './travel-service';
