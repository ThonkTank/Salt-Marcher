// Ziel: Combat-Tracking Service Index
// Siehe: docs/services/combatTracking.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Diese Datei wird aktuell nicht verwendet.
// ============================================================================

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
  getCombatEvents,
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
  // Types
  type CombatStateWithScoring,
} from './combatState';

// ============================================================================
// MOVEMENT (movement.ts) - Single Source of Truth for combat movement
// ============================================================================

export {
  // Speed & Budget
  getSpeed,
  getEffectiveSpeed,
  createTurnBudget,
  calculateGrantedMovement,
  // hasAnyBonusAction, // TODO: Implement hasAnyBonusAction
  // Action Helpers
  hasGrantMovementEffect,
  hasToTargetMovementCost,
  getMovementRange,
} from './movement';

// ============================================================================
// PROTOCOL LOGGING (protocolLogger.ts)
// ============================================================================

export {
  formatProtocolEntry,
  formatBudget,
} from './protocolLogger';

// ============================================================================
// ZONE EFFECTS (zoneEffects.ts)
// ============================================================================

export {
  applyZoneEffects,
  getZoneSpeedModifier,
  activateZone,
  deactivateZonesForOwner,
  resetZoneTriggersForCombatant,
  createActiveZone,
  type ZoneEffectResult,
} from './zoneEffects';

// ============================================================================
// CONDITION LIFECYCLE (conditionLifecycle.ts)
// ============================================================================

export {
  buildLifecycleRegistry,
  handleLinkedConditionOnApply,
  handleLinkedConditionOnRemove,
  handleSourceDeath,
  handlePositionSync,
} from './conditionLifecycle';

// ============================================================================
// RESOLUTION PIPELINE (resolution/)
// ============================================================================

export {
  // Pipeline Orchestrator
  resolveAction,
  // Step 1: Target Selection
  findTargets,
  isValidTarget,
  isInRange,
  getValidCandidates,
  type TargetResult,
  type FindTargetsContext,
  // Step 2: Modifier Gathering
  getModifiers,
  resolveAdvantageState,
  createEmptyModifierSet,
  type ModifierSet,
  type AdvantageState,
  type GetModifiersContext,
  // Step 3: Success Determination
  determineSuccess,
  type SuccessResult,
  // Step 4: Effect Resolution (Single Source of Truth)
  resolveEffects,
} from './resolution';
