// Ziel: Pipeline-Orchestrator für Action Resolution (READ-ONLY)
// Siehe: docs/services/combatTracking/actionResolution.md
//
// Delegiert an die 5 Pipeline-Steps und gibt ResolutionResult zurück.
// KEINE State-Mutation - reine Berechnung.

import type { ResolutionContext, ResolutionResult } from '@/types/combat';
import { getCombatEvents } from '../';
import { resolveSpellWithCaster } from './resolveSpellStats';
import { findTargets } from './findTargets';
import { getModifiers } from './getModifiers';
import { determineSuccess } from './determineSuccess';
import { resolveEffects } from './resolveEffects';

/**
 * Orchestriert die 5-Step Resolution Pipeline.
 * READ-ONLY: Berechnet was passieren würde, mutiert keinen State.
 *
 * Pipeline:
 * 0. resolveSpellWithCaster() → Spell-Stats injizieren (attack bonus, save DC)
 * 1. findTargets()            → Wer wird getroffen?
 * 2. getModifiers()           → Advantage, Boni, AC-Modifier
 * 3. determineSuccess()       → Trifft es? (Attack/Save/Contested)
 * 4. resolveEffects()         → Was passiert? (Damage, Conditions)
 *
 * @param context ResolutionContext mit actor, action, state, trigger
 * @returns ResolutionResult mit HP-Änderungen, Conditions, etc.
 */
export function resolveAction(context: ResolutionContext): ResolutionResult {
  // Step 0: Spell-Stats aus Caster-Trait injizieren (falls isSpell: true)
  const combatantActions = getCombatEvents(context.actor);
  const resolvedAction = resolveSpellWithCaster(context.action, combatantActions);
  const resolvedContext = { ...context, action: resolvedAction };

  // Step 1: Target Selection
  const targetResult = findTargets(resolvedContext);

  // Step 2: Modifier Gathering
  const modifierSets = getModifiers({
    actor: resolvedContext.actor,
    action: resolvedContext.action,
    state: resolvedContext.state,
  }, targetResult);

  // Step 3: Success Determination
  const successResults = determineSuccess(resolvedContext, targetResult, modifierSets);

  // Step 4: Effect Resolution
  const resolution = resolveEffects(resolvedContext, targetResult, successResults, modifierSets);

  return resolution;
}
