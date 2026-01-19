// Ziel: Resolver für effect.type === 'all' (Composite Effect)
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Rekursiv: ruft resolveEffect() für jedes Child-Effect auf und merged Ergebnisse.

import type { Effect } from '@/types/entities/combatEvent';
import type { PartialResolutionResult, EffectResolutionContext } from './types';
import { mergeResults } from './types';
import { resolveEffect } from './index';

// ============================================================================
// ALL EFFECT RESOLVER (COMPOSITE)
// ============================================================================

/**
 * Resolves a composite 'all' effect.
 * Recursively resolves each child effect and merges results.
 * Initializes accumulatedDamage for sequential HP calculation across damage effects.
 */
export function resolveAllEffect(
  effect: Extract<Effect, { type: 'all' }>,
  context: EffectResolutionContext
): PartialResolutionResult {
  const results: PartialResolutionResult[] = [];

  // Context mit Akkumulator für sequenzielle Damage-Berechnung
  const sharedContext = { ...context, accumulatedDamage: 0 };

  for (const childEffect of effect.effects) {
    // Jeder Effect liest/aktualisiert accumulatedDamage
    const result = resolveEffect(childEffect, sharedContext);
    results.push(result);
  }

  return mergeResults(...results);
}
