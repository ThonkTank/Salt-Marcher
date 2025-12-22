/**
 * EntityRegistryPort - Interface for entity storage operations.
 *
 * This is the port interface for the hexagonal architecture pattern.
 * Features depend on this interface; Infrastructure provides the adapter.
 *
 * @see docs/architecture/EntityRegistry.md
 */

import type { ZodError } from 'zod';
import type { Result } from './result';
import type { EntityType, EntityId } from './common';

// Schema type imports
import type { CreatureDefinition } from '../schemas/creature';
import type { Character } from '../schemas/character';
import type { NPC } from '../schemas/npc';
import type { Faction } from '../schemas/faction';
import type { Item } from '../schemas/item';
import type { OverworldMap } from '../schemas/map';
import type { BasePOI } from '../schemas/poi';
import type { TerrainDefinition } from '../schemas/terrain';
import type { QuestDefinition } from '../schemas/quest';
import type { EncounterDefinition } from '../schemas/encounter';
import type { Party } from '../schemas/party';
import type { CalendarDefinition } from '../schemas/time';
import type { JournalEntry } from '../schemas/journal';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when entity validation fails.
 */
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(
    public readonly zodError: ZodError,
    public readonly entityType: EntityType,
    public readonly entityId?: string
  ) {
    super(`Validation failed for ${entityType}: ${zodError.message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when entity is not found.
 */
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;

  constructor(
    public readonly entityType: EntityType,
    public readonly entityId: string
  ) {
    super(`Entity not found: ${entityType}/${entityId}`);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when IO operation fails.
 */
export class IOError extends Error {
  readonly code = 'IO_ERROR' as const;

  constructor(
    public readonly operation: 'read' | 'write' | 'delete',
    public readonly path: string,
    public readonly cause?: Error
  ) {
    super(`IO ${operation} failed for ${path}${cause ? `: ${cause.message}` : ''}`);
    this.name = 'IOError';
  }
}

// ============================================================================
// Entity Type Mapping
// ============================================================================

/**
 * Maps EntityType strings to their corresponding schema types.
 * This enables type-safe entity operations.
 *
 * Note: Some types use `unknown` as placeholders for schemas
 * that will be implemented in future tasks.
 */
export interface EntityTypeMap {
  // Core Entities
  creature: CreatureDefinition;
  character: Character;
  npc: NPC;
  faction: Faction;
  item: Item;

  // World Entities
  map: OverworldMap;
  poi: BasePOI;
  maplink: unknown; // TODO: Task for MapLink schema
  terrain: TerrainDefinition;

  // Session Entities
  quest: QuestDefinition;
  encounter: EncounterDefinition;
  shop: unknown; // TODO: Task #2100
  party: Party;

  // Time & Events
  calendar: CalendarDefinition;
  journal: JournalEntry;
  worldevent: unknown; // TODO: WorldEvent schema

  // Audio
  track: unknown; // TODO: Track schema
}

/**
 * Type helper to get the entity type for a given EntityType key.
 */
export type Entity<T extends EntityType> = EntityTypeMap[T];

// ============================================================================
// EntityRegistryPort Interface
// ============================================================================

/**
 * Port interface for entity storage operations.
 *
 * Features use this interface to access entities.
 * Infrastructure provides the adapter (VaultEntityRegistryAdapter).
 *
 * @example
 * ```typescript
 * // In a feature constructor
 * constructor(private entityRegistry: EntityRegistryPort) {}
 *
 * // Usage
 * const creature = entityRegistry.get('creature', creatureId);
 * const allNpcs = entityRegistry.getAll('npc');
 * const goblins = entityRegistry.query('creature', c => c.name.includes('Goblin'));
 * ```
 */
export interface EntityRegistryPort {
  /**
   * Get a single entity by type and ID.
   * @returns Entity or null if not found
   */
  get<T extends EntityType>(type: T, id: EntityId<T>): Entity<T> | null;

  /**
   * Get all entities of a given type.
   */
  getAll<T extends EntityType>(type: T): Entity<T>[];

  /**
   * Query entities with a predicate function.
   * Linear scan for MVP; indices can be added later.
   */
  query<T extends EntityType>(
    type: T,
    predicate: (entity: Entity<T>) => boolean
  ): Entity<T>[];

  /**
   * Save an entity (create or update).
   * - Validates via Zod schema
   * - Persists immediately (pessimistic save)
   * @returns Result with error on validation or IO failure
   */
  save<T extends EntityType>(
    type: T,
    entity: Entity<T>
  ): Result<void, ValidationError | IOError>;

  /**
   * Delete an entity.
   * @returns Result with error if not found or IO failure
   */
  delete<T extends EntityType>(
    type: T,
    id: EntityId<T>
  ): Result<void, NotFoundError | IOError>;

  /**
   * Check if an entity exists.
   */
  exists<T extends EntityType>(type: T, id: EntityId<T>): boolean;

  /**
   * Count entities of a given type.
   */
  count<T extends EntityType>(type: T): number;
}
