// Ziel: Berechnet die Effekte einer Aktion basierend auf Target und Success-Daten
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// Pipeline-Schritt 4: Berechnet Effekte basierend auf SuccessResult
// - Damage Calculation: Primary, extra, critical damage
// - Condition Application: With secondary saves
// - Healing Resolution
// - Forced Movement
// - Zone Activation
// - Concentration Break
// - Protocol Data Generation
//
// Hinweis: Success Determination ist in determineSuccess.ts (Pipeline-Schritt 3)
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Expected values statt voller PMF-Verteilungen
// - Berechnung nutzt getExpectedValue() statt vollständiger PMF
// - Für AI-Scoring ausreichend, aber nicht für exakte Simulation
//
// [TODO]: Full PMF support für Damage-Berechnung
// - Spec: resolveEffects.md zeigt expected values
// - Für vollständige Combat-Simulation: PMF-Pipeline implementieren
//
// [TODO]: Stacking Policy Application
// - Spec: docs/types/combatEvent.md#stacking-policies
// - resolveConditions() wendet Conditions ohne Stacking-Check an
// - Benötigt: applyStacking(effect, existingEffects) Step vor addCondition
// - Policies: none, refresh, add-stacks, highest-wins, aggregate
//
// [TODO]: Effect Timing (DoT)
// - Spec: docs/types/combatEvent.md#effecton-flags
// - Aktuelle Pipeline: Einmalige Anwendung bei Resolution
// - Benötigt: timing='on-interval' mit interval Duration
// - Zone-Damage als Referenz (zoneEffects.ts)
//
// [TODO]: Formula-DC Parser
// - Spec: docs/types/combatEvent.md#formula-dc
// - dcSchema hat type: 'formula' mit formula string
// - resolveConditions() verwendet nur numeric DC
// - Benötigt: parseFormulaExpression("8 + @proficiency + @abilities.cha.mod", context)
//
// [TODO]: 4-Phase Pipeline mit Reaction Windows
// - Spec: docs/types/combatEvent.md#evaluator-pipeline
// - Aktuelle Pipeline: 3 Schritte (findTargets → determineSuccess → resolveEffects)
// - Spec: 4 Phasen (Declaration → Execution → Effect → Completion)
// - Jede Phase hat Reaction Window für Shield, Counterspell, etc.
//
// [HACK]: Legacy-Pfad in resolveEffects()
// - resolveEffects() hat zwei Pfade: useNewResolver (action.effect) und legacy
// - Legacy-Pfad (Zeile 535-575) verwendet calculatePrimaryDamage(), resolveConditions()
// - Kann entfernt werden sobald alle Actions migriert sind
//
// [TODO]: Entferne Legacy-Pfad nach vollständiger Migration
// - Spec: docs/types/combatEvent.md
// - Voraussetzung: Alle presets/actions verwenden neues Schema
// - Lösche: calculatePrimaryDamage(), resolveExtraDamage(), resolveConditions(),
//   buildConditionState(), resolveHealing(), resolveForcedMovement()

import type { CombatEvent, Effect, LegacyEffect } from '../../../types/entities/combatEvent';
import type { AbilityType } from '@/constants/action';
import type {
  Combatant,
  CombatState,
  ResolutionContext,
  ResolutionResult,
  ResolutionHPChange,
  ConditionApplication,
  ConditionRemoval,
  ForcedMovementEntry,
  ZoneActivation,
  ResolutionProtocolData,
  SuccessResult,
  ConditionState,
} from '@/types/combat';
import type { TargetResult } from './findTargets';
import type { ModifierSet, AdvantageState } from './getModifiers';
import { getSaveBonus, calculateSaveFailChance } from './determineSuccess';
import {
  getHP,
  getMaxHP,
} from '../combatState';
import {
  diceExpressionToPMF,
  addConstant,
  getExpectedValue,
} from '@/utils';
import { clamp } from '@/utils/math';
import { resolveEffect, mergeResults, emptyResult } from './resolveEffect';
import type { EffectResolutionContext, PartialResolutionResult } from './resolveEffect';

