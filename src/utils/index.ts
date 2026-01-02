// Utils Index
// Siehe: docs/architecture/constants.md

export { parseDice, validateDiceExpression, asDiceExpression } from './diceParser';

export {
  randomBetween,
  weightedRandomSelect,
  randomSelect,
  randomNormal,
  rollDice,
  diceMin,
  diceMax,
  diceAvg,
  rollDiceDetailed,
  type DiceRollDetail,
  type DiceRollResult,
} from './random';

export { assertValidValue } from './validation';

export { hexDistance } from './hex';

export {
  resolveCultureChain,
  calculateLayerWeights,
  mergeWeightedPool,
  aggregateWeightedPools,
  accumulateWithUnwanted,
  type CultureSource,
  type CultureLayer,
} from './cultureResolution';

export {
  getCreatureById,
  getCreatureByIdFromGroups,
  iterateCreatures,
  iterateCreaturesWithSlot,
  countCreatures,
  getAllCreatures,
  hasCreature,
} from './encounterHelpers';
