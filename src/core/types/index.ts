/**
 * Core types - Public API
 */

// Result type
export {
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  flatMap,
} from './result';

// Option type
export {
  type Option,
  type Some,
  type None,
  some,
  none,
  fromNullable,
  isSome,
  isNone,
  getOrElse,
  unwrap as unwrapOption,
  map as mapOption,
  flatMap as flatMapOption,
  filter,
} from './option';

// Common types
export {
  type EntityType,
  type EntityId,
  type Timestamp,
  type TimeSegment,
  type AppError,
  type BaseEntity,
  type TrackedEntity,
  // Type aliases
  type CreatureId,
  type CharacterId,
  type NpcId,
  type FactionId,
  type ItemId,
  type MapId,
  type PoiId,
  type MaplinkId,
  type TerrainId,
  type QuestId,
  type EncounterId,
  type ShopId,
  type PartyId,
  type CalendarId,
  type JournalId,
  type WorldeventId,
  type TrackId,
  // Helper functions
  createEntityId,
  toEntityId,
  now,
  toTimestamp,
  createError,
} from './common';

// EntityRegistry types
export {
  type EntityRegistryPort,
  type EntityTypeMap,
  type Entity,
  ValidationError,
  NotFoundError,
  IOError,
} from './entity-registry.port';
