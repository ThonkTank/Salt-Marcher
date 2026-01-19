// Ziel: Public API für CombatantAI-Modul
// Siehe: docs/services/combatantAI/combatantAI.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Diese Datei wird aktuell nicht verwendet.
// ============================================================================

// ============================================================================
// MAIN API
// ============================================================================

// Primary entry point for AI decision-making
export { selectNextAction } from './selectNextAction';

// ============================================================================
// SELECTORS (Austauschbare Algorithmen)
// ============================================================================

export {
  // Interface & Types
  type ActionSelector,
  type SelectorConfig,
  type SelectorStats,
  // Selector Instances
  greedySelector,
  randomSelector,
  // Registry
  registerSelector,
  getSelector,
  getDefaultSelector,
  getRegisteredSelectors,
} from './selectors';

// ============================================================================
// CORE (Wiederverwendbar für alle Algorithmen)
// ============================================================================

export {
  // Budget Operations
  isBudgetExhausted,
  consumeBudget,
  // State Operations
  cloneState,
  projectState,
  type BudgetConsumption,
  type StateProjection,
  // CombatEvent Enumeration
  buildPossibleCombatEvents,
  getThreatWeight,
  hasTimingBudget,
  getAvailableCombatEventsWithLayers,
  getCandidates,
  getEnemies,
  getAllies,
  type ScoredCombatEvent,
} from './core';

// ============================================================================
// LAYERS (Evaluation Infrastructure)
// ============================================================================

export {
  // Initialization
  initializeLayers,
  augmentWithLayers,
  buildActionLayerData,
  buildEffectLayers,
  // Base Resolution
  resolveBaseAgainstTarget,
  getBaseResolution,
  precomputeBaseResolutions,
  // Effect Application
  applyEffectsToBase,
  getFullResolution,
  collectActiveEffects,
  isEffectActiveAt,
  // Threat Map
  buildThreatMap,
  getThreatAt,
  getSupportAt,
  getDominantThreat,
  getAvailableActionsAt,
  // Escape Danger
  buildEscapeDangerMap,
  calculateDangerScoresBatch,
  // Reaction Layers
  findReactionLayers,
  wouldTriggerReaction,
  calculateExpectedReactionCost,
  // Position Updates
  updateLayersForMovement,
  invalidateTargetCache,
  // Debug
  visualizeActionRange,
  explainTargetResolution,
  // Type Re-exports
  type CellRangeData,
  type BaseResolvedData,
  type FinalResolvedData,
  type ActionLayerData,
  type ActionWithLayer,
  type EffectCondition,
  type EffectLayerData,
  type LayerFilter,
  type CombatantWithLayers,
  type CombatantSimulationStateWithLayers,
  type CombatStateWithLayers,
  type ThreatMapEntry,
  type ReactionContext,
  type ReactionResult,
  hasLayerData,
  combatantHasLayers,
} from './layers';

// ============================================================================
// SCORING (DPR-basierte Bewertung)
// ============================================================================

export {
  // Constants
  CONDITION_DURATION,
  DEFAULT_CONDITION_DURATION,
  REACTION_THRESHOLD,
  // Scoring Functions
  calculateIncomingDPR,
  getCombatEventIntent,
  calculatePairScore,
  selectBestCombatEventAndTarget,
  getMaxAttackRange,
  // Concentration
  isConcentrationSpell,
  estimateRemainingConcentrationValue,
  // Reaction Functions
  getAvailableReactions,
  matchesTrigger,
  findMatchingReactions,
  estimateExpectedReactionValue,
  shouldUseCombatEvent,
  evaluateReaction,
  shouldUseReaction,
} from './core/actionScoring';

// ============================================================================
// HELPERS (Gemeinsame Utilities)
// ============================================================================

export {
  // Multiattack & BaseAction Resolution
  resolveMultiattackRefs,
  forEachResolvedAction,
  resolveBaseAction,
  resolveActionWithBase,
  // Damage/Healing PMF
  calculateBaseDamagePMF,
  calculateBaseHealingPMF,
  // Range Calculation
  getActionMaxRangeFeet,
  getActionMaxRangeCells,
  // Distance & Position
  getDistance,
  findNearestProfile,
  getMinDistanceToProfiles,
  type PositionedProfile,
  type NearestResult,
  // Alliance
  isAllied,
  isHostile,
  // Hit Chance
  calculateHitChance,
  calculateMultiattackDamage,
  // Save Calculation
  getProficiencyBonus,
  getSaveBonus,
  calculateSaveFailChance,
  // Potential Calculation
  calculateDamagePotential,
  calculateEffectiveDamagePotential,
  calculateHealPotential,
  calculateControlPotential,
  calculateCombatantValue,
} from './helpers/combatHelpers';

// ============================================================================
// ACTION AVAILABILITY
// ============================================================================

export {
  isActionAvailable,
  isActionUsable,
  matchesRequirement,
  hasIncapacitatingCondition,
  getAvailableActionsForCombatant,
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
} from './helpers/actionAvailability';

// ============================================================================
// TYPE RE-EXPORTS (from @/types/combat)
// ============================================================================

export {
  // Combatant Types
  type Combatant,
  type NPCInCombat,
  type CharacterInCombat,
  type CombatantState,
  type CombatantSimulationState,
  type CombatState,
  // Common Types
  type CombatResources,
  type ConditionState,
  type RangeCache,
  type ActionIntent,
  type CombatPreference,
  type ActionTargetScore,
  type CellScore,
  type CellEvaluation,
  type TurnAction,
  type TurnExplorationResult,
  // Type Guards
  createRangeCache,
  isNPC,
  isCharacter,
} from '@/types/combat';

// Movement utilities
export { getRelevantCells, calculateMovementDecay } from '@/utils';

// ============================================================================
// MODIFIER REGISTRATION
// ============================================================================

// Re-export registration function for explicit initialization
export { registerCoreModifiers } from './modifiers';
