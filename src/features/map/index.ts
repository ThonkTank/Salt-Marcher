/**
 * Map Feature - Public API
 *
 * Manages map loading, tile access, and terrain lookups.
 */

// Types
export type {
  MapFeaturePort,
  MapStoragePort,
  TerrainStoragePort,
  MapState,
} from './types';
export { createInitialMapState } from './types';

// Store
export { createMapStore, type MapStore } from './map-store';

// Service
export { createMapService, type MapServiceDeps } from './map-service';
