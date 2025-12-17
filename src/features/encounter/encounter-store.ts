/**
 * Encounter store - in-memory state management.
 *
 * Manages:
 * - Current encounter (pending/active)
 * - Encounter history (resolved)
 * - Recent creature types (for variety validation)
 */

import type { EncounterInstance } from '@core/schemas';
import type { InternalEncounterState } from './types';
import {
  createInitialEncounterState,
  MAX_HISTORY_SIZE,
} from './types';
import { VARIETY_HISTORY_SIZE } from '@core/schemas';

// ============================================================================
// Encounter Store Interface
// ============================================================================

/**
 * In-memory state store for Encounter Feature.
 */
export interface EncounterStore {
  /**
   * Get current state (read-only).
   */
  getState(): Readonly<InternalEncounterState>;

  /**
   * Set current encounter.
   */
  setCurrentEncounter(encounter: EncounterInstance | null): void;

  /**
   * Add encounter to history (when resolved).
   */
  addToHistory(encounter: EncounterInstance): void;

  /**
   * Track a creature type for variety validation.
   */
  trackCreatureType(creatureId: string): void;

  /**
   * Set active map ID.
   */
  setActiveMap(mapId: string | null): void;

  /**
   * Clear current encounter (without adding to history).
   */
  clearCurrentEncounter(): void;

  /**
   * Clear all state.
   */
  clear(): void;
}

// ============================================================================
// Encounter Store Factory
// ============================================================================

/**
 * Create a new encounter store instance.
 */
export function createEncounterStore(): EncounterStore {
  let state: InternalEncounterState = createInitialEncounterState();

  return {
    getState(): Readonly<InternalEncounterState> {
      return state;
    },

    setCurrentEncounter(encounter: EncounterInstance | null): void {
      state = {
        ...state,
        currentEncounter: encounter,
      };
    },

    addToHistory(encounter: EncounterInstance): void {
      // Keep history bounded
      const newHistory = [encounter, ...state.history].slice(0, MAX_HISTORY_SIZE);

      state = {
        ...state,
        history: newHistory,
        // Clear current if it's the one being added
        currentEncounter:
          state.currentEncounter?.id === encounter.id
            ? null
            : state.currentEncounter,
      };
    },

    trackCreatureType(creatureId: string): void {
      // Keep recent types bounded (FIFO)
      const newTypes = [creatureId, ...state.recentCreatureTypes].slice(
        0,
        VARIETY_HISTORY_SIZE
      );

      state = {
        ...state,
        recentCreatureTypes: newTypes,
      };
    },

    setActiveMap(mapId: string | null): void {
      // When map changes, clear current encounter but keep history
      const shouldClearCurrent = mapId !== state.activeMapId;

      state = {
        ...state,
        activeMapId: mapId,
        currentEncounter: shouldClearCurrent ? null : state.currentEncounter,
      };
    },

    clearCurrentEncounter(): void {
      state = {
        ...state,
        currentEncounter: null,
      };
    },

    clear(): void {
      state = createInitialEncounterState();
    },
  };
}
