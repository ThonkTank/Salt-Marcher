/**
 * Geography Feature - Public API
 *
 * Manages hex-tile maps, terrain, and spatial queries.
 *
 * @example
 * ```typescript
 * import { createGeographyOrchestrator } from '@/features/geography';
 * import { createVaultGeographyAdapter } from '@/infrastructure/vault';
 *
 * // In Plugin onload()
 * const adapter = createVaultGeographyAdapter(this.app.vault);
 * const geography = createGeographyOrchestrator(adapter);
 * await geography.initialize();
 *
 * // Load and use map
 * await geography.setActiveMap(mapId);
 * const tile = geography.getTileAt({ q: 0, r: 0 });
 * const terrain = geography.getTerrainAt({ q: 0, r: 0 });
 * ```
 */

// Types
export type {
  GeographyFeaturePort,
  MapStoragePort,
  MapLoadResult,
} from './types';

// Factory
export { createGeographyOrchestrator } from './orchestrator';
