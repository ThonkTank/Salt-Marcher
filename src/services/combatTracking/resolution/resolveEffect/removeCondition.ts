// Ziel: Resolver für effect.type === 'remove-condition'
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Entfernt eine Condition vom Target wenn der Check erfolgreich war.
// Verwendet für Escape-Actions und ähnliche Effekte.

import type { Effect } from '@/types/entities/combatEvent';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import { emptyResult } from './types';

// ============================================================================
// REMOVE-CONDITION EFFECT RESOLVER
// ============================================================================

/**
 * Resolves a remove-condition effect.
 * Only removes the condition if the primary check succeeded.
 *
 * Used by:
 * - Escape actions (actor beats DC to remove grappled/restrained)
 * - Dispel effects (caster beats DC to remove spell effect)
 * - Healing effects that also remove conditions
 */
export function resolveRemoveConditionEffect(
  effect: Extract<Effect, { type: 'remove-condition' }>,
  context: EffectResolutionContext
): PartialResolutionResult {
  // Only remove condition if check succeeded
  if (!context.successResult.checkSucceeded) {
    return emptyResult();
  }

  return {
    conditionsToRemove: [{
      targetId: context.target.id,
      conditionName: effect.condition,
    }],
  };
}
