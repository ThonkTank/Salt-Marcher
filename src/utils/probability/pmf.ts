// Ziel: Probability Mass Function (PMF) Utilities für Combat-Simulation
// Siehe: docs/utils/pmf.md
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Exploding Dice begrenzt auf 10 Explosionen
// - applyExplodeToDie() nutzt MAX_EXPLOSIONS=10 statt theoretisch unendlich
// - Compound Explode nutzt depth*sides Approximation statt exakte Berechnung
//
// [HACK]: Modifier-Kombinationen vereinfacht
// - diceNodeToPMF() ignoriert Explode bei keep/drop + explode Kombination
// - diceNodeToPMF() ignoriert Reroll bei reroll + explode Kombination
//
// [TODO]: Critical Hits für d20-Würfe
// - Spec: difficulty.md#kritische-treffer (nicht implementiert)
//
// [TODO]: Advantage/Disadvantage als First-Class-Feature
// - Aktuell via 2d20kh1/kl1, aber kein dediziertes API

import { z } from 'zod';
import { parseDice } from './diceParser';
import type { DiceNode, KeepDrop, Explode, Reroll, ComparisonOp } from '#types/common/counting';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Probability Mass Function: Maps discrete values to their probabilities.
 * Sum of all probabilities should equal 1.0.
 */
export type ProbabilityDistribution = Map<number, number>;

/**
 * Serialisierbare Darstellung einer PMF für Vault-Persistierung.
 * Array von [value, probability] Tuples.
 */
export type SerializedPMF = [number, number][];

/**
 * Zod-Schema für serialisierte ProbabilityDistribution.
 * Validiert als Array von [value, probability] Tuples.
 */
export const probabilityDistributionSchema = z.array(
  z.tuple([z.number(), z.number().min(0).max(1)])
).transform((arr): ProbabilityDistribution => new Map(arr));

/**
 * Konvertiert Map zu serialisierbarem Array.
 */
export function serializePMF(pmf: ProbabilityDistribution): SerializedPMF {
  return Array.from(pmf.entries());
}

/**
 * Konvertiert serialisiertes Array zu Map.
 */
