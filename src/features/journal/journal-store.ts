/**
 * Journal Feature store.
 *
 * In-memory state management for journal entries.
 * Follows the immutable update pattern used by other features.
 */

import type { EntityId } from '@core/index';
import type { JournalEntry, GameDateTime } from '@core/schemas';
import type { InternalJournalState } from './types';
import { createInitialJournalState } from './types';

// ============================================================================
// Journal Store
// ============================================================================

/**
 * Create the journal store for in-memory state management.
 */
export function createJournalStore() {
  let state: InternalJournalState = createInitialJournalState();

  /**
   * Compare GameDateTime for sorting (descending - newest first).
   */
  function compareGameDateTime(a: GameDateTime, b: GameDateTime): number {
    // Compare year first
    if (a.year !== b.year) return b.year - a.year;
    // Then month
    if (a.month !== b.month) return b.month - a.month;
    // Then day
    if (a.day !== b.day) return b.day - a.day;
    // Then hour
    if (a.hour !== b.hour) return b.hour - a.hour;
    // Finally minute
    return b.minute - a.minute;
  }

  /**
   * Sort entries by timestamp descending (newest first).
   */
  function sortEntries(entries: JournalEntry[]): JournalEntry[] {
    return [...entries].sort((a, b) =>
      compareGameDateTime(a.timestamp, b.timestamp)
    );
  }

  return {
    /**
     * Get the current state (read-only).
     */
    getState(): Readonly<InternalJournalState> {
      return state;
    },

    /**
     * Get all entries (read-only array).
     */
    getEntries(): readonly JournalEntry[] {
      return state.entries;
    },

    /**
     * Get a single entry by ID.
     */
    getEntry(id: EntityId<'journal'>): JournalEntry | undefined {
      return state.entries.find((e) => e.id === id);
    },

    /**
     * Check if entries are loaded.
     */
    isLoaded(): boolean {
      return state.isLoaded;
    },

    /**
     * Set all entries (used during initial load).
     */
    setEntries(entries: JournalEntry[]): void {
      state = {
        ...state,
        entries: sortEntries(entries),
        isLoaded: true,
      };
    },

    /**
     * Add a new entry to the store.
     * Maintains sorted order (newest first).
     */
    addEntry(entry: JournalEntry): void {
      state = {
        ...state,
        entries: sortEntries([...state.entries, entry]),
      };
    },

    /**
     * Update an existing entry.
     */
    updateEntry(
      id: EntityId<'journal'>,
      changes: Partial<Omit<JournalEntry, 'id'>>
    ): void {
      const index = state.entries.findIndex((e) => e.id === id);
      if (index === -1) return;

      const updatedEntry = { ...state.entries[index], ...changes };
      const newEntries = [...state.entries];
      newEntries[index] = updatedEntry;

      state = {
        ...state,
        entries: sortEntries(newEntries),
      };
    },

    /**
     * Remove an entry from the store.
     */
    removeEntry(id: EntityId<'journal'>): void {
      state = {
        ...state,
        entries: state.entries.filter((e) => e.id !== id),
      };
    },

    /**
     * Clear all entries and reset state.
     */
    clear(): void {
      state = createInitialJournalState();
    },
  };
}

/**
 * Type for the journal store instance.
 */
export type JournalStore = ReturnType<typeof createJournalStore>;
