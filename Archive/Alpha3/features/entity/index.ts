/**
 * Entity Feature - Public API
 *
 * Manages game entities (Creatures, Items, Factions).
 *
 * @example
 * ```typescript
 * import { createEntityOrchestrator } from '@/features/entity';
 * import { createVaultEntityAdapter } from '@/infrastructure/vault';
 *
 * // In Plugin onload()
 * const adapter = createVaultEntityAdapter(this.app.vault, 'Presets');
 * const entity = createEntityOrchestrator(adapter);
 * await entity.initialize();
 *
 * // Query creatures
 * const creatures = entity.listCreatures();
 * const forestCreatures = entity.findCreaturesByTerrain('forest');
 * const lowCR = entity.findCreaturesByCR(0, 2);
 * ```
 */

// Types
export type {
  EntityFeaturePort,
  EntityStoragePort,
  Entity,
  EntitySummary,
  EntityType,
  CreatureEntity,
} from './types';

// Factory
export { createEntityOrchestrator } from './orchestrator';
