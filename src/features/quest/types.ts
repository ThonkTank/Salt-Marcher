/**
 * Quest Feature types and interfaces.
 *
 * Quest Feature handles:
 * - Quest state machine (unknown → discovered → active → completed/failed)
 * - 40/60 XP split for quest-related encounters
 * - Objective tracking and completion
 * - Deadline monitoring via Time integration
 *
 * @see docs/features/Quest-System.md
 */

import type { Result, AppError, Option, EntityId } from '@core/index';
import type {
  QuestDefinition,
  QuestStatus,
  QuestObjective,
  QuestEncounterSlot,
  QuestReward,
  QuestFailReason,
  GameDateTime,
  HexCoordinate,
} from '@core/schemas';

// ============================================================================
// Quest Progress Types
// ============================================================================

/**
 * Progress tracking for a single objective.
 */
export interface ObjectiveProgress {
  /** Reference to objective ID */
  objectiveId: string;

  /** Current count (for kill/collect) */
  currentCount: number;

  /** Target count (from objective definition) */
  targetCount: number;

  /** Is this objective completed? */
  completed: boolean;
}

/**
 * Runtime quest progress.
 * Stored in feature state (Resumable).
 */
export interface QuestProgress {
  /** Reference to quest definition */
  questId: EntityId<'quest'>;

  /** Current status */
  status: QuestStatus;

  /** When quest was activated */
  startedAt: GameDateTime;

  /** Calculated deadline (if quest has deadline duration) */
  deadlineAt?: GameDateTime;

  /** Progress per objective */
  objectiveProgress: Map<string, ObjectiveProgress>;

  /** Filled encounter slots (slotId -> encounterId) */
  encounterSlotsFilled: Map<string, string>;

  /** Accumulated XP from 60% split */
  accumulatedXP: number;

  /** Placed quantum rewards (rewardIndex -> position) */
  placedRewards: Map<number, HexCoordinate>;
}

/**
 * Result of completing a quest.
 */
export interface QuestCompletionResult {
  questId: EntityId<'quest'>;
  xpAwarded: number;
  rewards: QuestReward[];
}

/**
 * Open encounter slot for UI display.
 */
export interface OpenEncounterSlot {
  questId: string;
  questName: string;
  slotId: string;
  slotDescription: string;
  slotType: QuestEncounterSlot['type'];
}

// ============================================================================
// Quest Feature Port
// ============================================================================

/**
 * Public interface for the Quest Feature.
 */
export interface QuestFeaturePort {
  // === Queries ===

  /**
   * Get progress for a specific quest.
   * Returns None if quest not tracked.
   */
  getQuestProgress(questId: EntityId<'quest'>): Option<QuestProgress>;

  /**
   * Get all active quests (status = 'active').
   */
  getActiveQuests(): readonly QuestProgress[];

  /**
   * Get discovered but not yet active quests.
   */
  getDiscoveredQuests(): readonly EntityId<'quest'>[];

  /**
   * Get quests with open encounter slots.
   * Used for encounter:resolved → UI prompt.
   */
  getQuestsWithOpenSlots(): readonly QuestProgress[];

  /**
   * Get all open encounter slots across all active quests.
   */
  getOpenEncounterSlots(): readonly OpenEncounterSlot[];

  /**
   * Get accumulated XP for a quest.
   */
  getAccumulatedXP(questId: EntityId<'quest'>): number;

  /**
   * Get quest definition by ID.
   */
  getQuestDefinition(questId: EntityId<'quest'>): Option<QuestDefinition>;

  // === Commands ===

  /**
   * Mark a quest as discovered (unknown → discovered).
   */
  discoverQuest(questId: EntityId<'quest'>): Result<void, AppError>;

  /**
   * Activate a discovered quest (discovered → active).
   */
  activateQuest(questId: EntityId<'quest'>): Result<void, AppError>;

  /**
   * Complete an objective within an active quest.
   */
  completeObjective(
    questId: EntityId<'quest'>,
    objectiveId: string
  ): Result<void, AppError>;

  /**
   * Assign an encounter to a quest slot.
   * Accumulates 60% of encounter XP to quest pool.
   */
  assignEncounter(
    questId: EntityId<'quest'>,
    slotId: string,
    encounterId: string,
    encounterXP: number
  ): Result<void, AppError>;

