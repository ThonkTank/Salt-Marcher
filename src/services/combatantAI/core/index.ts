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
  // Action Enumeration
  buildPossibleActions,
  getThreatWeight,
  hasGrantMovementEffect,
  getAvailableActionsWithLayers,
  // Target Helpers (re-exported from actionSelection)
  getCandidates,
  getEnemies,
  getAllies,
  // Types
  type ScoredAction,
} from './actionEnumeration';