// ============================================================================
// TYPES
// ============================================================================

/** Damage entry for extra damage tracking */
interface DamageEntry {
  amount: number;
  type: string;
  source: string;
}

// ============================================================================
// NOTE: Success Determination has been moved to determineSuccess.ts
// This file now only handles effect resolution (damage, conditions, etc.)
// ============================================================================

// ============================================================================
// DAMAGE FIELD ACCESS (New Schema Only)
// ============================================================================

/** Normalized damage fields from effect.type === 'damage' */
interface DamageFields {
  dice: string;
  modifier: number;
  type: string;
}

/**
 * Extracts damage fields from a CombatEvent.
 * Supports new schema: effect.type === 'damage' or composite 'all' with damage child.
 */
function getDamageFields(action: CombatEvent): DamageFields | null {
  // New schema: effect.type === 'damage'
  if (action.effect?.type === 'damage') {
    return extractDamageFromEffect(action.effect);
  }

  // New schema: effect.type === 'all' with damage child
  if (action.effect?.type === 'all') {
    const damageEffect = action.effect.effects.find(
      (e): e is Extract<Effect, { type: 'damage' }> => e.type === 'damage'
    );
    if (damageEffect) {
      return extractDamageFromEffect(damageEffect);
    }
  }

  return null;
}

/**
 * Extracts damage fields from a damage effect.
 */
function extractDamageFromEffect(effect: Extract<Effect, { type: 'damage' }>): DamageFields {
  const dmg = effect.damage;
  if (typeof dmg === 'string') {
    // Parse "2d4+2" or "1d6-1" -> dice: "2d4", modifier: 2 or -1
    const match = dmg.match(/^([^+-]+)([+-]\d+)?$/);
    return {
      dice: match?.[1]?.trim() ?? dmg,
      modifier: parseInt(match?.[2] ?? '0') || 0,
      type: effect.damageType,
    };
  }
  // Object format: { base: "1d6", bonus: 2 }
  if (typeof dmg === 'object' && 'base' in dmg) {
    return {
      dice: dmg.base,
      modifier: dmg.bonus ?? 0,
      type: effect.damageType,
    };
  }
  // Fallback
  return {
    dice: String(dmg),
    modifier: 0,
    type: effect.damageType,
  };
}

// ============================================================================
// DAMAGE RESOLUTION
// ============================================================================

/**
 * Calculates damage from manual GM input.
 * GM enters dice roll result (before modifiers), system adds modifier.
 *
 * @param action The action being performed
 * @param successResult Success result (for damageMultiplier check)
 * @param damageBonus Damage bonus from modifiers
 * @param manualDamageRoll The dice roll result entered by GM (before modifiers)
 */
function calculateManualDamage(
  action: CombatEvent,
  successResult: SuccessResult,
  damageBonus: number,
  manualDamageRoll: number
): number {
  const dmg = getDamageFields(action);
  if (!dmg || successResult.damageMultiplier === 0) return 0;

  // GM enters dice result, we add the static modifier
  // For crits: GM already enters doubled dice, we don't double again
  const total = manualDamageRoll + dmg.modifier + damageBonus;

  return Math.max(0, Math.floor(total));
}

/**
 * Calculates primary damage from action.
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 * HACK: Uses expected value instead of full PMF for probabilistic mode.
 */
function calculatePrimaryDamage(
  action: CombatEvent,
  successResult: SuccessResult,
  damageBonus: number,
  manualDamageRoll?: number
): number {
  // Manual mode: GM entered dice result
  if (manualDamageRoll !== undefined) {
    return calculateManualDamage(action, successResult, damageBonus, manualDamageRoll);
  }

  // Probabilistic mode: calculate expected value
  const dmg = getDamageFields(action);
  if (!dmg || successResult.damageMultiplier === 0) return 0;

  const basePMF = diceExpressionToPMF(dmg.dice);
  const withModifier = addConstant(basePMF, dmg.modifier + damageBonus);
  let expectedDamage = getExpectedValue(withModifier);

  // Critical hit: double dice (not modifier) per D&D 5e
  if (successResult.critical) {
    const diceOnlyPMF = diceExpressionToPMF(dmg.dice);
    expectedDamage += getExpectedValue(diceOnlyPMF);
  }

  return expectedDamage * Math.min(successResult.damageMultiplier, 1);
}

