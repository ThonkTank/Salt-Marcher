/**
 * Common types and branded types for type-safe identifiers.
 */

// ============================================================================
// Entity Types
// ============================================================================

/**
 * All supported entity types for the EntityRegistry pattern.
 * MVP: 16 types
 */
export type EntityType =
  | 'creature'
  | 'character'
  | 'npc'
  | 'faction'
  | 'item'
  | 'map'
  | 'poi' // Points of Interest (used in Faction territory, NPC location)
  | 'maplink'
  | 'terrain'
  | 'quest'
  | 'encounter'
  | 'shop'
  | 'party'
  | 'calendar'
  | 'journal'
  | 'worldevent'
  | 'track';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Type-safe entity ID with brand.
 * Prevents mixing IDs of different entity types.
 */
export type EntityId<T extends EntityType> = string & {
  readonly __entityType: T;
};

/**
 * Unix milliseconds timestamp with brand.
 * Real-world time, not game time.
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' };

// ============================================================================
// Time Segments
// ============================================================================

/**
 * The 6 time segments for weather, lighting, and encounter modifications.
 */
export type TimeSegment =
  | 'dawn' // 5-8
  | 'morning' // 8-12
  | 'midday' // 12-15
  | 'afternoon' // 15-18
  | 'dusk' // 18-21
  | 'night'; // 21-5

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard error structure for Result<T, AppError>.
 */
export interface AppError {
  /** Error code (e.g., "MAP_NOT_FOUND", "INVALID_STATE") */
  readonly code: string;
  /** Human-readable message */
  readonly message: string;
  /** Optional additional context */
  readonly details?: unknown;
}

// ============================================================================
// Base Interfaces
// ============================================================================

/** Base interface for all entities */
export interface BaseEntity<T extends EntityType> {
  readonly id: EntityId<T>;
}

/** Entity with creation/update timestamps */
export interface TrackedEntity<T extends EntityType> extends BaseEntity<T> {
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// ============================================================================
// Type-specific ID aliases (convenience)
// ============================================================================

export type CreatureId = EntityId<'creature'>;
export type CharacterId = EntityId<'character'>;
export type NpcId = EntityId<'npc'>;
export type FactionId = EntityId<'faction'>;
export type ItemId = EntityId<'item'>;
export type MapId = EntityId<'map'>;
export type PoiId = EntityId<'poi'>;
export type MaplinkId = EntityId<'maplink'>;
export type TerrainId = EntityId<'terrain'>;
export type QuestId = EntityId<'quest'>;
export type EncounterId = EntityId<'encounter'>;
export type ShopId = EntityId<'shop'>;
export type PartyId = EntityId<'party'>;
export type CalendarId = EntityId<'calendar'>;
export type JournalId = EntityId<'journal'>;
export type WorldeventId = EntityId<'worldevent'>;
export type TrackId = EntityId<'track'>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new UUID-based entity ID.
 */
export function createEntityId<T extends EntityType>(): EntityId<T> {
  return crypto.randomUUID() as EntityId<T>;
}

/**
 * Cast a string to EntityId (for loading from storage).
 * Assumes the string is a valid UUID.
 */
export function toEntityId<T extends EntityType>(id: string): EntityId<T> {
  return id as EntityId<T>;
}

/**
 * Get current real-world timestamp (Unix milliseconds).
 * For game time, use the Time feature.
 */
export function now(): Timestamp {
  return Date.now() as Timestamp;
}

/**
 * Cast a number to Timestamp.
 */
export function toTimestamp(ms: number): Timestamp {
  return ms as Timestamp;
}

/**
 * Create an AppError.
 */
export function createError(
  code: string,
  message: string,
  details?: unknown
): AppError {
  return { code, message, details };
}
