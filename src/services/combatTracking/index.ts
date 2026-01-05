// Ziel: Combat-Tracking Service Index
// Siehe: docs/services/combatTracking.md

// Types re-exported from @/types/combat
export type {
  ProbabilityDistribution,
  GridPosition,
  GridConfig,
  SpeedBlock,
  ConditionState,
  CombatProfile,
  SurpriseState,
  SimulationState,
  CombatState,
  RoundResult,
  AttackResolution,
  TurnBudget,
} from '@/types/combat';

// Local types
export type { PartyInput } from './combatTracking';

// Functions from combatTracking
export {
  // Turn Budget Functions
  createTurnBudget,
  hasBudgetRemaining,
  consumeMovement,
  consumeAction,
  consumeBonusAction,
  consumeReaction,
  applyDash,
  // Profile Creation
  createPartyProfiles,
  createEnemyProfiles,
  // Surprise
  checkSurprise,
  // State Initialization
  createCombatState,
  // Action Resolution
  resolveAttack,
  // State Updates
  updateCombatantHP,
  updateCombatantPosition,
} from './combatTracking';

// Creature Cache (für effizientes Laden)
export {
  getResolvedCreature,
  preloadCreatures,
  clearCreatureCache,
  getCreatureCacheStats,
  type ResolvedCreature,
} from './creatureCache';
