/**
 * Journal Feature types and interfaces.
 *
 * Based on Journal.md specification:
 * - JournalFeaturePort: Public API for the Journal Feature
 * - JournalStoragePort: Persistence interface for Vault adapter
 * - InternalJournalState: Internal state management
 */

import type { Result, AppError, EntityType, EntityId } from '@core/index';
import type {
  JournalEntry,
  JournalCategory,
  GameDateTime,
} from '@core/schemas';

// ============================================================================
// Journal Storage Port
// ============================================================================

/**
 * Storage port for journal entry persistence.
 * Uses one file per entry for better scalability.
 */
export interface JournalStoragePort {
  /** Load all journal entries from storage */
  loadAll(): Promise<Result<JournalEntry[], AppError>>;

  /** Save a single journal entry */
  save(entry: JournalEntry): Promise<Result<void, AppError>>;

  /** Delete a journal entry */
  delete(id: EntityId<'journal'>): Promise<Result<void, AppError>>;

  /** Check if a journal entry exists */
  exists(id: EntityId<'journal'>): Promise<boolean>;
}

// ============================================================================
// Journal Feature Port
// ============================================================================

/**
 * Public interface for the Journal Feature.
 * Provides CRUD operations and query methods for journal entries.
 *
 * Used by:
 * - SessionRunner (Quick Note, Journal Panel)
 * - Almanac (Timeline View)
 * - Auto-generation handlers (Quest, Encounter, Travel events)
 */
export interface JournalFeaturePort {
  // === State Queries ===

  /** Get all journal entries (sorted by timestamp descending) */
  getEntries(): readonly JournalEntry[];

  /** Get entries for a specific session */
  getEntriesBySession(sessionId: string): readonly JournalEntry[];

  /** Get entries by category */
  getEntriesByCategory(category: JournalCategory): readonly JournalEntry[];

  /** Get entries referencing a specific entity */
  getEntriesForEntity(
    entityType: EntityType,
    entityId: string
  ): readonly JournalEntry[];

  /** Get entries within a time range (in-game time) */
  getEntriesInRange(
    from: GameDateTime,
    to: GameDateTime
  ): readonly JournalEntry[];

  /** Get all pinned entries */
  getPinnedEntries(): readonly JournalEntry[];

  /** Get a single entry by ID */
  getEntry(id: EntityId<'journal'>): JournalEntry | undefined;

  /** Check if entries are loaded */
  isLoaded(): boolean;

  // === CRUD Commands ===

  /**
   * Create a new journal entry.
   * Uses Pessimistic Save-First: persists before updating state.
   * Publishes journal:entry-created event on success.
   */
  createEntry(
    entry: Omit<JournalEntry, 'id'>
  ): Promise<Result<JournalEntry, AppError>>;

  /**
   * Update an existing journal entry.
   * Uses Pessimistic Save-First: persists before updating state.
   * Publishes journal:entry-updated event on success.
   */
  updateEntry(
    id: EntityId<'journal'>,
    changes: Partial<Omit<JournalEntry, 'id'>>
  ): Promise<Result<void, AppError>>;

  /**
   * Delete a journal entry.
   * Uses Pessimistic Save-First: deletes from storage before updating state.
   * Publishes journal:entry-deleted event on success.
   */
  deleteEntry(id: EntityId<'journal'>): Promise<Result<void, AppError>>;

  // === Persistence ===

  /** Load all entries from storage */
  loadEntries(): Promise<Result<void, AppError>>;

  // === Lifecycle ===

  /** Clean up subscriptions and resources */
  dispose(): void;
}

// ============================================================================
// Internal Journal State
// ============================================================================

/**
 * Internal state for the Journal Feature.
 */
export interface InternalJournalState {
  /** All loaded journal entries (sorted by timestamp descending) */
  entries: JournalEntry[];

  /** Flag indicating entries have been loaded */
  isLoaded: boolean;
}

/**
 * Create initial journal state with empty entries.
 */
export function createInitialJournalState(): InternalJournalState {
  return {
    entries: [],
    isLoaded: false,
  };
}
