// Unit Tests for PMF Utilities
// Siehe: docs/services/encounter/difficulty.md#probability-mass-function-pmf

import { describe, it, expect } from 'vitest';
import {
  type ProbabilityDistribution,
  createSingleValue,
  normalize,
  createUniformDie,
  addConstant,
  multiplyConstant,
  convolveDie,
  convolveDistributions,
  subtractDistributions,
  diceExpressionToPMF,
  applyDamageToHP,
  calculateDeathProbability,
  applyConditionProbability,
  calculateEffectiveDamage,
  getExpectedValue,
  getVariance,
  getStandardDeviation,
  getMode,
  getPercentile,
  getMinimum,
  getMaximum,
  getProbabilityAtMost,
  getProbabilityAtLeast,
} from '../pmf';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Compares two PMFs with tolerance for floating-point precision.
 */
function expectPMFClose(actual: ProbabilityDistribution, expected: ProbabilityDistribution, tolerance = 1e-6): void {
  expect(actual.size).toBe(expected.size);

  for (const [value, prob] of expected) {
    expect(actual.has(value)).toBe(true);
    expect(actual.get(value)).toBeCloseTo(prob, 6);
  }

  // Verify probabilities sum to 1
  const total = Array.from(actual.values()).reduce((sum, p) => sum + p, 0);
  expect(total).toBeCloseTo(1.0, tolerance);
}

/**
 * Verifies that a PMF sums to 1.
 */
