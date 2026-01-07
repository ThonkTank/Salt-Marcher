// Probability Utils Index
// Siehe: docs/utils/pmf.md

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
  aggregateWeightedPools,
  sampleFromRange,
  lerp,
  type DiceRollDetail,
  type DiceRollResult,
} from './random';

export {
  type ProbabilityDistribution,
  type SerializedPMF,
  probabilityDistributionSchema,
  serializePMF,
  deserializePMF,
  createSingleValue,
  normalize,
  createUniformDie,
  addConstant,
  multiplyConstant,
  convolveDie,
  convolveDistributions,
  subtractDistributions,
  multiplyDistributions,
  divideDistributions,
  diceExpressionToPMF,
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  applyConditionProbability,
  getExpectedValue,
  getVariance,
  getStandardDeviation,
  getMode,
  getPercentile,
  getMinimum,
  getMaximum,
  getProbabilityAtMost,
  getProbabilityAtLeast,
} from './pmf';