/**
 * Resolves extra damage (Sneak Attack, Divine Smite, etc.).
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 */
function resolveExtraDamage(
  action: CombatEvent,
  successResult: SuccessResult
): DamageEntry[] {
  if (!action.extraDamage || successResult.damageMultiplier === 0) return [];

  return action.extraDamage.map(extra => {
    const basePMF = diceExpressionToPMF(extra.dice);
    let amount = getExpectedValue(basePMF);

    // Extra damage also gets crit multiplier on dice
    if (successResult.critical) {
      amount *= 2;
    }

    return {
      amount: amount * Math.min(successResult.damageMultiplier, 1),
      type: extra.type,
      source: 'extra',
    };
  });
}

// ============================================================================
// CONDITION RESOLUTION
// ============================================================================

/**
 * Builds a ConditionState from an ActionEffect.
 * Accepts LegacyEffect for backwards compatibility with action.effects array.
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 */
function buildConditionState(
  effect: LegacyEffect,
  sourceId: string
): ConditionState {
  return {
    name: effect.condition ?? 'unknown',
    probability: 1.0, // Will be adjusted by save
    effect: effect.condition ?? 'unknown',
    duration: effect.duration,
    sourceId,
    endingSave: effect.endingSave,
  };
}

/**
 * Resolves conditions from action effects.
 * Handles secondary saves for conditions.
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 */
function resolveConditions(
  action: CombatEvent,
  actor: Combatant,
  target: Combatant,
  successResult: SuccessResult,
  modifiers: ModifierSet,
  _state: Readonly<CombatState>
): ConditionApplication[] {
  if (!action.effects || successResult.damageMultiplier === 0) return [];

  const results: ConditionApplication[] = [];

  for (const effect of action.effects) {
    // Check effect type before accessing condition
    if (effect.type !== 'apply-condition' || !effect.condition) continue;

    // Check affectsTarget filter
    if (effect.affectsTarget === 'enemy' && !successResult.hit) continue;

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
    }

    if (conditionProbability > 0) {
      results.push({
        targetId: target.id,
        targetName: target.name,
        condition: buildConditionState(effect, actor.id),
        probability: conditionProbability,
      });
    }
  }

  return results;
}

// ============================================================================
// HEALING RESOLUTION
// ============================================================================

/**
 * Resolves healing from action.
 * Note: healing is on Action level, not ActionEffect.
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 */
function resolveHealing(
  action: CombatEvent,
  target: Combatant
): ResolutionHPChange | null {
  // Check for healing on action (not on effects)
  if (!action.healing) return null;

  const healPMF = diceExpressionToPMF(action.healing.dice);
  const healAmount = getExpectedValue(addConstant(healPMF, action.healing.modifier));

  const currentHP = getExpectedValue(getHP(target));
  const maxHP = getMaxHP(target);
  const newHP = Math.min(currentHP + healAmount, maxHP);

  if (newHP === currentHP) return null;

  return {
    combatantId: target.id,
    combatantName: target.name,
    previousHP: currentHP,
    newHP,
    change: newHP - currentHP,
    source: 'healing',
  };
}

// ============================================================================
// FORCED MOVEMENT
// ============================================================================

/**
 * Resolves forced movement from action.
 * Note: forcedMovement is on Action level, not ActionEffect.
 * HACK: Legacy-Pfad, siehe Header. Wird nach vollständiger Migration entfernt.
 */
