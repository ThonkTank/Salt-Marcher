// Ziel: Shared Combat Modifier Utilities
// Siehe: docs/services/combatTracking/gatherModifiers.md
//
// Re-exports für Expression Evaluation und Helper Functions.
// Verwendet von:
// - combatTracking/resolution/gatherModifiers.ts
// - combatantAI/situationalModifiers.ts
// - combatantAI/schemaModifierAdapter.ts

export {
  evaluateCondition,
  createEvaluationContext,
  combatantToCombatantContext,
  type EvaluationContext,
} from './expressionEvaluator';

export {
  getDistance,
  isAllied,
  isHostile,
  feetToCell,
} from './helpers';
