/**
 * Journal Feature service (Orchestrator).
 *
 * Provides CRUD operations for journal entries with:
 * - Pessimistic Save-First pattern (persist before state update)
 * - Event-based communication (publishes domain events)
 * - Event handlers for command events
 *
 * Based on Journal.md specification and Features.md patterns.
 */

import type {
  Result,
  AppError,
  EntityType,
  EntityId,
  EventBus,
  Unsubscribe,
} from '@core/index';
import {
  ok,
  err,
  createError,
  createEvent,
  newCorrelationId,
  now,
  EventTypes,
  createEntityId,
} from '@core/index';
import type { JournalEntry, JournalCategory, GameDateTime } from '@core/schemas';
import type {
  JournalCreateEntryRequestedPayload,
  JournalUpdateEntryRequestedPayload,
  JournalDeleteEntryRequestedPayload,
  JournalEntryCreatedPayload,
  JournalEntryUpdatedPayload,
  JournalEntryDeletedPayload,
} from '@core/events/domain-events';
import type { JournalFeaturePort, JournalStoragePort } from './types';
import type { JournalStore } from './journal-store';

// ============================================================================
// Service Dependencies
// ============================================================================

export interface JournalServiceDeps {
  store: JournalStore;
  storage: JournalStoragePort;
  eventBus: EventBus;
}

// ============================================================================
// Journal Service
// ============================================================================

/**
 * Create the journal service (implements JournalFeaturePort).
 */
