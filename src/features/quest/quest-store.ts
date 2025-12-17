/**
 * Quest Feature state store.
 *
 * Manages quest progress, discovery status, and completion history.
 * Uses immutable update patterns.
 *
 * @see docs/features/Quest-System.md
 */

import type {
  InternalQuestState,
  QuestProgress,
  ObjectiveProgress,
  SerializableQuestState,
} from './types';
import {
  createInitialQuestState,
  fromSerializableState,
  toSerializableState,
} from './types';
import type { HexCoordinate, QuestStatus } from '@core/schemas';

// ============================================================================
// Quest Store Interface
// ============================================================================

/**
 * Quest state store interface.
 */
export interface QuestStore {
  // === Queries ===

  /**
   * Get current state (readonly).
   */
  getState(): Readonly<InternalQuestState>;

  /**
   * Get progress for a specific quest.
   */
  getQuestProgress(questId: string): QuestProgress | null;

  /**
   * Get all active quests.
   */
  getActiveQuests(): QuestProgress[];

  /**
   * Check if quest has open encounter slots.
   */
  hasOpenEncounterSlots(questId: string, definition: { encounters: { id: string }[] }): boolean;

  /**
   * Check if a quest is discovered.
   */
  isDiscovered(questId: string): boolean;

  /**
   * Check if a quest is completed.
   */
  isCompleted(questId: string): boolean;

  /**
   * Check if a quest has failed.
   */
  isFailed(questId: string): boolean;

  // === Mutations ===

  /**
   * Mark a quest as discovered.
   */
  setDiscovered(questId: string): void;

  /**
   * Remove from discovered (when activating).
   */
  removeDiscovered(questId: string): void;

  /**
   * Add active quest progress.
   */
  activateQuest(questId: string, progress: QuestProgress): void;

  /**
   * Update objective progress.
   */
  updateObjectiveProgress(
    questId: string,
    objectiveId: string,
    progress: ObjectiveProgress
  ): void;

  /**
   * Fill an encounter slot.
   */
  fillEncounterSlot(questId: string, slotId: string, encounterId: string): void;

  /**
   * Add accumulated XP to quest pool.
   */
  addAccumulatedXP(questId: string, amount: number): void;

  /**
   * Place a quantum reward at a location.
   */
  placeReward(questId: string, rewardIndex: number, position: HexCoordinate): void;

  /**
   * Update quest status.
   */
  updateStatus(questId: string, status: QuestStatus): void;

  /**
   * Move quest to completed list.
   */
  completeQuest(questId: string): void;

  /**
   * Move quest to failed list.
   */
  failQuest(questId: string): void;

  /**
   * Clear all state.
   */
  clear(): void;

  // === Serialization ===

  /**
   * Get serializable state for persistence.
   */
  serialize(): SerializableQuestState;

  /**
   * Restore state from serialized form.
   */
  restore(state: SerializableQuestState): void;
}

// ============================================================================
// Quest Store Factory
// ============================================================================

/**
 * Create a new quest store.
 */
export function createQuestStore(): QuestStore {
  let state: InternalQuestState = createInitialQuestState();

  return {
    // === Queries ===

    getState(): Readonly<InternalQuestState> {
      return state;
    },

    getQuestProgress(questId: string): QuestProgress | null {
      return state.activeQuests.get(questId) ?? null;
    },

    getActiveQuests(): QuestProgress[] {
      return Array.from(state.activeQuests.values());
    },

    hasOpenEncounterSlots(
      questId: string,
      definition: { encounters: { id: string }[] }
    ): boolean {
      const progress = state.activeQuests.get(questId);
      if (!progress) return false;

      // Check if any slot is not filled
      return definition.encounters.some(
        (slot) => !progress.encounterSlotsFilled.has(slot.id)
      );
    },

    isDiscovered(questId: string): boolean {
      return state.discoveredQuests.has(questId);
    },

    isCompleted(questId: string): boolean {
      return state.completedQuests.includes(questId);
    },

    isFailed(questId: string): boolean {
      return state.failedQuests.includes(questId);
    },

    // === Mutations ===

    setDiscovered(questId: string): void {
      const newDiscovered = new Set(state.discoveredQuests);
      newDiscovered.add(questId);
      state = { ...state, discoveredQuests: newDiscovered };
    },

    removeDiscovered(questId: string): void {
      const newDiscovered = new Set(state.discoveredQuests);
      newDiscovered.delete(questId);
      state = { ...state, discoveredQuests: newDiscovered };
    },

    activateQuest(questId: string, progress: QuestProgress): void {
      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, progress);
      state = { ...state, activeQuests: newActiveQuests };
    },

    updateObjectiveProgress(
      questId: string,
      objectiveId: string,
      progress: ObjectiveProgress
    ): void {
      const questProgress = state.activeQuests.get(questId);
      if (!questProgress) return;

      const newObjectiveProgress = new Map(questProgress.objectiveProgress);
      newObjectiveProgress.set(objectiveId, progress);

      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, {
        ...questProgress,
        objectiveProgress: newObjectiveProgress,
      });
      state = { ...state, activeQuests: newActiveQuests };
    },

    fillEncounterSlot(questId: string, slotId: string, encounterId: string): void {
      const questProgress = state.activeQuests.get(questId);
      if (!questProgress) return;

      const newSlotsFilled = new Map(questProgress.encounterSlotsFilled);
      newSlotsFilled.set(slotId, encounterId);

      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, {
        ...questProgress,
        encounterSlotsFilled: newSlotsFilled,
      });
      state = { ...state, activeQuests: newActiveQuests };
    },

    addAccumulatedXP(questId: string, amount: number): void {
      const questProgress = state.activeQuests.get(questId);
      if (!questProgress) return;

      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, {
        ...questProgress,
        accumulatedXP: questProgress.accumulatedXP + amount,
      });
      state = { ...state, activeQuests: newActiveQuests };
    },

    placeReward(questId: string, rewardIndex: number, position: HexCoordinate): void {
      const questProgress = state.activeQuests.get(questId);
      if (!questProgress) return;

      const newPlacedRewards = new Map(questProgress.placedRewards);
      newPlacedRewards.set(rewardIndex, position);

      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, {
        ...questProgress,
        placedRewards: newPlacedRewards,
      });
      state = { ...state, activeQuests: newActiveQuests };
    },

    updateStatus(questId: string, status: QuestStatus): void {
      const questProgress = state.activeQuests.get(questId);
      if (!questProgress) return;

      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.set(questId, {
        ...questProgress,
        status,
      });
      state = { ...state, activeQuests: newActiveQuests };
    },

    completeQuest(questId: string): void {
      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.delete(questId);

      state = {
        ...state,
        activeQuests: newActiveQuests,
        completedQuests: [...state.completedQuests, questId],
      };
    },

    failQuest(questId: string): void {
      const newActiveQuests = new Map(state.activeQuests);
      newActiveQuests.delete(questId);

      state = {
        ...state,
        activeQuests: newActiveQuests,
        failedQuests: [...state.failedQuests, questId],
      };
    },

    clear(): void {
      state = createInitialQuestState();
    },

    // === Serialization ===

    serialize(): SerializableQuestState {
      return toSerializableState(state);
    },

    restore(serialized: SerializableQuestState): void {
      state = fromSerializableState(serialized);
    },
  };
}
