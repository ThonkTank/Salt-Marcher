/**
 * Encounter store - in-memory state management.
 *
 * Manages:
 * - Current encounter (pending/active)
 * - Encounter history (resolved)
 * - Recent creature types (for variety validation)
 */

import type { EncounterInstance } from '@core/schemas';
import type { InternalEncounterState, DailyXPTracker } from './types';
import {
  createInitialEncounterState,
  createInitialDailyXPTracker,
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

  // === Daily XP Tracking ===

  /**
   * Get current daily XP tracker state.
   */
  getDailyXP(): Readonly<DailyXPTracker>;

  /**
   * Track XP usage from a combat encounter.
   * Increments budgetUsed and combatEncountersToday.
   */
  trackCombatXP(xp: number): void;

  /**
   * Reset daily XP tracker (e.g., on Long Rest or new day).
   * @param dayNumber - The new game day number
   * @param budget - The new daily XP budget
   */
  resetDailyXP(dayNumber: number, budget: number): void;

  /**
   * Update daily budget without resetting progress.
   * Used when party composition changes mid-day.
   * @param budget - The new daily XP budget
   */
  updateDailyBudget(budget: number): void;

  /**
   * Check if daily XP budget is exhausted (>75% used).
   * Used to influence encounter type derivation.
   */
  isDailyBudgetExhausted(): boolean;
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

    // === Daily XP Tracking ===

    getDailyXP(): Readonly<DailyXPTracker> {
      return state.dailyXP;
    },

    trackCombatXP(xp: number): void {
      state = {
        ...state,
        dailyXP: {
          ...state.dailyXP,
          budgetUsed: state.dailyXP.budgetUsed + xp,
          combatEncountersToday: state.dailyXP.combatEncountersToday + 1,
        },
      };
    },

    resetDailyXP(dayNumber: number, budget: number): void {
      state = {
        ...state,
        dailyXP: {
          dayNumber,
          budgetTotal: budget,
          budgetUsed: 0,
          combatEncountersToday: 0,
        },
      };
    },

    updateDailyBudget(budget: number): void {
      state = {
        ...state,
        dailyXP: {
          ...state.dailyXP,
          budgetTotal: budget,
        },
      };
    },

    isDailyBudgetExhausted(): boolean {
      const { budgetTotal, budgetUsed } = state.dailyXP;
      if (budgetTotal <= 0) return false;
      return budgetUsed >= budgetTotal * 0.75;
    },
  };
}
