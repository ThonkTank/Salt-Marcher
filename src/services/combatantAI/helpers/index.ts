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
  resolveMultiattackRefs,
  forEachResolvedAction,
  calculateBaseDamagePMF,
  calculateBaseHealingPMF,
  getActionMaxRangeFeet,
  getActionMaxRangeCells,
  getDistance,
  findNearestProfile,
  getMinDistanceToProfiles,
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
} from './combatHelpers';

export type { PositionedProfile, NearestResult } from './combatHelpers';

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
