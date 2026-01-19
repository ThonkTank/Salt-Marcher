// Ziel: Resolver für effect.type === 'conditional'
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Bedingte Effect-Auswahl basierend auf Precondition-Evaluation.
// Evaluiert condition, führt dann 'then' oder 'else' Effect aus.

import type { Effect, Precondition } from '@/types/entities/combatEvent';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import { emptyResult } from './types';
import { evaluateCondition, createEvaluationContext } from '@/utils/combatModifiers';
import type { ModifierContext } from '@/services/combatantAI/situationalModifiers';

// Forward declaration - resolved at runtime to avoid circular import
let resolveEffectFn: ((effect: Effect, context: EffectResolutionContext) => PartialResolutionResult) | null = null;

/**
 * Sets the resolveEffect function reference.
 * Called from index.ts to break circular dependency.
 */
export function setResolveEffectFn(fn: (effect: Effect, context: EffectResolutionContext) => PartialResolutionResult): void {
  resolveEffectFn = fn;
}

// ============================================================================
// CONDITIONAL EFFECT RESOLVER
// ============================================================================

/**
 * Resolves a conditional effect.
 * Evaluates the precondition and executes either 'then' or 'else' branch.
 */
export function resolveConditionalEffect(
  effect: Extract<Effect, { type: 'conditional' }>,
  context: EffectResolutionContext
): PartialResolutionResult {
  if (!resolveEffectFn) {
    console.error('[resolveConditionalEffect] resolveEffectFn not initialized');
    return emptyResult();
  }

  const { actor, target, action, state } = context;

  // Build evaluation context for the precondition
  const modifierContext: ModifierContext = {
    attacker: actor,
    target,
    action,
    state: {
      combatants: state.combatants,
      alliances: state.alliances ?? {},
    },
  };
  const evalContext = createEvaluationContext(modifierContext);

  // Evaluate the condition
  const conditionMet = evaluateCondition(effect.condition as Precondition, evalContext);

  // Execute appropriate branch
  if (conditionMet) {
    return resolveEffectFn(effect.then, context);
  } else if (effect.else) {
    return resolveEffectFn(effect.else, context);
  }

  return emptyResult();
}
