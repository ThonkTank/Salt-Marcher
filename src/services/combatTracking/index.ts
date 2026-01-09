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
// ACTION EXECUTION (executeAction.ts)
// ============================================================================

export {
  executeAction,
  // Action Resolution
  resolveAttack,
  resolveAttackWithReactions,
  checkCounterspell,
  processReactionTrigger,
  // Escape Resolution
  resolveEscapeAttempt,
  // Types
  type ActionResult,
  type ReactionTrigger,
  type AttackResolutionWithReactions,
  type EscapeAttemptResult,
} from './executeAction';

// ============================================================================
// COMBATANT STATE (combatState.ts)
// ============================================================================

export {
  // Creature Cache
  getResolvedCreature,
  preloadCreatures,
  clearCreatureCache,
  getCreatureCacheStats,
  type ResolvedCreature,
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
  // Dead Combatant Management
  markDeadCombatants,
  getAliveCombatants,
  isAlive,
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
  // Turn Budget Functions
  createTurnBudget,
  getEffectiveSpeed,
  calculateGrantedMovement,
  // Grapple Helpers
  getGrappledTargets,
  hasAbductTrait,
  // Types
  type CombatStateWithScoring,
} from './combatState';

// ============================================================================
// PROTOCOL LOGGING (protocolLogger.ts)
// ============================================================================

export {
  formatProtocolEntry,
  formatBudget,
} from './protocolLogger';
