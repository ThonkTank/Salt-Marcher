/**
 * Infrastructure - Vault Adapters
 * Re-exports all vault adapter factories
 */

export {
  createVaultGeographyAdapter,
  type MapStoragePort,
} from './geography-adapter';

export {
  createVaultTimeAdapter,
  type TimeStoragePort,
  type TimeState,
} from './time-adapter';

export {
  createVaultEntityAdapter,
  type EntityStoragePort,
  type EntitySummary,
  type CreatureEntity,
  type Entity,
  type EntityType,
} from './entity-adapter';
