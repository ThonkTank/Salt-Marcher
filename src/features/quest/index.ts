/**
 * Quest Feature - Public API
 *
 * Exports the quest feature factory and types.
 *
 * @see docs/features/Quest-System.md
 */

// Service factory
export { createQuestService } from './quest-service';
export type { QuestServiceDeps } from './quest-service';

// Types
export type {
  QuestFeaturePort,
  QuestProgress,
  ObjectiveProgress,
  QuestCompletionResult,
  OpenEncounterSlot,
  InternalQuestState,
  SerializableQuestState,
} from './types';

export {
  createInitialQuestState,
  toSerializableState,
  fromSerializableState,
} from './types';

// Store (for testing)
export { createQuestStore } from './quest-store';
export type { QuestStore } from './quest-store';

// XP utilities
export {
  IMMEDIATE_XP_PERCENT,
  QUEST_POOL_XP_PERCENT,
  calculateImmediateXP,
  calculateQuestPoolXP,
  calculateQuestCompletionXP,
  getXPBreakdown,
  formatXPSplit,
} from './quest-xp';
