// Ziel: Resolver für effect.type === 'damage'
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Berechnet HP-Änderung basierend auf DamageRoll und SuccessResult.
// Unterstützt Critical Hits (double dice) und Save-Half.

import type { Effect } from '@/types/entities/combatEvent';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import {
  diceExpressionToPMF,
  addConstant,
  getExpectedValue,
} from '@/utils';
import {
  getHP,
} from '../../combatState';

// ============================================================================
// DAMAGE EFFECT RESOLVER
// ============================================================================

/**
 * Resolves a damage effect.
 * Uses probabilistic calculation: E[damage] = base × P(hit) + critDice × P(crit)
 * Supports sequential HP calculation via accumulatedDamage in context.
 */
export function resolveDamageEffect(
  effect: Extract<Effect, { type: 'damage' }>,
  context: EffectResolutionContext
): PartialResolutionResult {
  const { target, successResult, modifiers, action } = context;

  // Parse damage expression
  const { dice, modifier, damageType } = parseDamageExpression(effect);

  // Calculate base damage (dice + modifier + bonus)
  const basePMF = diceExpressionToPMF(dice);
  const withModifier = addConstant(basePMF, modifier + modifiers.damageBonus);
  const baseDamage = getExpectedValue(withModifier);

  // Crit-Dice separat mit Crit-Wahrscheinlichkeit
  const critDice = getExpectedValue(diceExpressionToPMF(dice));
  const critBonus = critDice * (successResult.critProbability ?? 0);

  // E[damage] = base × P(hit) × saveMultiplier + critDice × P(crit)
  // Für Attacks: hitProbability ist gesetzt, damageMultiplier = 1
  // Für Saves: hitProbability = 1 (auto-hit), damageMultiplier enthält erwarteten Multiplikator
  const hitProb = successResult.hitProbability ?? 1;
  const saveMultiplier = successResult.damageMultiplier ?? 1;

  const expectedDamage = baseDamage * hitProb * saveMultiplier + critBonus;

  if (expectedDamage <= 0) {
    return { hpChanges: [] };
  }

  // Lese akkumulierten Schaden (0 wenn erster Effect)
  const accumulated = context.accumulatedDamage ?? 0;

  // Berechne HP mit Berücksichtigung vorheriger Damage-Effects
  const baseHP = getExpectedValue(getHP(target));
  const currentHP = Math.max(0, baseHP - accumulated);
  const newHP = Math.max(0, currentHP - expectedDamage);

  // Aktualisiere Akkumulator für nächsten Effect
  context.accumulatedDamage = accumulated + expectedDamage;

  return {
    hpChanges: [{
      combatantId: target.id,
      combatantName: target.name,
      previousHP: currentHP,
      newHP,
      change: -expectedDamage,
      source: action.name,
      damageType,
    }],
  };
}

// ============================================================================
// HELPERS
// ============================================================================

interface ParsedDamage {
  dice: string;
  modifier: number;
  damageType: string;
}

/**
 * Parses damage from effect.damage (string or object format).
 */
function parseDamageExpression(effect: Extract<Effect, { type: 'damage' }>): ParsedDamage {
  const dmg = effect.damage;

  if (typeof dmg === 'string') {
    // Parse "2d4+2" or "1d6-1" → dice: "2d4", modifier: 2 or -1
    const match = dmg.match(/^([^+-]+)([+-]\d+)?$/);
    return {
      dice: match?.[1]?.trim() ?? dmg,
      modifier: parseInt(match?.[2] ?? '0') || 0,
      damageType: effect.damageType,
    };
  }

  // Object format: { base: "1d6", bonus: 2 }
  if (typeof dmg === 'object' && 'base' in dmg) {
    return {
      dice: dmg.base,
      modifier: dmg.bonus ?? 0,
      damageType: effect.damageType,
    };
  }

  // Fallback: treat as dice expression
  return {
    dice: String(dmg),
    modifier: 0,
    damageType: effect.damageType,
  };
}
