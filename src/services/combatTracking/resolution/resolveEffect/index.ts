// Ziel: Dispatcher für rekursiven Effect-Resolver
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Zentraler Entry-Point: routet effect.type zu spezialisiertem Resolver.
// Pure Return Pattern: gibt PartialResolutionResult zurück.
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Implementiere fehlende Effect-Resolver
// - Spec: docs/types/combatEvent.md#effect-types
// - healing: Heilung (resolveHealing als Referenz in resolveEffects.ts)
// - push/pull: Forced Movement
// - teleport: Teleportation
// - create-zone: Zone-Erstellung (resolveZoneActivation als Referenz)
// - grant-advantage/impose-disadvantage: Modifier-Grants
// - grant-bonus/impose-penalty: Numerische Modifier
//
// Implementiert:
// - damage ✓
// - apply-condition ✓
// - remove-condition ✓
// - all ✓
// - conditional ✓
// - none ✓

import type { Effect } from '@/types/entities/combatEvent';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import { emptyResult } from './types';
import { resolveDamageEffect } from './damage';
import { resolveApplyConditionEffect } from './applyCondition';
import { resolveRemoveConditionEffect } from './removeCondition';
import { resolveAllEffect } from './all';
import { resolveConditionalEffect, setResolveEffectFn } from './conditional';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { PartialResolutionResult, EffectResolutionContext } from './types';
export { mergeResults, emptyResult } from './types';

// ============================================================================
// EFFECT DISPATCHER
// ============================================================================

/**
 * Resolves a single effect.
 * Routes to specialized resolver based on effect.type.
 *
 * @param effect The effect to resolve
 * @param context Resolution context (actor, target, successResult, etc.)
 * @returns PartialResolutionResult with HP changes, conditions, etc.
 */
export function resolveEffect(
  effect: Effect,
  context: EffectResolutionContext
): PartialResolutionResult {
  switch (effect.type) {
    case 'damage':
      return resolveDamageEffect(effect, context);

    case 'apply-condition':
      return resolveApplyConditionEffect(effect, context);

    case 'remove-condition':
      return resolveRemoveConditionEffect(effect, context);

    case 'all':
      return resolveAllEffect(effect, context);

    case 'conditional':
      return resolveConditionalEffect(effect, context);

    case 'none':
      return emptyResult();

    // Unimplemented effect types return empty result
    // TODO: Add more resolvers as needed (healing, push, teleport, etc.)
    default:
      return emptyResult();
  }
}

// Initialize circular dependency for conditional resolver
setResolveEffectFn(resolveEffect);
