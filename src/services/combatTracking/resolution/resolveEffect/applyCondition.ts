// Ziel: Resolver für effect.type === 'apply-condition'
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Berechnet Condition-Application mit sekundärem Save.
// Unterstützt save.onSave: 'none' (nur bei Failed Save).

import type { Effect, AbilityType } from '@/types/entities/combatEvent';
import type { ConditionState } from '@/types/combat';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import { getSaveBonus, calculateSaveFailChance } from '../determineSuccess';

// ============================================================================
// APPLY-CONDITION EFFECT RESOLVER
// ============================================================================

/**
 * Resolves an apply-condition effect.
 * Handles secondary saves with probability calculation.
 */
export function resolveApplyConditionEffect(
  effect: Extract<Effect, { type: 'apply-condition' }>,
  context: EffectResolutionContext
): PartialResolutionResult {
  const { actor, target, successResult, modifiers } = context;

  // No condition if primary check failed (attack missed, save succeeded, etc.)
  if (!successResult.checkSucceeded) {
    return { conditionsToAdd: [] };
  }

  // Start with hit probability as base
  let conditionProbability = successResult.hitProbability;

  // Handle secondary save if effect has its own save
  if (effect.save) {
    const saveBonus = getSaveBonus(target, effect.save.ability as AbilityType);
    const saveFailChance = calculateSaveFailChance(
      effect.save.dc,
      saveBonus + modifiers.saveBonus,
      modifiers.saveAdvantage
    );

    if (effect.save.onSave === 'none') {
      // Condition only on failed save
      conditionProbability *= saveFailChance;
    }
    // For onSave: 'half' or 'special', condition still applies (possibly reduced)
  }

  if (conditionProbability <= 0) {
    return { conditionsToAdd: [] };
  }

  // Build condition state
  const conditionState: ConditionState = {
    name: effect.condition,
    probability: conditionProbability,
    effect: effect.condition,
    duration: effect.duration,
    sourceId: actor.id,
  };

  return {
    conditionsToAdd: [{
      targetId: target.id,
      targetName: target.name,
      condition: conditionState,
      probability: conditionProbability,
    }],
  };
}