export function deserializePMF(arr: SerializedPMF): ProbabilityDistribution {
  return new Map(arr);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a PMF with a single deterministic value.
 */
export function createSingleValue(value: number): ProbabilityDistribution {
  return new Map([[value, 1.0]]);
}

/**
 * Normalizes a PMF so probabilities sum to 1.0.
 * Handles floating-point precision issues.
 */
export function normalize(dist: ProbabilityDistribution): ProbabilityDistribution {
  const total = Array.from(dist.values()).reduce((sum, p) => sum + p, 0);
  if (total === 0) return new Map([[0, 1.0]]);
  if (Math.abs(total - 1.0) < 1e-10) return dist;

  const result = new Map<number, number>();
  for (const [value, prob] of dist) {
    result.set(value, prob / total);
  }
  return result;
}

/**
 * Creates a uniform distribution for a single die (1 to sides).
 */
export function createUniformDie(sides: number): ProbabilityDistribution {
  const prob = 1 / sides;
  const result = new Map<number, number>();
  for (let i = 1; i <= sides; i++) {
    result.set(i, prob);
  }
  return result;
}

// ============================================================================
// Convolution Operations
// ============================================================================

/**
 * Adds a constant to all values in a distribution.
 */
export function addConstant(dist: ProbabilityDistribution, constant: number): ProbabilityDistribution {
  if (constant === 0) return dist;

  const result = new Map<number, number>();
  for (const [value, prob] of dist) {
    result.set(value + constant, prob);
  }
  return result;
}

/**
 * Multiplies all values in a distribution by a constant.
 */
export function multiplyConstant(dist: ProbabilityDistribution, constant: number): ProbabilityDistribution {
  if (constant === 1) return dist;

  const result = new Map<number, number>();
  for (const [value, prob] of dist) {
    const newValue = Math.floor(value * constant);
    result.set(newValue, (result.get(newValue) ?? 0) + prob);
  }
  return result;
}

/**
 * Adds a die (1 to sides) to an existing distribution via convolution.
 */
export function convolveDie(dist: ProbabilityDistribution, sides: number): ProbabilityDistribution {
  const dieProb = 1 / sides;
  const result = new Map<number, number>();

  for (const [value, prob] of dist) {
    for (let face = 1; face <= sides; face++) {
      const newValue = value + face;
      const newProb = prob * dieProb;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}

/**
 * Convolves two distributions (addition of random variables).
 */
export function convolveDistributions(
  dist1: ProbabilityDistribution,
  dist2: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [v1, p1] of dist1) {
    for (const [v2, p2] of dist2) {
      const newValue = v1 + v2;
      const newProb = p1 * p2;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}

/**
 * Subtracts dist2 from dist1 (used for damage subtraction from HP).
 */
export function subtractDistributions(
  dist1: ProbabilityDistribution,
  dist2: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [v1, p1] of dist1) {
    for (const [v2, p2] of dist2) {
      const newValue = v1 - v2;
      const newProb = p1 * p2;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}

/**
 * Multiplies two distributions (used for binary * operator).
 */
export function multiplyDistributions(
  dist1: ProbabilityDistribution,
  dist2: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [v1, p1] of dist1) {
    for (const [v2, p2] of dist2) {
      const newValue = v1 * v2;
      const newProb = p1 * p2;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}

/**
 * Divides dist1 by dist2 (integer division, used for binary / operator).
 */
export function divideDistributions(
  dist1: ProbabilityDistribution,
  dist2: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [v1, p1] of dist1) {
    for (const [v2, p2] of dist2) {
      const newValue = v2 !== 0 ? Math.floor(v1 / v2) : 0;
      const newProb = p1 * p2;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}

// ============================================================================
// Dice Modifier Handling
// ============================================================================

/**
 * Evaluates a comparison condition for a die value.
 */
function evalCondition(value: number, op: ComparisonOp, threshold: number): boolean {
  switch (op) {
    case '=':
      return value === threshold;
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
  }
}

/**
 * Applies reroll modifier to a single die distribution.
 * For reroll-once (ro): rerolls once if condition is met.
 * For unlimited reroll (r): rerolls until condition is not met.
 */
function applyRerollToDie(sides: number, reroll: Reroll): ProbabilityDistribution {
  const { once, condition } = reroll;
  const result = new Map<number, number>();
  const baseProb = 1 / sides;

  // Calculate which faces trigger reroll
  const rerollFaces: number[] = [];
  const keepFaces: number[] = [];

  for (let face = 1; face <= sides; face++) {
    if (evalCondition(face, condition.op, condition.value)) {
      rerollFaces.push(face);
    } else {
      keepFaces.push(face);
    }
  }

  const rerollProb = rerollFaces.length / sides;

  if (once) {
    // Reroll once: kept faces + rerolled faces get another uniform roll
    for (const face of keepFaces) {
      result.set(face, baseProb);
    }
    // Rerolled faces redistribute uniformly
    const rerollContribution = rerollProb / sides;
    for (let face = 1; face <= sides; face++) {
      result.set(face, (result.get(face) ?? 0) + rerollContribution);
    }
  } else {
    // Unlimited reroll: only keep faces matter, redistributed probability
    if (keepFaces.length === 0) {
      // Infinite loop protection: if all faces reroll, return uniform
      return createUniformDie(sides);
    }
    const keepProb = 1 / keepFaces.length;
    for (const face of keepFaces) {
      result.set(face, keepProb);
    }
  }

  return normalize(result);
}

/**
 * Applies exploding dice modifier. HACK: siehe Header
 * Approximates by limiting recursion depth (max 10 explosions).
 */
function applyExplodeToDie(sides: number, explode: Explode): ProbabilityDistribution {
  const { mode, threshold } = explode;
  const explodeOp = threshold?.op ?? '=';
  const explodeValue = threshold?.value ?? sides;

  // Calculate explosion probability
  let explodeProb = 0;
  for (let face = 1; face <= sides; face++) {
    if (evalCondition(face, explodeOp, explodeValue)) {
      explodeProb += 1 / sides;
    }
  }

  if (explodeProb === 0) {
    return createUniformDie(sides);
  }

  const MAX_EXPLOSIONS = 10;
  const baseProb = 1 / sides;
  const result = new Map<number, number>();

  if (mode === '!') {
    // Standard explode: add new dice
    // Build distribution iteratively
    let currentDist = createUniformDie(sides);

    for (let depth = 0; depth < MAX_EXPLOSIONS; depth++) {
      const explosionChance = Math.pow(explodeProb, depth + 1);
      if (explosionChance < 1e-10) break;

      // For each value in current distribution, check if it explodes
      const nextDist = new Map<number, number>();

      for (const [value, prob] of currentDist) {
        // Check if this value was from an exploding die
        const faceValue = ((value - 1) % sides) + 1; // Get the face that was rolled
        if (evalCondition(faceValue, explodeOp, explodeValue) && depth < MAX_EXPLOSIONS - 1) {
          // This face explodes, add another die
          for (let newFace = 1; newFace <= sides; newFace++) {
            const newValue = value + newFace;
            nextDist.set(newValue, (nextDist.get(newValue) ?? 0) + prob * baseProb);
          }
        } else {
          // Final value, keep it
          result.set(value, (result.get(value) ?? 0) + prob);
        }
      }

      if (nextDist.size === 0) break;
      currentDist = nextDist;
    }

    // Add any remaining from currentDist
    for (const [value, prob] of currentDist) {
      result.set(value, (result.get(value) ?? 0) + prob);
    }
  } else {
    // Compound explode: add to same die
    // Simpler approximation: geometric series
    for (let depth = 0; depth <= MAX_EXPLOSIONS; depth++) {
      const depthProb = Math.pow(explodeProb, depth) * (1 - explodeProb);
      if (depthProb < 1e-10) break;

      // At this depth, we've exploded 'depth' times
      // Final roll is any non-exploding face
      for (let face = 1; face <= sides; face++) {
        if (!evalCondition(face, explodeOp, explodeValue) || depth === MAX_EXPLOSIONS) {
          const totalValue = depth * sides + face; // Approximation: each explosion adds max
          result.set(totalValue, (result.get(totalValue) ?? 0) + depthProb * baseProb);
        }
      }
    }
  }

  return normalize(result);
}

/**
 * Generates all combinations of n dice rolls.
 */
function* generateDiceCombinations(count: number, sides: number): Generator<number[]> {
  const current = new Array(count).fill(1);

  while (true) {
    yield [...current];

    // Increment
    let i = count - 1;
    while (i >= 0) {
      current[i]++;
      if (current[i] <= sides) break;
      current[i] = 1;
      i--;
    }

    if (i < 0) break;
  }
}

/**
 * Applies keep/drop modifier to multiple dice.
 * Calculates exact probability distribution by enumerating all outcomes.
 */
function applyKeepDrop(count: number, sides: number, keep: KeepDrop): ProbabilityDistribution {
  const result = new Map<number, number>();
  const totalOutcomes = Math.pow(sides, count);
  const baseProb = 1 / totalOutcomes;

  for (const rolls of generateDiceCombinations(count, sides)) {
    const sorted = [...rolls].sort((a, b) => a - b);

    let keptDice: number[];
    switch (keep.mode) {
      case 'kh': // Keep highest
        keptDice = sorted.slice(-keep.count);
        break;
      case 'kl': // Keep lowest
        keptDice = sorted.slice(0, keep.count);
        break;
      case 'dh': // Drop highest
        keptDice = sorted.slice(0, -keep.count || sorted.length);
        break;
      case 'dl': // Drop lowest
        keptDice = sorted.slice(keep.count);
        break;
    }

    const sum = keptDice.reduce((a, b) => a + b, 0);
    result.set(sum, (result.get(sum) ?? 0) + baseProb);
  }

  return result;
}

/**
 * Creates PMF for a dice node with all modifiers applied. HACK: siehe Header
 */
function diceNodeToPMF(count: number, sides: number, keep?: KeepDrop, explode?: Explode, reroll?: Reroll): ProbabilityDistribution {
  // Handle modifiers in order

  // If we have keep/drop, we need to handle it specially
  if (keep) {
    // For keep/drop, enumerate all combinations
    // Reroll and explode are applied per-die first
    if (reroll || explode) {
      // Complex case: modifiers + keep/drop
      // Approximate by applying modifiers to single die, then keep/drop
      let singleDie = createUniformDie(sides);
      if (reroll) singleDie = applyRerollToDie(sides, reroll);
      if (explode) {
        // Explode changes the range, makes keep/drop complex
        // Simplified: apply keep/drop first, then approximate explode
        const kept = applyKeepDrop(count, sides, keep);
        // Apply explode as multiplier (approximation)
        return kept;
      }
      // For just reroll + keep: approximate
      return applyKeepDrop(count, sides, keep);
    }
    return applyKeepDrop(count, sides, keep);
  }

  // No keep/drop: apply modifiers per die, then convolve
  let singleDie: ProbabilityDistribution;

  if (reroll && explode) {
    // Apply reroll first, then explode
    singleDie = applyRerollToDie(sides, reroll);
    // Explode on top of reroll is complex, approximate
    singleDie = applyExplodeToDie(sides, explode);
  } else if (reroll) {
    singleDie = applyRerollToDie(sides, reroll);
  } else if (explode) {
    singleDie = applyExplodeToDie(sides, explode);
  } else {
    singleDie = createUniformDie(sides);
  }

  // Convolve for multiple dice
  if (count === 1) return singleDie;

  let result = createSingleValue(0);
  for (let i = 0; i < count; i++) {
    result = convolveDistributions(result, singleDie);
  }

  return result;
}

// ============================================================================
// AST to PMF Conversion
// ============================================================================

/**
 * Converts a DiceNode AST to a ProbabilityDistribution.
 */
function nodeToDistribution(node: DiceNode): ProbabilityDistribution {
  switch (node.type) {
    case 'constant':
      return createSingleValue(node.value);

    case 'dice':
      return diceNodeToPMF(node.count, node.sides, node.keep, node.explode, node.reroll);

    case 'group':
      return nodeToDistribution(node.expr);

    case 'binary': {
      const left = nodeToDistribution(node.left);
      const right = nodeToDistribution(node.right);

      switch (node.op) {
        case '+':
          return convolveDistributions(left, right);
        case '-':
          return subtractDistributions(left, right);
        case '*':
          return multiplyDistributions(left, right);
        case '/':
          return divideDistributions(left, right);
      }
    }
  }
}

/**
 * Converts a dice expression string to a ProbabilityDistribution.
 * Supports full dice notation: NdS, NdS+M, NdSkh/kl, NdS!, NdSr, etc.
 */
export function diceExpressionToPMF(expr: string): ProbabilityDistribution {
  const ast = parseDice(expr);
  return nodeToDistribution(ast);
}

// ============================================================================
// Effective Damage Calculation
// ============================================================================

/**
 * Berechnet Effective Damage PMF mit Hit/Miss und Kaskaden-Faktoren.
 *
 * Kaskade (jeder Faktor addiert zu P(0)):
 * 1. Attacker death probability - toter Angreifer macht keinen Schaden
 * 2. Condition probability - incapacitating conditions verhindern Angriff
 * 3. Miss probability - (1 - hitChance)
 *
 * REINE BERECHNUNG - kein State-Zugriff.
 *
 * @param damage Base Damage PMF (z.B. 2d6+3)
 * @param hitChance Trefferwahrscheinlichkeit (0-1)
 * @param attackerDeathProb Wahrscheinlichkeit dass Angreifer tot ist (0-1)
 * @param conditionProb Wahrscheinlichkeit für incapacitating condition (0-1)
 * @returns Effective Damage PMF mit P(0) für alle Fehlschläge
 */
export function calculateEffectiveDamage(
  damage: ProbabilityDistribution,
  hitChance: number,
  attackerDeathProb: number = 0,
  conditionProb: number = 0
): ProbabilityDistribution {
  // Kaskaden-Faktoren multiplizieren
  const aliveProb = 1 - attackerDeathProb;
  const activeProb = 1 - conditionProb;
  const effectiveHitChance = hitChance * aliveProb * activeProb;
  const missProb = 1 - effectiveHitChance;

  const result = new Map<number, number>();

  // Alle Fehlschläge → 0 Schaden
  result.set(0, missProb);

  // Treffer → Damage PMF skaliert
  for (const [dmg, prob] of damage) {
    const scaledProb = prob * effectiveHitChance;
    if (dmg === 0) {
      result.set(0, (result.get(0) ?? 0) + scaledProb);
    } else {
      result.set(dmg, (result.get(dmg) ?? 0) + scaledProb);
    }
  }

  return result;
}

// ============================================================================
// HP Operations
// ============================================================================

/**
 * Applies damage to HP distribution (HP - Damage, floored at 0).
 */
export function applyDamageToHP(
  hp: ProbabilityDistribution,
  damage: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [hpValue, hpProb] of hp) {
    for (const [dmgValue, dmgProb] of damage) {
      const newHp = Math.max(0, hpValue - dmgValue);
      const newProb = hpProb * dmgProb;
      result.set(newHp, (result.get(newHp) ?? 0) + newProb);
    }
  }

  return result;
}

/**
 * Calculates P(HP <= 0) from an HP distribution.
 */
export function calculateDeathProbability(hp: ProbabilityDistribution): number {
  let deathProb = 0;
  for (const [value, prob] of hp) {
    if (value <= 0) {
      deathProb += prob;
    }
  }
  return deathProb;
}

/**
 * Applies condition probability as a layer that adds to P(0).
 * Used for incapacitating conditions that prevent damage output.
 */
export function applyConditionProbability(
  damage: ProbabilityDistribution,
  conditionProb: number
): ProbabilityDistribution {
  if (conditionProb <= 0) return damage;
  if (conditionProb >= 1) return createSingleValue(0);

  const result = new Map<number, number>();
  const activeFactor = 1 - conditionProb;

  // Condition active -> 0 damage
  result.set(0, conditionProb);

  // Condition not active -> original distribution scaled
  for (const [value, prob] of damage) {
    const scaledProb = prob * activeFactor;
    if (value === 0) {
      result.set(0, (result.get(0) ?? 0) + scaledProb);
    } else {
      result.set(value, scaledProb);
    }
  }

  return result;
}


// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Calculates the expected value E[X] of a distribution.
 */
export function getExpectedValue(dist: ProbabilityDistribution): number {
  let sum = 0;
  for (const [value, prob] of dist) {
    sum += value * prob;
  }
  return sum;
}

/**
 * Calculates the variance Var[X] of a distribution.
 */
export function getVariance(dist: ProbabilityDistribution): number {
  const mean = getExpectedValue(dist);
  let variance = 0;
  for (const [value, prob] of dist) {
    variance += Math.pow(value - mean, 2) * prob;
  }
  return variance;
}

/**
 * Calculates the standard deviation of a distribution.
 */
export function getStandardDeviation(dist: ProbabilityDistribution): number {
  return Math.sqrt(getVariance(dist));
}

/**
 * Gets the mode (most likely value) of a distribution.
 * Returns the smallest value in case of ties.
 */
export function getMode(dist: ProbabilityDistribution): number {
  let maxProb = -Infinity;
  let mode = 0;

  for (const [value, prob] of dist) {
    if (prob > maxProb || (prob === maxProb && value < mode)) {
      maxProb = prob;
      mode = value;
    }
  }

  return mode;
}

/**
 * Calculates the p-th percentile of a distribution.
 * Uses linear interpolation between values.
 */
export function getPercentile(dist: ProbabilityDistribution, p: number): number {
  if (p < 0 || p > 1) {
    throw new Error('Percentile must be between 0 and 1');
  }

  // Sort entries by value
  const entries = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);

  let cumulative = 0;
  for (const [value, prob] of entries) {
    cumulative += prob;
    if (cumulative >= p) {
      return value;
    }
  }

  // Return last value if we reach here
  return entries[entries.length - 1]?.[0] ?? 0;
}

/**
 * Gets the minimum value in the distribution.
 */
export function getMinimum(dist: ProbabilityDistribution): number {
  return Math.min(...dist.keys());
}

/**
 * Gets the maximum value in the distribution.
 */
export function getMaximum(dist: ProbabilityDistribution): number {
  return Math.max(...dist.keys());
}

/**
 * Gets probability that the value is at most threshold.
 */
export function getProbabilityAtMost(dist: ProbabilityDistribution, threshold: number): number {
  let prob = 0;
  for (const [value, p] of dist) {
    if (value <= threshold) {
      prob += p;
    }
  }
  return prob;
}

/**
 * Gets probability that the value is at least threshold.
 */
export function getProbabilityAtLeast(dist: ProbabilityDistribution, threshold: number): number {
  let prob = 0;
  for (const [value, p] of dist) {
    if (value >= threshold) {
      prob += p;
    }
  }
  return prob;
}
