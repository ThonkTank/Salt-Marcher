// Ziel: Combat-Tracking Service Index
// Siehe: docs/services/combatTracking.md

// ============================================================================
// COMBAT INITIALIZATION (initialiseCombat.ts)
// ============================================================================

export {
  initialiseCombat,
  type PartyInput,
  // Resource Management
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
} from './initialiseCombat';

// ============================================================================
// TYPES (re-exported from @/types/combat)
// ============================================================================

export type {
  ProbabilityDistribution,
  GridPosition,
  GridConfig,
  SpeedBlock,
  ConditionState,
  CombatResources,
  SurpriseState,
  // Combatant Types
  Combatant,
  NPCInCombat,
  CharacterInCombat,
  CombatantState,
  CombatantSimulationState,
  CombatState,
  // Other Types
  RoundResult,
  AttackResolution,
  TurnBudget,
} from '@/types/combat';

// Type Guards
export { isNPC, isCharacter } from '@/types/combat';

// ============================================================================
// COMBATANT STATE (combatState.ts)
// ============================================================================

export {
  // Combatant Accessors
  getHP,
  getAC,
  getSpeed,
  getActions,
  getAbilities,
  getSaveProficiencies,
  getCR,
  getCombatantType,
  getGroupId,
  getPosition,
  getConditions,
  getDeathProbability,
  getMaxHP,
  getResources,
  // Combatant Setters
  setHP,
  setPosition,
  setConditions,
  addCondition,
  removeCondition,
  setConcentration,
  setResources,
  // Turn Management
  advanceTurn,
  getCurrentCombatant,
  isCombatOver,
  // Types
  type CombatStateWithScoring,
} from './combatState';

// ============================================================================
// COMBAT TRACKING (combatTracking.ts)
// ============================================================================

export {
  // Turn Budget Functions
  hasAnyBonusAction,
  createTurnBudget,
  hasBudgetRemaining,
  consumeMovement,
  consumeAction,
  consumeBonusAction,
  consumeReaction,
  applyDash,
  // Action Resolution
  resolveAttack,
  // Reaction Processing
  processReactionTrigger,
  resolveAttackWithReactions,
  checkCounterspell,
  // Types
  type ReactionTrigger,
  type AttackResolutionWithReactions,
} from './combatTracking';

// Re-export Reaction types from @/types/combat
export type { ReactionContext, ReactionResult } from '@/types/combat';

// Creature Cache (für effizientes Laden)
export {
  getResolvedCreature,
  preloadCreatures,
  clearCreatureCache,
  getCreatureCacheStats,
  type ResolvedCreature,
} from './creatureCache';