function resolveForcedMovement(
  action: CombatEvent,
  target: Combatant,
  successResult: SuccessResult
): ForcedMovementEntry | null {
  if (!action.forcedMovement || successResult.damageMultiplier === 0) return null;

  return {
    targetId: target.id,
    type: action.forcedMovement.type as 'push' | 'pull' | 'slide',
    distance: action.forcedMovement.distance,
  };
}

// ============================================================================
// ZONE ACTIVATION
// ============================================================================

/**
 * Resolves zone activation from action effects.
 * Note: trigger is on ActionEffect, zone definition has radius/targetFilter.
 */
function resolveZoneActivation(
  action: CombatEvent,
  actor: Combatant
): ZoneActivation | undefined {
  const zoneEffect = action.effects?.find(e => e.type === 'create-zone' && e.zone);
  if (!zoneEffect || zoneEffect.type !== 'create-zone' || !zoneEffect.zone) return undefined;

  return {
    actionId: action.id,
    ownerId: actor.id,
    radius: zoneEffect.zone.radius ?? 0,
    targetFilter: zoneEffect.zone.targetFilter ?? 'enemies',
    trigger: zoneEffect.trigger ?? 'on-enter',
    effect: zoneEffect,
  };
}

// ============================================================================
// CONCENTRATION BREAK
// ============================================================================

/**
 * Checks if concentration should break from damage.
 * D&D 5e: DC = max(10, damage/2), Con save.
 */
function resolveConcentrationBreak(
  target: Combatant,
  damage: number
): boolean {
  if (!target.combatState.concentratingOn) return false;
  if (damage <= 0) return false;

  const dc = Math.max(10, Math.floor(damage / 2));
  const conSave = getSaveBonus(target, 'con');
  const saveChance = clamp((21 + conSave - dc) / 20, 0.05, 0.95);
  const failChance = 1 - saveChance;

  // Return true if concentration likely breaks (>50% fail chance)
  return failChance > 0.5;
}

// ============================================================================
// PROTOCOL DATA
// ============================================================================

/**
 * Builds protocol data for combat logging.
 */