function expectNormalized(dist: ProbabilityDistribution, tolerance = 1e-6): void {
  const total = Array.from(dist.values()).reduce((sum, p) => sum + p, 0);
  expect(total).toBeCloseTo(1.0, tolerance);
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('createSingleValue', () => {
  it('creates a PMF with a single value at probability 1', () => {
    const dist = createSingleValue(5);
    expect(dist.size).toBe(1);
    expect(dist.get(5)).toBe(1.0);
  });

  it('works with negative values', () => {
    const dist = createSingleValue(-3);
    expect(dist.get(-3)).toBe(1.0);
  });

  it('works with zero', () => {
    const dist = createSingleValue(0);
    expect(dist.get(0)).toBe(1.0);
  });
});

describe('normalize', () => {
  it('normalizes probabilities to sum to 1', () => {
    const unnormalized = new Map<number, number>([
      [1, 0.2],
      [2, 0.3],
    ]);
    const normalized = normalize(unnormalized);
    expect(normalized.get(1)).toBeCloseTo(0.4, 6);
    expect(normalized.get(2)).toBeCloseTo(0.6, 6);
  });

  it('handles already normalized PMF', () => {
    const dist = new Map<number, number>([
      [1, 0.5],
      [2, 0.5],
    ]);
    const result = normalize(dist);
    expect(result.get(1)).toBeCloseTo(0.5, 6);
    expect(result.get(2)).toBeCloseTo(0.5, 6);
  });

  it('handles empty PMF by returning single value at 0', () => {
    const result = normalize(new Map());
    expect(result.get(0)).toBe(1.0);
  });
});

describe('createUniformDie', () => {
  it('creates uniform distribution for d6', () => {
    const d6 = createUniformDie(6);
    expect(d6.size).toBe(6);
    for (let i = 1; i <= 6; i++) {
      expect(d6.get(i)).toBeCloseTo(1 / 6, 6);
    }
    expectNormalized(d6);
  });

  it('creates uniform distribution for d20', () => {
    const d20 = createUniformDie(20);
    expect(d20.size).toBe(20);
    for (let i = 1; i <= 20; i++) {
      expect(d20.get(i)).toBeCloseTo(1 / 20, 6);
    }
    expectNormalized(d20);
  });
});

// ============================================================================
// Convolution Tests
// ============================================================================

describe('addConstant', () => {
  it('adds constant to all values', () => {
    const d6 = createUniformDie(6);
    const result = addConstant(d6, 3);

    expect(result.size).toBe(6);
    expect(result.has(1)).toBe(false);
    expect(result.get(4)).toBeCloseTo(1 / 6, 6);
    expect(result.get(9)).toBeCloseTo(1 / 6, 6);
    expectNormalized(result);
  });

  it('handles zero constant', () => {
    const d6 = createUniformDie(6);
    const result = addConstant(d6, 0);
    expect(result).toBe(d6); // Same reference for optimization
  });

  it('handles negative constant', () => {
    const d6 = createUniformDie(6);
    const result = addConstant(d6, -2);

    expect(result.get(-1)).toBeCloseTo(1 / 6, 6);
    expect(result.get(4)).toBeCloseTo(1 / 6, 6);
  });
});

describe('convolveDie', () => {
  it('convolves 0 with d6 to get d6', () => {
    const start = createSingleValue(0);
    const result = convolveDie(start, 6);

    expect(result.size).toBe(6);
    for (let i = 1; i <= 6; i++) {
      expect(result.get(i)).toBeCloseTo(1 / 6, 6);
    }
  });

  it('creates 2d6 distribution correctly', () => {
    // 2d6: values 2-12, with 7 being most likely
    const d6 = createUniformDie(6);
    const twoD6 = convolveDie(d6, 6);

    expect(twoD6.size).toBe(11); // 2 to 12
    expect(twoD6.get(2)).toBeCloseTo(1 / 36, 6); // Only 1+1
    expect(twoD6.get(7)).toBeCloseTo(6 / 36, 6); // 1+6, 2+5, 3+4, 4+3, 5+2, 6+1
    expect(twoD6.get(12)).toBeCloseTo(1 / 36, 6); // Only 6+6
    expectNormalized(twoD6);
  });
});

describe('convolveDistributions', () => {
  it('convolves two constants', () => {
    const a = createSingleValue(3);
    const b = createSingleValue(5);
    const result = convolveDistributions(a, b);

    expect(result.size).toBe(1);
    expect(result.get(8)).toBe(1.0);
  });

  it('convolves d6 + d6 correctly', () => {
    const d6a = createUniformDie(6);
    const d6b = createUniformDie(6);
    const result = convolveDistributions(d6a, d6b);

    expect(result.size).toBe(11);
    expect(result.get(7)).toBeCloseTo(6 / 36, 6);
    expectNormalized(result);
  });
});

describe('subtractDistributions', () => {
  it('subtracts constants correctly', () => {
    const a = createSingleValue(10);
    const b = createSingleValue(3);
    const result = subtractDistributions(a, b);

    expect(result.get(7)).toBe(1.0);
  });

  it('creates distribution for d6 - d6', () => {
    const d6a = createUniformDie(6);
    const d6b = createUniformDie(6);
    const result = subtractDistributions(d6a, d6b);

    // d6 - d6 ranges from -5 to +5
    expect(result.get(0)).toBeCloseTo(6 / 36, 6); // 1-1, 2-2, ..., 6-6
    expect(result.get(-5)).toBeCloseTo(1 / 36, 6); // 1-6
    expect(result.get(5)).toBeCloseTo(1 / 36, 6); // 6-1
  });
});

// ============================================================================
// Dice Expression Tests
// ============================================================================

describe('diceExpressionToPMF', () => {
  it('parses simple d6', () => {
    const result = diceExpressionToPMF('1d6');

    expect(result.size).toBe(6);
    for (let i = 1; i <= 6; i++) {
      expect(result.get(i)).toBeCloseTo(1 / 6, 6);
    }
  });

  it('parses 2d6', () => {
    const result = diceExpressionToPMF('2d6');

    expect(result.size).toBe(11);
    expect(result.get(2)).toBeCloseTo(1 / 36, 6);
    expect(result.get(7)).toBeCloseTo(6 / 36, 6);
  });

  it('parses d6+3', () => {
    const result = diceExpressionToPMF('1d6+3');

    expect(result.size).toBe(6);
    expect(result.get(4)).toBeCloseTo(1 / 6, 6);
    expect(result.get(9)).toBeCloseTo(1 / 6, 6);
  });

  it('parses 2d6+4', () => {
    const result = diceExpressionToPMF('2d6+4');

    // Range: 6 to 16
    expect(getMinimum(result)).toBe(6);
    expect(getMaximum(result)).toBe(16);
    expect(result.get(11)).toBeCloseTo(6 / 36, 6); // Peak at 7+4=11
  });

  it('parses constant expression', () => {
    const result = diceExpressionToPMF('5');

    expect(result.size).toBe(1);
    expect(result.get(5)).toBe(1.0);
  });

  it('parses subtraction: 1d6-2', () => {
    const result = diceExpressionToPMF('1d6-2');

    expect(getMinimum(result)).toBe(-1);
    expect(getMaximum(result)).toBe(4);
  });

  it('parses keep highest: 4d6kh3', () => {
    const result = diceExpressionToPMF('4d6kh3');

    // 4d6 keep highest 3: range 3-18
    expect(getMinimum(result)).toBe(3);
    expect(getMaximum(result)).toBe(18);
    expectNormalized(result);

    // Mode should be around 13-14 for ability scores
    const mode = getMode(result);
    expect(mode).toBeGreaterThanOrEqual(12);
    expect(mode).toBeLessThanOrEqual(14);
  });

  it('parses keep lowest: 2d20kl1 (disadvantage)', () => {
    const result = diceExpressionToPMF('2d20kl1');

    expect(getMinimum(result)).toBe(1);
    expect(getMaximum(result)).toBe(20);
    expectNormalized(result);

    // Lower values should be more likely
    expect(result.get(1)!).toBeGreaterThan(result.get(20)!);
  });

  it('parses complex expression: 2d6+1d4+3', () => {
    const result = diceExpressionToPMF('2d6+1d4+3');

    // 2d6: 2-12, 1d4: 1-4, +3 -> Range: 6 to 19
    expect(getMinimum(result)).toBe(6);
    expect(getMaximum(result)).toBe(19);
    expectNormalized(result);
  });
});

// ============================================================================
// HP Operation Tests
// ============================================================================

describe('applyDamageToHP', () => {
  it('applies damage to HP, flooring at 0', () => {
    const hp = createSingleValue(10);
    const damage = createSingleValue(7);
    const result = applyDamageToHP(hp, damage);

    expect(result.get(3)).toBe(1.0);
  });

  it('floors HP at 0 for overkill', () => {
    const hp = createSingleValue(5);
    const damage = createSingleValue(10);
    const result = applyDamageToHP(hp, damage);

    expect(result.get(0)).toBe(1.0);
    expect(result.has(-5)).toBe(false);
  });

  it('handles distribution damage', () => {
    const hp = createSingleValue(10);
    const damage = diceExpressionToPMF('1d6');
    const result = applyDamageToHP(hp, damage);

    // HP should be 4-9
    expect(result.size).toBe(6);
    for (let i = 4; i <= 9; i++) {
      expect(result.get(i)).toBeCloseTo(1 / 6, 6);
    }
  });

  it('handles HP distribution with damage', () => {
    // HP: 50% at 10, 50% at 5
    const hp = new Map<number, number>([
      [10, 0.5],
      [5, 0.5],
    ]);
    const damage = createSingleValue(7);
    const result = applyDamageToHP(hp, damage);

    // HP 10 - 7 = 3 (50%)
    // HP 5 - 7 = 0 (floored from -2) (50%)
    expect(result.get(3)).toBeCloseTo(0.5, 6);
    expect(result.get(0)).toBeCloseTo(0.5, 6);
  });
});

describe('calculateDeathProbability', () => {
  it('returns 0 for healthy creature', () => {
    const hp = createSingleValue(20);
    expect(calculateDeathProbability(hp)).toBe(0);
  });

  it('returns 1 for dead creature', () => {
    const hp = createSingleValue(0);
    expect(calculateDeathProbability(hp)).toBe(1);
  });

  it('calculates partial death probability', () => {
    const hp = new Map<number, number>([
      [0, 0.3],
      [5, 0.7],
    ]);
    expect(calculateDeathProbability(hp)).toBeCloseTo(0.3, 6);
  });

  it('includes negative HP in death probability', () => {
    const hp = new Map<number, number>([
      [-5, 0.2],
      [0, 0.3],
      [5, 0.5],
    ]);
    expect(calculateDeathProbability(hp)).toBeCloseTo(0.5, 6);
  });
});

describe('applyConditionProbability', () => {
  it('adds to P(0) based on condition probability', () => {
    const damage = diceExpressionToPMF('1d6+3'); // 4-9
    const result = applyConditionProbability(damage, 0.3);

    // 30% chance of 0 damage, 70% of original
    expect(result.get(0)).toBeCloseTo(0.3, 6);

    // Other values scaled by 0.7
    for (let i = 4; i <= 9; i++) {
      expect(result.get(i)).toBeCloseTo((1 / 6) * 0.7, 6);
    }
  });

  it('returns original for 0 condition probability', () => {
    const damage = createSingleValue(5);
    const result = applyConditionProbability(damage, 0);

    expect(result.get(5)).toBe(1.0);
  });

  it('returns all zeros for 100% condition probability', () => {
    const damage = diceExpressionToPMF('1d6');
    const result = applyConditionProbability(damage, 1.0);

    expect(result.get(0)).toBe(1.0);
    expect(result.size).toBe(1);
  });
});

describe('calculateEffectiveDamage + applyDamageToHP', () => {
  it('applies full probability cascade', () => {
    const hp = createSingleValue(45);
    const damage = diceExpressionToPMF('1d6+2'); // 3-8
    const hitChance = 0.65;

    const effectiveDamage = calculateEffectiveDamage(damage, hitChance);
    const result = applyDamageToHP(hp, effectiveDamage);

    // 35% miss -> HP stays at 45
    // 65% hit -> HP reduced by 3-8
    expect(result.get(45)).toBeCloseTo(0.35, 6);

    // Check that damaged HP values exist
    for (let dmg = 3; dmg <= 8; dmg++) {
      const newHp = 45 - dmg;
      expect(result.has(newHp)).toBe(true);
      expect(result.get(newHp)).toBeCloseTo(0.65 / 6, 6);
    }
  });

  it('applies attacker death probability', () => {
    const hp = createSingleValue(20);
    const damage = createSingleValue(5);
    const hitChance = 1.0;
    const attackerDeathProb = 0.5;

    const effectiveDamage = calculateEffectiveDamage(damage, hitChance, attackerDeathProb);
    const result = applyDamageToHP(hp, effectiveDamage);

    // 50% attacker dead -> no damage
    // 50% attacker alive -> 5 damage
    expect(result.get(20)).toBeCloseTo(0.5, 6);
    expect(result.get(15)).toBeCloseTo(0.5, 6);
  });

  it('applies condition probability layer', () => {
    const hp = createSingleValue(20);
    const damage = createSingleValue(5);
    const hitChance = 1.0;
    const attackerDeathProb = 0;
    const conditionProb = 0.4;

    const effectiveDamage = calculateEffectiveDamage(damage, hitChance, attackerDeathProb, conditionProb);
    const result = applyDamageToHP(hp, effectiveDamage);

    // 40% incapacitated -> no damage
    // 60% active -> 5 damage
    expect(result.get(20)).toBeCloseTo(0.4, 6);
    expect(result.get(15)).toBeCloseTo(0.6, 6);
  });

  it('combines all cascade factors', () => {
    const hp = createSingleValue(20);
    const damage = createSingleValue(5);
    const hitChance = 0.5;
    const attackerDeathProb = 0.2;
    const conditionProb = 0.1;

    const effectiveDamage = calculateEffectiveDamage(damage, hitChance, attackerDeathProb, conditionProb);
    const result = applyDamageToHP(hp, effectiveDamage);

    // Effective hit = 0.5 * (1-0.2) * (1-0.1) = 0.5 * 0.8 * 0.9 = 0.36
    const effectiveHit = 0.5 * 0.8 * 0.9;
    expect(result.get(20)).toBeCloseTo(1 - effectiveHit, 6);
    expect(result.get(15)).toBeCloseTo(effectiveHit, 6);
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('getExpectedValue', () => {
  it('calculates E[X] for d6', () => {
    const d6 = createUniformDie(6);
    expect(getExpectedValue(d6)).toBeCloseTo(3.5, 6);
  });

  it('calculates E[X] for 2d6', () => {
    const twoD6 = diceExpressionToPMF('2d6');
    expect(getExpectedValue(twoD6)).toBeCloseTo(7.0, 6);
  });

  it('calculates E[X] for constant', () => {
    const constant = createSingleValue(5);
    expect(getExpectedValue(constant)).toBe(5);
  });

  it('calculates E[X] for 2d6+4', () => {
    const result = diceExpressionToPMF('2d6+4');
    expect(getExpectedValue(result)).toBeCloseTo(11.0, 6);
  });
});

describe('getVariance', () => {
  it('calculates Var[X] for d6', () => {
    const d6 = createUniformDie(6);
    // Var(d6) = (6^2 - 1) / 12 = 35/12 ≈ 2.917
    expect(getVariance(d6)).toBeCloseTo(35 / 12, 6);
  });

  it('calculates Var[X] for constant (should be 0)', () => {
    const constant = createSingleValue(5);
    expect(getVariance(constant)).toBe(0);
  });
});

describe('getStandardDeviation', () => {
  it('calculates SD for d6', () => {
    const d6 = createUniformDie(6);
    expect(getStandardDeviation(d6)).toBeCloseTo(Math.sqrt(35 / 12), 6);
  });
});

describe('getMode', () => {
  it('returns mode for d6 (first value in case of tie)', () => {
    const d6 = createUniformDie(6);
    const mode = getMode(d6);
    // All equally likely, should return smallest (1)
    expect(mode).toBe(1);
  });

  it('returns mode for 2d6', () => {
    const twoD6 = diceExpressionToPMF('2d6');
    expect(getMode(twoD6)).toBe(7);
  });

  it('returns mode for constant', () => {
    const constant = createSingleValue(42);
    expect(getMode(constant)).toBe(42);
  });
});

describe('getPercentile', () => {
  it('returns median for d6', () => {
    const d6 = createUniformDie(6);
    // P(1) = 1/6, P(2) = 2/6, P(3) = 3/6 = 0.5
    expect(getPercentile(d6, 0.5)).toBe(3);
  });

  it('returns minimum for 0th percentile', () => {
    const d6 = createUniformDie(6);
    expect(getPercentile(d6, 0)).toBe(1);
  });

  it('returns maximum for 100th percentile', () => {
    const d6 = createUniformDie(6);
    expect(getPercentile(d6, 1)).toBe(6);
  });

  it('throws for invalid percentile', () => {
    const d6 = createUniformDie(6);
    expect(() => getPercentile(d6, 1.5)).toThrow();
    expect(() => getPercentile(d6, -0.1)).toThrow();
  });
});

describe('getMinimum and getMaximum', () => {
  it('returns correct range for d6', () => {
    const d6 = createUniformDie(6);
    expect(getMinimum(d6)).toBe(1);
    expect(getMaximum(d6)).toBe(6);
  });

  it('returns correct range for 2d6+4', () => {
    const result = diceExpressionToPMF('2d6+4');
    expect(getMinimum(result)).toBe(6);
    expect(getMaximum(result)).toBe(16);
  });
});

describe('getProbabilityAtMost and getProbabilityAtLeast', () => {
  it('calculates P(X <= 3) for d6', () => {
    const d6 = createUniformDie(6);
    expect(getProbabilityAtMost(d6, 3)).toBeCloseTo(0.5, 6);
  });

  it('calculates P(X >= 4) for d6', () => {
    const d6 = createUniformDie(6);
    expect(getProbabilityAtLeast(d6, 4)).toBeCloseTo(0.5, 6);
  });

  it('calculates P(X <= 7) for 2d6', () => {
    const twoD6 = diceExpressionToPMF('2d6');
    // Sum of P(2..7) = (1+2+3+4+5+6)/36 = 21/36
    expect(getProbabilityAtMost(twoD6, 7)).toBeCloseTo(21 / 36, 6);
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe('Edge Cases', () => {
  it('handles single die (d1)', () => {
    const d1 = createUniformDie(1);
    expect(d1.get(1)).toBe(1.0);
    expect(getExpectedValue(d1)).toBe(1);
  });

  it('handles multiplication in expressions', () => {
    const result = diceExpressionToPMF('2*3');
    expect(result.get(6)).toBe(1.0);
  });

  it('handles implicit 1dN (d20)', () => {
    const result = diceExpressionToPMF('d20');
    expect(result.size).toBe(20);
    expect(getExpectedValue(result)).toBeCloseTo(10.5, 6);
  });
});

describe('Combat Simulation Scenarios', () => {
  it('simulates goblin attack on fighter', () => {
    // Goblin: 1d6+2 damage, +4 to hit vs AC 16
    // Fighter: 45 HP
    const fighterHP = createSingleValue(45);
    const goblinDamage = diceExpressionToPMF('1d6+2'); // 3-8

    // Hit chance: d20+4 >= 16 means roll 12+ = 9/20 = 45%
    const hitChance = 9 / 20;

    const effectiveDamage = calculateEffectiveDamage(goblinDamage, hitChance);
    const afterAttack = applyDamageToHP(fighterHP, effectiveDamage);

    // Verify no death yet
    expect(calculateDeathProbability(afterAttack)).toBe(0);

    // Verify HP distribution
    expect(afterAttack.get(45)).toBeCloseTo(1 - hitChance, 6); // Miss
    expect(getMinimum(afterAttack)).toBe(37); // 45 - 8
    expect(getMaximum(afterAttack)).toBe(45); // Miss
  });

  it('simulates orc attack with critical hit potential', () => {
    // Orc: 1d12+3 damage with greataxe
    // Against low HP target
    const targetHP = createSingleValue(8);
    const orcDamage = diceExpressionToPMF('1d12+3'); // 4-15

    const effectiveDamage = calculateEffectiveDamage(orcDamage, 0.6);
    const result = applyDamageToHP(targetHP, effectiveDamage);

    // Check death probability - some damage values will kill
    // Damage 8+ kills (8-15 = 8 values out of 12)
    const deathProb = calculateDeathProbability(result);
    expect(deathProb).toBeGreaterThan(0);

    // Death probability = hit chance * P(damage >= 8)
    // P(damage >= 8) = 8/12 (d12 roll of 5+ gives 8+ damage)
    const expectedDeathProb = 0.6 * (8 / 12);
    expect(deathProb).toBeCloseTo(expectedDeathProb, 6);
  });

  it('simulates multiple rounds of combat', () => {
    let hp = createSingleValue(30);
    const damage = diceExpressionToPMF('1d8+3'); // 4-11
    const hitChance = 0.5;

    // Simulate 3 rounds
    for (let round = 0; round < 3; round++) {
      const effectiveDamage = calculateEffectiveDamage(damage, hitChance);
      hp = applyDamageToHP(hp, effectiveDamage);
    }

    // After 3 rounds of potential hits
    const deathProb = calculateDeathProbability(hp);
    const expectedDamagePerRound = getExpectedValue(damage) * hitChance;

    // Should have taken ~3.75 expected damage per round
    expect(expectedDamagePerRound).toBeCloseTo(3.75, 1);

    // Expected HP after 3 rounds: 30 - 3*3.75 = 18.75
    const expectedHP = getExpectedValue(hp);
    expect(expectedHP).toBeCloseTo(30 - 3 * expectedDamagePerRound, 1);
  });
});
