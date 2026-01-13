// Utils Index
// Siehe: docs/architecture/constants.md

// Probability utilities (dice, random, PMF)
export * from './probability';

// Math utilities (vector, clamp)
export * from './math';

// Square-cell grid utilities (combat, dungeon)
export * from './squareSpace';

// Hex-cell grid utilities (overland)
export * from './hexSpace';

// Validation utilities
export { assertValidValue } from './validation';

// Culture resolution (NPC generation)
export {
  selectCulture,
  resolveAttributes,
  mergeLayerConfigs,
  buildFactionChain,
  type ResolvedAttributes,
} from './cultureResolution';

// Combat modifier utilities (expression evaluation, helpers)
// Note: getDistance and feetToCell already exported from squareSpace
export {
  evaluateCondition,
  createEvaluationContext,
  combatantToCombatantContext,
  type EvaluationContext,
  isAllied,
  isHostile,
} from './combatModifiers';
