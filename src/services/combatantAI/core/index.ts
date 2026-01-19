// Ziel: Re-exports für core/ Module
// Siehe: docs/services/combatantAI/simulationState.md

export {
  // Budget operations
  isBudgetExhausted,
  consumeBudget,
  // State operations
  cloneState,
  projectState,
  // Types
  type BudgetConsumption,
  type StateProjection,
} from './stateProjection';

export {
  // CombatEvent Enumeration
  buildPossibleCombatEvents,
  getThreatWeight,
  hasTimingBudget,
  getAvailableCombatEventsWithLayers,
  // Conversion
  toTurnCombatEvent,
  // Target Helpers (re-exported from actionSelection)
  getCandidates,
  getEnemies,
  getAllies,
  // Types
  type ScoredCombatEvent,
} from './actionEnumeration';