function buildProtocolData(
  context: ResolutionContext,
  successResults: SuccessResult[],
  hpChanges: ResolutionHPChange[],
  conditionsApplied: ConditionApplication[]
): ResolutionProtocolData {
  const totalDamage = hpChanges
    .filter(c => c.change < 0)
    .reduce((sum, c) => sum + Math.abs(c.change), 0);

  const totalHealing = hpChanges
    .filter(c => c.change > 0)
    .reduce((sum, c) => sum + c.change, 0);

  const anyHit = successResults.some(r => r.hit);
  const anyCrit = successResults.some(r => r.critical);

  return {
    roundNumber: context.state.roundNumber,
    actorId: context.actor.id,
    actorName: context.actor.name,
    actionName: context.action.name,
    targetIds: successResults.map(r => r.target.id),
    targetNames: successResults.map(r => r.target.name),
    hit: anyHit,
    critical: anyCrit,
    damageDealt: totalDamage,
    healingDone: totalHealing,
    damageType: getDamageFields(context.action)?.type,
    conditionsApplied: conditionsApplied.map(c => c.condition.name),
    trigger: context.trigger,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Resolves all effects of an action against targets.
 * Pipeline Step 4: After determineSuccess, receives SuccessResult[] as input.
 *
 * This is the SINGLE SOURCE OF TRUTH for all non-movement action effects.
 *
 * @param context Resolution context with actor, action, state
 * @param targetResult Result from findTargets
 * @param successResults Array of SuccessResult from determineSuccess (one per target)
 * @param modifierSets Array of ModifierSet (one per target) - for damage/condition bonuses
 * @returns ResolutionResult with all effects (pure data, no state mutation)
 */
export function resolveEffects(
  context: ResolutionContext,
  targetResult: TargetResult,
  successResults: SuccessResult[],
  modifierSets: ModifierSet[]
): ResolutionResult {
  const { action, actor, state } = context;

  const hpChanges: ResolutionHPChange[] = [];
  const conditionsToAdd: ConditionApplication[] = [];
  const conditionsToRemove: ConditionRemoval[] = [];
  const forcedMovement: ForcedMovementEntry[] = [];
  let concentrationBreak: string | undefined;

  // Check if action uses new schema (action.effect) vs legacy (action.effects)
  const useNewResolver = action.effect !== undefined;

  // Process each target
  for (let i = 0; i < targetResult.targets.length; i++) {
    const target = targetResult.targets[i];
    const successResult = successResults[i];
    const modifiers = modifierSets[i] ?? {
      attackAdvantage: 'none' as const,
      attackBonus: 0,
      targetACBonus: 0,
      saveAdvantage: 'none' as const,
      saveBonus: 0,
      damageBonus: 0,
      hasAutoCrit: false,
      hasAutoMiss: false,
      sources: [],
    };

    if (useNewResolver && action.effect) {
      // NEW SCHEMA: Use recursive effect resolver
      const effectContext: EffectResolutionContext = {
        actor,
        target,
        action,
        state,
        successResult,
        modifiers,
      };

      const effectResult = resolveEffect(action.effect, effectContext);

      // Merge effect results
      if (effectResult.hpChanges) {
        hpChanges.push(...effectResult.hpChanges);

        // Check concentration break for any damage
        const totalDamage = effectResult.hpChanges
          .filter(c => c.change < 0)
          .reduce((sum, c) => sum + Math.abs(c.change), 0);
        if (totalDamage > 0 && resolveConcentrationBreak(target, totalDamage)) {
          concentrationBreak = target.id;
        }
      }
      if (effectResult.conditionsToAdd) {
        conditionsToAdd.push(...effectResult.conditionsToAdd);
      }
      if (effectResult.conditionsToRemove) {
        conditionsToRemove.push(...effectResult.conditionsToRemove);
      }
      if (effectResult.forcedMovement) {
        forcedMovement.push(...effectResult.forcedMovement);
      }
      if (effectResult.concentrationBreak) {
        concentrationBreak = effectResult.concentrationBreak;
      }
    } else {
      // LEGACY PATH: Use existing resolution logic

      // 1. Calculate damage (pass manual roll if available)
      const primaryDamage = calculatePrimaryDamage(
        action,
        successResult,
        modifiers.damageBonus,
        context.manualRolls?.damageRoll
      );
      const extraDamage = resolveExtraDamage(action, successResult);
      const totalDamage = primaryDamage + extraDamage.reduce((sum, d) => sum + d.amount, 0);

      if (totalDamage > 0) {
        const currentHP = getExpectedValue(getHP(target));
        const newHP = Math.max(0, currentHP - totalDamage);

        hpChanges.push({
          combatantId: target.id,
          combatantName: target.name,
          previousHP: currentHP,
          newHP,
          change: -totalDamage,
          source: action.name,
          damageType: getDamageFields(action)?.type,
        });

        // Check concentration break
        if (resolveConcentrationBreak(target, totalDamage)) {
          concentrationBreak = target.id;
        }
      }

      // 3. Resolve conditions (legacy)
      const conditions = resolveConditions(action, actor, target, successResult, modifiers, state);
      conditionsToAdd.push(...conditions);

      // 4. Resolve forced movement (at action level)
      const movement = resolveForcedMovement(action, target, successResult);
      if (movement) forcedMovement.push(movement);
    }
  }

  // 5. Resolve healing (for ally targets) - legacy path only
  if (!useNewResolver) {
    for (const target of targetResult.targets) {
      const healing = resolveHealing(action, target);
      if (healing) hpChanges.push(healing);
    }
  }

  // 6. Resolve zone activation (legacy)
  const zoneActivation = resolveZoneActivation(action, actor);

  // 7. Build protocol data
  const protocolData = buildProtocolData(context, successResults, hpChanges, conditionsToAdd);

  return {
    hpChanges,
    conditionsToAdd,
    conditionsToRemove,
    forcedMovement,
    zoneActivation,
    concentrationBreak,
    protocolData,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  SuccessResult,
};
