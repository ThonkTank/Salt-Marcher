// Ziel: Shared Combat Modifier Utilities
// Siehe: docs/services/combatTracking/getModifiers.md
//
// Re-exports für Expression Evaluation und Helper Functions.
// Verwendet von:
// - combatTracking/resolution/getModifiers.ts
// - combatantAI/situationalModifiers.ts
// - combatantAI/schemaModifierAdapter.ts

export {
  evaluateCondition,
  createEvaluationContext,
  type EvaluationContext,
} from './expressionEvaluator';

export {
  getDistance,
  isAllied,
  isHostile,
  feetToCell,
} from './helpers';
