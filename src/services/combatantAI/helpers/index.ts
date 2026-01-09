// Ziel: Unified exports fuer Helper-Funktionen
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Helper-Module:
// - actionSelection: Candidate/Target-Filterung (getCandidates, getEnemies, getAllies)
// - combatHelpers: Gemeinsame Berechnungen (Hit Chance, Damage, Distance, Alliance)
// - actionAvailability: Action-Verfuegbarkeit (isActionAvailable, Resource-Management)
// - pruningHelpers: Pruning-Heuristiken (computeGlobalBestByType, estimateMaxFollowUpGain)

// Re-exports aus actionSelection
export { getCandidates, getEnemies, getAllies } from './actionSelection';

// Re-exports aus combatHelpers (wird in 5.1c verschoben)
export {
  // Multiattack & BaseAction Resolution
  resolveMultiattackRefs,
  forEachResolvedAction,
  resolveBaseAction,
  resolveActionWithBase,
  // Damage & Healing PMF
  calculateBaseDamagePMF,
  calculateBaseHealingPMF,
  getActionMaxRangeFeet,
  getActionMaxRangeCells,
  getDistance,
  findNearestProfile,
  getMinDistanceToProfiles,
  getReachableCells,
  isAllied,
  isHostile,
  calculateHitChance,
  calculateMultiattackDamage,
  getProficiencyBonus,
  getSaveBonus,
  calculateSaveFailChance,
  calculateDamagePotential,
  calculateEffectiveDamagePotential,
  calculateHealPotential,
  calculateControlPotential,
  calculateCombatantValue,
  // Turn Order & Movement Band Helpers
  getTurnsUntilNextTurn,
  getMovementBands,
  getCellBand,
  applyDistanceDecay,
  DECAY_CONSTANTS,
  // Property Modifier Application
  applyPropertyModifiers,
} from './combatHelpers';

export type { PositionedProfile, NearestResult, GetReachableCellsOptions } from './combatHelpers';

// Re-exports aus actionAvailability
export {
  hasIncapacitatingCondition,
  isActionAvailable,
  matchesRequirement,
  isActionUsable,
  getAvailableActionsForCombatant,
} from './actionAvailability';

// Re-exports aus pruningHelpers
export { computeGlobalBestByType, estimateMaxFollowUpGain } from './pruningHelpers';
