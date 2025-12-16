/**
 * Core Layer - Public API
 *
 * Shared foundations for all layers: types, schemas, events.
 */

// Types
export {
  // Result
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
  // Option
  type Option,
  type Some,
  type None,
  some,
  none,
  fromNullable,
  isSome,
  isNone,
  getOrElse,
  unwrapOption,
  mapOption,
  flatMapOption,
  filter,
  // Common types
  type EntityType,
  type EntityId,
  type Timestamp,
  type TimeSegment,
  type AppError,
  type BaseEntity,
  type TrackedEntity,
  type CreatureId,
  type CharacterId,
  type NpcId,
  type FactionId,
  type ItemId,
  type MapId,
  type LocationId,
  type MaplinkId,
  type TerrainId,
  type QuestId,
  type EncounterId,
  type ShopId,
  type CalendarId,
  type JournalId,
  type WorldeventId,
  type TrackId,
  type PartyId,
  createEntityId,
  toEntityId,
  now,
  toTimestamp,
  createError,
} from './types';

// Schemas
export {
  // Common
  entityIdSchema,
  timestampSchema,
  entityTypeSchema,
  timeSegmentSchema,
  appErrorSchema,
  // Terrain
  terrainDefinitionSchema,
  type TerrainDefinition,
  TERRAIN_IDS,
  type BuiltinTerrainId,
  // Map
  hexCoordSchema,
  type HexCoordinate,
  mapTypeSchema,
  type MapType,
  overworldTileSchema,
  type OverworldTile,
  overworldMapSchema,
  type OverworldMap,
  tileKey,
  buildTileLookup,
  // Party
  transportModeSchema,
  type TransportMode,
  TRANSPORT_BASE_SPEEDS,
  partySchema,
  type Party,
  type PartyTravelState,
} from './schemas';

// Events
export {
  type DomainEvent,
  type EventBus,
  type EventHandler,
  type Unsubscribe,
  createEvent,
  newCorrelationId,
  createEventBus,
} from './events';

// Utils
export {
  type HexCoord,
  type Point,
  hex,
  hexEquals,
  hexAdd,
  hexSubtract,
  hexScale,
  hexDistance,
  hexNeighbors,
  hexNeighbor,
  hexAdjacent,
  hexesInRadius,
  hexRing,
  coordToKey,
  keyToCoord,
  axialToPixel,
  pixelToAxial,
  axialRound,
  hexCorners,
  hexWidth,
  hexHeight,
  hexHorizontalSpacing,
  hexVerticalSpacing,
} from './utils';