  /**
   * Complete an active quest (active → completed).
   * Pays out accumulated XP and rewards.
   */
  completeQuest(questId: EntityId<'quest'>): Result<QuestCompletionResult, AppError>;

  /**
   * Fail an active quest (active → failed).
   */
  failQuest(
    questId: EntityId<'quest'>,
    reason: QuestFailReason
  ): Result<void, AppError>;

  // === Lifecycle ===

  /**
   * Initialize the feature (load resumable state).
   */
  initialize(): Promise<void>;

  /**
   * Get serializable state for persistence.
   */
  getResumableState(): SerializableQuestState;

  /**
   * Restore state from persistence.
   */
  restoreState(state: SerializableQuestState): void;

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Internal State
// ============================================================================

/**
 * Internal state for the Quest Feature.
 */
export interface InternalQuestState {
  /** Active quest progress by questId */
  activeQuests: Map<string, QuestProgress>;

  /** Discovered but not active quests */
  discoveredQuests: Set<string>;

  /** Completed quest IDs (for history) */
  completedQuests: string[];

  /** Failed quest IDs */
  failedQuests: string[];
}

/**
 * Create initial quest state.
 */
export function createInitialQuestState(): InternalQuestState {
  return {
    activeQuests: new Map(),
    discoveredQuests: new Set(),
    completedQuests: [],
    failedQuests: [],
  };
}

// ============================================================================
// Serializable State (for Resumable persistence)
// ============================================================================

/**
 * Serializable version of QuestProgress for JSON storage.
 */
export interface SerializableQuestProgress {
  questId: string;
  status: QuestStatus;
  startedAt: GameDateTime;
  deadlineAt?: GameDateTime;
  objectiveProgress: Array<[string, ObjectiveProgress]>;
  encounterSlotsFilled: Array<[string, string]>;
  accumulatedXP: number;
  placedRewards: Array<[number, HexCoordinate]>;
}

/**
 * Serializable version of InternalQuestState for JSON storage.
 */
export interface SerializableQuestState {
  activeQuests: SerializableQuestProgress[];
  discoveredQuests: string[];
  completedQuests: string[];
  failedQuests: string[];
}

/**
 * Convert QuestProgress to serializable form.
 */
export function toSerializableProgress(progress: QuestProgress): SerializableQuestProgress {
  return {
    questId: progress.questId,
    status: progress.status,
    startedAt: progress.startedAt,
    deadlineAt: progress.deadlineAt,
    objectiveProgress: Array.from(progress.objectiveProgress.entries()),
    encounterSlotsFilled: Array.from(progress.encounterSlotsFilled.entries()),
    accumulatedXP: progress.accumulatedXP,
    placedRewards: Array.from(progress.placedRewards.entries()),
  };
}

/**
 * Convert serializable form back to QuestProgress.
 */
export function fromSerializableProgress(
  serialized: SerializableQuestProgress
): QuestProgress {
  return {
    questId: serialized.questId as EntityId<'quest'>,
    status: serialized.status,
    startedAt: serialized.startedAt,
    deadlineAt: serialized.deadlineAt,
    objectiveProgress: new Map(serialized.objectiveProgress),
    encounterSlotsFilled: new Map(serialized.encounterSlotsFilled),
    accumulatedXP: serialized.accumulatedXP,
    placedRewards: new Map(serialized.placedRewards),
  };
}

/**
 * Convert InternalQuestState to serializable form.
 */
export function toSerializableState(state: InternalQuestState): SerializableQuestState {
  return {
    activeQuests: Array.from(state.activeQuests.values()).map(toSerializableProgress),
    discoveredQuests: Array.from(state.discoveredQuests),
    completedQuests: state.completedQuests,
    failedQuests: state.failedQuests,
  };
}

/**
 * Convert serializable form back to InternalQuestState.
 */
export function fromSerializableState(serialized: SerializableQuestState): InternalQuestState {
  const activeQuests = new Map<string, QuestProgress>();
  for (const progress of serialized.activeQuests) {
    activeQuests.set(progress.questId, fromSerializableProgress(progress));
  }

  return {
    activeQuests,
    discoveredQuests: new Set(serialized.discoveredQuests),
    completedQuests: serialized.completedQuests,
    failedQuests: serialized.failedQuests,
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum completed quests to keep in history.
 */
export const MAX_QUEST_HISTORY_SIZE = 100;