export function createJournalService(deps: JournalServiceDeps): JournalFeaturePort {
  const { store, storage, eventBus } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // =========================================================================
  // Event Publishing Helpers
  // =========================================================================

  function publishEntryCreated(entry: JournalEntry, correlationId?: string): void {
    const payload: JournalEntryCreatedPayload = { entry };
    eventBus.publish(
      createEvent(EventTypes.JOURNAL_ENTRY_CREATED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'journal-feature',
      })
    );
  }

  function publishEntryUpdated(
    entryId: EntityId<'journal'>,
    changes: Partial<Omit<JournalEntry, 'id'>>,
    correlationId?: string
  ): void {
    const payload: JournalEntryUpdatedPayload = { entryId, changes };
    eventBus.publish(
      createEvent(EventTypes.JOURNAL_ENTRY_UPDATED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'journal-feature',
      })
    );
  }

  function publishEntryDeleted(
    entryId: EntityId<'journal'>,
    correlationId?: string
  ): void {
    const payload: JournalEntryDeletedPayload = { entryId };
    eventBus.publish(
      createEvent(EventTypes.JOURNAL_ENTRY_DELETED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'journal-feature',
      })
    );
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
    // Handle create entry requests
    subscriptions.push(
      eventBus.subscribe<JournalCreateEntryRequestedPayload>(
        EventTypes.JOURNAL_CREATE_ENTRY_REQUESTED,
        async (event) => {
          const { entry: entryData } = event.payload;
          const correlationId = event.correlationId;

          // Generate ID
          const id = createEntityId<'journal'>();
          const entry: JournalEntry = { ...entryData, id };

          // 1. Pessimistic Save-First
          const saveResult = await storage.save(entry);
          if (!saveResult.ok) {
            console.warn('Journal: Failed to save entry', saveResult.error);
            return;
          }

          // 2. Update state
          store.addEntry(entry);

          // 3. Publish event
          publishEntryCreated(entry, correlationId);
        }
      )
    );

    // Handle update entry requests
    subscriptions.push(
      eventBus.subscribe<JournalUpdateEntryRequestedPayload>(
        EventTypes.JOURNAL_UPDATE_ENTRY_REQUESTED,
        async (event) => {
          const { entryId, changes } = event.payload;
          const correlationId = event.correlationId;

          const existing = store.getEntry(entryId);
          if (!existing) {
            console.warn('Journal: Entry not found for update', entryId);
            return;
          }

          const updated: JournalEntry = { ...existing, ...changes };

          // 1. Pessimistic Save-First
          const saveResult = await storage.save(updated);
          if (!saveResult.ok) {
            console.warn('Journal: Failed to update entry', saveResult.error);
            return;
          }

          // 2. Update state
          store.updateEntry(entryId, changes);

          // 3. Publish event
          publishEntryUpdated(entryId, changes, correlationId);
        }
      )
    );

    // Handle delete entry requests
    subscriptions.push(
      eventBus.subscribe<JournalDeleteEntryRequestedPayload>(
        EventTypes.JOURNAL_DELETE_ENTRY_REQUESTED,
        async (event) => {
          const { entryId } = event.payload;
          const correlationId = event.correlationId;

          const existing = store.getEntry(entryId);
          if (!existing) {
            console.warn('Journal: Entry not found for delete', entryId);
            return;
          }

          // 1. Pessimistic Delete-First
          const deleteResult = await storage.delete(entryId);
          if (!deleteResult.ok) {
            // Delete not supported yet - remove from memory only for now
            console.warn('Journal: Delete from storage failed, removing from memory only', deleteResult.error);
          }

          // 2. Update state
          store.removeEntry(entryId);

          // 3. Publish event
          publishEntryDeleted(entryId, correlationId);
        }
      )
    );
  }

  // Set up event handlers immediately
  setupEventHandlers();

  // =========================================================================
  // Query Helpers
  // =========================================================================

  /**
   * Compare GameDateTime for range checks.
   * Returns negative if a < b, positive if a > b, 0 if equal.
   */
  function compareGameDateTime(a: GameDateTime, b: GameDateTime): number {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    if (a.day !== b.day) return a.day - b.day;
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  }

  // =========================================================================
  // Public Interface
  // =========================================================================

  return {
    // -----------------------------------------------------------------------
    // State Queries
    // -----------------------------------------------------------------------

    getEntries(): readonly JournalEntry[] {
      return store.getEntries();
    },

    getEntriesBySession(sessionId: string): readonly JournalEntry[] {
      return store.getEntries().filter((e) => e.sessionId === sessionId);
    },

    getEntriesByCategory(category: JournalCategory): readonly JournalEntry[] {
      return store.getEntries().filter((e) => e.category === category);
    },

    getEntriesForEntity(
      entityType: EntityType,
      entityId: string
    ): readonly JournalEntry[] {
      return store.getEntries().filter((e) =>
        e.relatedEntities?.some(
          (ref) => ref.entityType === entityType && ref.entityId === entityId
        )
      );
    },

    getEntriesInRange(
      from: GameDateTime,
      to: GameDateTime
    ): readonly JournalEntry[] {
      return store.getEntries().filter((e) => {
        const cmpFrom = compareGameDateTime(e.timestamp, from);
        const cmpTo = compareGameDateTime(e.timestamp, to);
        return cmpFrom >= 0 && cmpTo <= 0;
      });
    },

    getPinnedEntries(): readonly JournalEntry[] {
      return store.getEntries().filter((e) => e.pinned === true);
    },

    getEntry(id: EntityId<'journal'>): JournalEntry | undefined {
      return store.getEntry(id);
    },

    isLoaded(): boolean {
      return store.isLoaded();
    },

    // -----------------------------------------------------------------------
    // CRUD Commands
    // -----------------------------------------------------------------------

    async createEntry(
      entryData: Omit<JournalEntry, 'id'>
    ): Promise<Result<JournalEntry, AppError>> {
      // Generate ID
      const id = createEntityId<'journal'>();
      const entry: JournalEntry = { ...entryData, id };

      // 1. Pessimistic Save-First
      const saveResult = await storage.save(entry);
      if (!saveResult.ok) {
        return err(
          createError('JOURNAL_SAVE_FAILED', 'Failed to save journal entry', {
            originalError: saveResult.error,
          })
        );
      }

      // 2. Update state
      store.addEntry(entry);

      // 3. Publish event
      publishEntryCreated(entry);

      return ok(entry);
    },

    async updateEntry(
      id: EntityId<'journal'>,
      changes: Partial<Omit<JournalEntry, 'id'>>
    ): Promise<Result<void, AppError>> {
      const existing = store.getEntry(id);
      if (!existing) {
        return err(
          createError('JOURNAL_ENTRY_NOT_FOUND', `Journal entry not found: ${id}`)
        );
      }

      const updated: JournalEntry = { ...existing, ...changes };

      // 1. Pessimistic Save-First
      const saveResult = await storage.save(updated);
      if (!saveResult.ok) {
        return err(
          createError('JOURNAL_UPDATE_FAILED', 'Failed to update journal entry', {
            originalError: saveResult.error,
          })
        );
      }

      // 2. Update state
      store.updateEntry(id, changes);

      // 3. Publish event
      publishEntryUpdated(id, changes);

      return ok(undefined);
    },

    async deleteEntry(id: EntityId<'journal'>): Promise<Result<void, AppError>> {
      const existing = store.getEntry(id);
      if (!existing) {
        return err(
          createError('JOURNAL_ENTRY_NOT_FOUND', `Journal entry not found: ${id}`)
        );
      }

      // 1. Pessimistic Delete-First
      const deleteResult = await storage.delete(id);
      if (!deleteResult.ok) {
        // For now, we'll proceed with memory deletion even if storage fails
        // This is a workaround until VaultIO.delete is implemented
        console.warn('Journal: Delete from storage failed', deleteResult.error);
      }

      // 2. Update state
      store.removeEntry(id);

      // 3. Publish event
      publishEntryDeleted(id);

      return ok(undefined);
    },

    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------

    async loadEntries(): Promise<Result<void, AppError>> {
      const result = await storage.loadAll();
      if (!result.ok) {
        return err(
          createError('JOURNAL_LOAD_FAILED', 'Failed to load journal entries', {
            originalError: result.error,
          })
        );
      }

      store.setEntries(result.value);
      return ok(undefined);
    },

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    dispose(): void {
      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
