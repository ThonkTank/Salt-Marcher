// Ziel: Sammelt alle Modifier die eine Aktion beeinflussen
// Siehe: docs/services/combatTracking/gatherModifiers.md
//
// Pipeline-Schritt 2: Nach findTargets, vor determineSuccess
// Single Source of Truth fuer Combat-Modifier-Logik
//
// Modifier-Quellen:
// 1. Conditions - D&D 5e Conditions auf Actor/Target
// 2. Buffs - Aktive Effekte mit attack/save/AC/damage Boni
// 3. Situational - Cover, Long Range, Flanking
// 4. Schema-Modifiers - Creature Traits (Pack Tactics, Magic Resistance)
// 5. Passive Traits - Evaluiert passive Actions mit schemaModifiers
// 6. Auras - Evaluiert Aura-Actions von Allies
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Cover-Berechnung erfordert LOS
// - collectSituationalModifiers() ueberspringt Cover vorerst
// - TODO: Integriere gridLineOfSight wenn verfuegbar
//
// [TODO]: Frightened Source Visibility
// - Frightened gibt nur Disadvantage wenn Quelle sichtbar
// - Vorerst: Immer Disadvantage (konservative Annahme)
//
// [TODO]: Flanking Rule
// - Optional Rule nicht implementiert
// - Spec: Ally auf gegenueberliegender Seite = Advantage

import type { Combatant, CombatState, ConditionState } from '@/types/combat';
import { isNPC } from '@/types/combat';
import type { Action } from '#entities/action';
import type { ConditionExpression, SchemaModifierEffect } from '@/types/entities/conditionExpression';
import type { TargetResult } from './findTargets';
import {
  getConditions,
  getPosition,
  getGroupId,
  getAliveCombatants,
  getActions,
} from '../combatState';
import {
  evaluateCondition,
  combatantToCombatantContext,
  type EvaluationContext,
} from '@/utils/combatModifiers';

// ============================================================================
// TYPES
// ============================================================================

/** Advantage State per D&D 5e rules */
export type AdvantageState = 'advantage' | 'disadvantage' | 'none';

/** Complete modifier set for an attack/save resolution */
export interface ModifierSet {
  // Attack Modifiers
  attackAdvantage: AdvantageState;
  attackBonus: number;

  // Defense Modifiers
  targetACBonus: number;

  // Save Modifiers
  saveAdvantage: AdvantageState;
  saveBonus: number;

  // Damage Modifiers
  damageBonus: number;

  // Special Flags
  hasAutoCrit: boolean;
  hasAutoMiss: boolean;

  // Debug/Protocol: Which modifiers were applied
  sources: string[];
}

/** Context for modifier gathering */
export interface GatherModifiersContext {
  actor: Combatant;
  action: Action;
  state: Readonly<CombatState>;
}

/** Internal: Partial modifiers from a single source */
interface PartialModifiers {
  attackAdvSources: number;
  attackDisadvSources: number;
  attackBonus: number;
  targetACBonus: number;
  saveAdvSources: number;
  saveDisadvSources: number;
  saveBonus: number;
  damageBonus: number;
  hasAutoCrit: boolean;
  hasAutoMiss: boolean;
  sources: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Conditions that grant disadvantage on attacks */
const ATTACK_DISADVANTAGE_CONDITIONS = [
  'blinded',
  'frightened', // HACK: Assumes source visible
  'poisoned',
  'restrained',
] as const;

/** Conditions on target that grant advantage to attacks */
const TARGET_ADVANTAGE_CONDITIONS = [
  'blinded',
  'paralyzed',
  'restrained',
  'stunned',
  'unconscious',
] as const;

/** Conditions on target that grant auto-crit in melee 5ft */
const AUTO_CRIT_CONDITIONS = ['paralyzed', 'unconscious'] as const;

/** Conditions that cause auto-fail on STR/DEX saves */
const SAVE_AUTO_FAIL_CONDITIONS = ['paralyzed', 'stunned', 'unconscious'] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Check if a combatant has a specific condition by name */
function hasCondition(conditions: ConditionState[], name: string): boolean {
  return conditions.some(c => c.name === name && c.probability > 0);
}

/** Check if action is ranged */
function isRangedAction(action: Action): boolean {
  return action.range?.type === 'ranged';
}

/** Check if action is melee */
function isMeleeAction(action: Action): boolean {
  return action.range?.type === 'reach' || !action.range?.type;
}

/** Calculate distance between two combatants in cells */
function getDistanceCells(actor: Combatant, target: Combatant): number {
  const actorPos = getPosition(actor);
  const targetPos = getPosition(target);
  // Chebyshev distance (D&D diagonal movement)
  return Math.max(Math.abs(actorPos.x - targetPos.x), Math.abs(actorPos.y - targetPos.y));
}

/** Check if target is within melee range (5ft = 1 cell) */
function isWithinMeleeRange(actor: Combatant, target: Combatant): boolean {
  return getDistanceCells(actor, target) <= 1;
}

/** Check if attacker is in long range */
function isInLongRange(actor: Combatant, target: Combatant, action: Action): boolean {
  if (!action.range?.long || !action.range?.normal) return false;
  const distanceFeet = getDistanceCells(actor, target) * 5;
  return distanceFeet > action.range.normal && distanceFeet <= action.range.long;
}

/** Check if groups are allied */
function isAllied(
  actorGroupId: string,
  targetGroupId: string,
  alliances: Record<string, string[]>
): boolean {
  if (actorGroupId === targetGroupId) return true;
  const allies = alliances[actorGroupId] ?? [];
  return allies.includes(targetGroupId);
}

/** Create empty partial modifiers */
function createEmptyPartial(): PartialModifiers {
  return {
    attackAdvSources: 0,
    attackDisadvSources: 0,
    attackBonus: 0,
    targetACBonus: 0,
    saveAdvSources: 0,
    saveDisadvSources: 0,
    saveBonus: 0,
    damageBonus: 0,
    hasAutoCrit: false,
    hasAutoMiss: false,
    sources: [],
  };
}

// ============================================================================
// CONDITION MODIFIERS
// ============================================================================

/**
 * Collects modifiers from D&D 5e conditions on actor and target.
 *
 * Actor conditions:
 * - blinded, frightened, poisoned, restrained: attack disadvantage
 * - prone (ranged only): attack disadvantage
 * - restrained: DEX save disadvantage
 *
 * Target conditions:
 * - blinded, restrained, stunned, paralyzed, unconscious: attack advantage
 * - prone: advantage (melee) / disadvantage (ranged)
 * - paralyzed, unconscious: auto-crit in melee 5ft
 * - paralyzed, stunned, unconscious: auto-fail STR/DEX save
 */
function collectConditionModifiers(
  actor: Combatant,
  target: Combatant,
  action: Action
): PartialModifiers {
  const result = createEmptyPartial();
  const actorConditions = getConditions(actor);
  const targetConditions = getConditions(target);
  const isRanged = isRangedAction(action);
  const isMelee = isMeleeAction(action);
  const inMeleeRange = isWithinMeleeRange(actor, target);

  // ---- Actor Conditions ----

  // Attack disadvantage conditions
  for (const condition of ATTACK_DISADVANTAGE_CONDITIONS) {
    if (hasCondition(actorConditions, condition)) {
      result.attackDisadvSources++;
      result.sources.push(`actor:${condition}`);
    }
  }

  // Prone actor: disadvantage on ranged attacks only
  if (hasCondition(actorConditions, 'prone') && isRanged) {
    result.attackDisadvSources++;
    result.sources.push('actor:prone-ranged');
  }

  // Restrained: DEX save disadvantage
  if (hasCondition(actorConditions, 'restrained')) {
    result.saveDisadvSources++;
    // Already added to sources above
  }

  // ---- Target Conditions ----

  // Attack advantage conditions
  for (const condition of TARGET_ADVANTAGE_CONDITIONS) {
    if (hasCondition(targetConditions, condition)) {
      result.attackAdvSources++;
      result.sources.push(`target:${condition}`);
    }
  }

  // Prone target: advantage (melee) / disadvantage (ranged)
  if (hasCondition(targetConditions, 'prone')) {
    if (isMelee || inMeleeRange) {
      result.attackAdvSources++;
      result.sources.push('target:prone-melee');
    } else if (isRanged) {
      result.attackDisadvSources++;
      result.sources.push('target:prone-ranged');
    }
  }

  // Auto-crit conditions (in melee 5ft)
  for (const condition of AUTO_CRIT_CONDITIONS) {
    if (hasCondition(targetConditions, condition) && inMeleeRange) {
      result.hasAutoCrit = true;
      result.sources.push(`target:${condition}-autocrit`);
    }
  }

  // Auto-fail STR/DEX save conditions
  for (const condition of SAVE_AUTO_FAIL_CONDITIONS) {
    if (hasCondition(targetConditions, condition)) {
      // Note: This applies to STR/DEX saves only - caller must check save type
      result.sources.push(`target:${condition}-autofail`);
    }
  }

  return result;
}

// ============================================================================
// BUFF MODIFIERS
// ============================================================================

/**
 * Collects modifiers from active buff effects.
 *
 * Buff effects are stored as ConditionState with specific effect types:
 * - effect: 'attack-bonus' + value → attackBonus
 * - effect: 'ac-bonus' + value → targetACBonus
 * - effect: 'save-bonus' + value → saveBonus
 * - effect: 'damage-bonus' + value → damageBonus
 * - effect: 'advantage' → attack advantage
 * - effect: 'disadvantage' → attack disadvantage
 */
function collectBuffModifiers(
  actor: Combatant,
  target: Combatant
): PartialModifiers {
  const result = createEmptyPartial();
  const actorConditions = getConditions(actor);
  const targetConditions = getConditions(target);

  // Actor buffs (attack bonus, save bonus, damage bonus, advantage)
  for (const condition of actorConditions) {
    if (condition.probability <= 0) continue;

    switch (condition.effect) {
      case 'attack-bonus':
        result.attackBonus += condition.value ?? 0;
        result.sources.push(`buff:${condition.name}:attack`);
        break;
      case 'save-bonus':
        result.saveBonus += condition.value ?? 0;
        result.sources.push(`buff:${condition.name}:save`);
        break;
      case 'damage-bonus':
        result.damageBonus += condition.value ?? 0;
        result.sources.push(`buff:${condition.name}:damage`);
        break;
      case 'advantage':
        result.attackAdvSources++;
        result.sources.push(`buff:${condition.name}:advantage`);
        break;
      case 'disadvantage':
        result.attackDisadvSources++;
        result.sources.push(`buff:${condition.name}:disadvantage`);
        break;
    }
  }

  // Target buffs (AC bonus affects attacker's target)
  for (const condition of targetConditions) {
    if (condition.probability <= 0) continue;

    if (condition.effect === 'ac-bonus') {
      result.targetACBonus += condition.value ?? 0;
      result.sources.push(`buff:${condition.name}:ac`);
    }
  }

  return result;
}

// ============================================================================
// SITUATIONAL MODIFIERS
// ============================================================================

/**
 * Collects situational modifiers (cover, long range, flanking).
 *
 * Currently implemented:
 * - Long range: disadvantage on ranged attacks
 *
 * HACK: Cover calculation skipped (requires LOS integration)
 * TODO: Flanking rule (optional)
 */
function collectSituationalModifiers(
  actor: Combatant,
  target: Combatant,
  action: Action,
  _state: Readonly<CombatState>
): PartialModifiers {
  const result = createEmptyPartial();

  // Long range: disadvantage
  if (isInLongRange(actor, target, action)) {
    result.attackDisadvSources++;
    result.sources.push('situational:long-range');
  }

  // Ranged attack in melee: disadvantage
  if (isRangedAction(action) && isWithinMeleeRange(actor, target)) {
    // Check if there's a hostile combatant in melee range
    // HACK: Simplified - just check if target is adjacent
    result.attackDisadvSources++;
    result.sources.push('situational:ranged-in-melee');
  }

  // HACK: Cover calculation skipped - requires LOS
  // TODO: calculateCoverBonus(actor, target, state)

  // TODO: Flanking (optional rule)
  // checkFlanking(actor, target, state)

  return result;
}

// ============================================================================
// EVALUATION CONTEXT BUILDER
// ============================================================================

/**
 * Creates an EvaluationContext from gatherModifiers context.
 * Adapts CombatState types to EvaluationContext types.
 */
function buildEvaluationContext(
  actor: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): EvaluationContext {
  const actorCtx = combatantToCombatantContext(actor);
  const targetCtx = combatantToCombatantContext(target);

  return {
    self: actorCtx,
    attacker: actorCtx,
    target: targetCtx,
    action,
    state: {
      combatants: state.combatants,
      alliances: state.alliances ?? {},
    },
    alliances: state.alliances ?? {},
  };
}

// ============================================================================
// SCHEMA MODIFIER EVALUATION
// ============================================================================

/**
 * Evaluates schema-defined modifiers on the action.
 *
 * Schema modifiers are defined on Action.schemaModifiers and include:
 * - Pack Tactics: advantage if ally adjacent to target
 * - Magic Resistance: save advantage against spells
 * - Reckless Attack: advantage + defense disadvantage
 *
 * Uses the full ConditionExpression evaluator.
 */
function evaluateSchemaModifiers(
  actor: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): PartialModifiers {
  const result = createEmptyPartial();
  const schemaModifiers = action.schemaModifiers ?? [];

  if (schemaModifiers.length === 0) return result;

  // Build evaluation context once for all modifiers
  const evalCtx = buildEvaluationContext(actor, target, action, state);

  for (const modifier of schemaModifiers) {
    // Full expression evaluation
    const isActive = evaluateCondition(modifier.condition as ConditionExpression, evalCtx);

    if (!isActive) continue;

    // Apply effects
    applySchemaModifierEffect(modifier, result);
  }

  return result;
}

/**
 * Applies a schema modifier's effect to partial modifiers.
 */
function applySchemaModifierEffect(
  modifier: { id: string; effect: SchemaModifierEffect },
  result: PartialModifiers
): void {
  const effect = modifier.effect;
  if (effect.advantage) {
    result.attackAdvSources++;
    result.sources.push(`schema:${modifier.id}:advantage`);
  }
  if (effect.disadvantage) {
    result.attackDisadvSources++;
    result.sources.push(`schema:${modifier.id}:disadvantage`);
  }
  if (effect.attackBonus) {
    result.attackBonus += effect.attackBonus;
    result.sources.push(`schema:${modifier.id}:attack`);
  }
  if (effect.acBonus) {
    result.targetACBonus += effect.acBonus;
    result.sources.push(`schema:${modifier.id}:ac`);
  }
  if (typeof effect.damageBonus === 'number') {
    result.damageBonus += effect.damageBonus;
    result.sources.push(`schema:${modifier.id}:damage`);
  }
  if (effect.autoCrit) {
    result.hasAutoCrit = true;
    result.sources.push(`schema:${modifier.id}:autocrit`);
  }
  if (effect.autoMiss) {
    result.hasAutoMiss = true;
    result.sources.push(`schema:${modifier.id}:automiss`);
  }
}

// ============================================================================
// PASSIVE TRAIT EVALUATION
// ============================================================================

/**
 * Evaluates passive trait modifiers from the actor's creature definition.
 *
 * Passive traits are actions with timing.type === 'passive' that have schemaModifiers.
 * Examples: Pack Tactics, Sneak Attack, Sunlight Sensitivity
 */
function evaluatePassiveTraits(
  actor: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): PartialModifiers {
  const result = createEmptyPartial();

  // Only NPCs have passive traits
  if (!isNPC(actor)) return result;

  const allActions = getActions(actor);
  const passiveActions = allActions.filter(
    a => a.timing?.type === 'passive' && a.schemaModifiers && a.schemaModifiers.length > 0
  );

  if (passiveActions.length === 0) return result;

  // Build evaluation context (current action determines action predicates)
  const evalCtx = buildEvaluationContext(actor, target, action, state);

  for (const passiveAction of passiveActions) {
    for (const modifier of passiveAction.schemaModifiers ?? []) {
      const isActive = evaluateCondition(modifier.condition as ConditionExpression, evalCtx);

      if (!isActive) continue;

      // Apply effects with passive action name for debugging
      applySchemaModifierEffectWithSource(
        modifier,
        result,
        `passive:${passiveAction.id}:${modifier.id}`
      );
    }
  }

  return result;
}

/**
 * Applies a schema modifier's effect with custom source prefix.
 */
function applySchemaModifierEffectWithSource(
  modifier: { id: string; effect: SchemaModifierEffect },
  result: PartialModifiers,
  sourcePrefix: string
): void {
  const effect = modifier.effect;
  if (effect.advantage) {
    result.attackAdvSources++;
    result.sources.push(`${sourcePrefix}:advantage`);
  }
  if (effect.disadvantage) {
    result.attackDisadvSources++;
    result.sources.push(`${sourcePrefix}:disadvantage`);
  }
  if (effect.attackBonus) {
    result.attackBonus += effect.attackBonus;
    result.sources.push(`${sourcePrefix}:attack`);
  }
  if (effect.acBonus) {
    result.targetACBonus += effect.acBonus;
    result.sources.push(`${sourcePrefix}:ac`);
  }
  if (typeof effect.damageBonus === 'number') {
    result.damageBonus += effect.damageBonus;
    result.sources.push(`${sourcePrefix}:damage`);
  }
  if (effect.autoCrit) {
    result.hasAutoCrit = true;
    result.sources.push(`${sourcePrefix}:autocrit`);
  }
  if (effect.autoMiss) {
    result.hasAutoMiss = true;
    result.sources.push(`${sourcePrefix}:automiss`);
  }
}

// ============================================================================
// AURA EVALUATION
// ============================================================================

/**
 * Evaluates aura modifiers from allied combatants.
 *
 * Auras are actions with aura.radius that have schemaModifiers.
 * The attacker must be within the aura radius to receive the bonus.
 * Examples: Aura of Protection, Aura of Hatred
 */
function evaluateAuraModifiers(
  actor: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): PartialModifiers {
  const result = createEmptyPartial();
  const actorGroupId = getGroupId(actor);
  const alliances = state.alliances ?? {};
  const aliveCombatants = getAliveCombatants(state);

  // Build evaluation context for condition checks
  const evalCtx = buildEvaluationContext(actor, target, action, state);

  for (const combatant of aliveCombatants) {
    // Skip self (own auras don't apply to self unless specified)
    if (combatant.id === actor.id) continue;

    // Must be ally
    const combatantGroupId = getGroupId(combatant);
    if (!isAllied(actorGroupId, combatantGroupId, alliances)) continue;

    // Check for aura actions
    const combatantActions = getActions(combatant);
    for (const auraAction of combatantActions) {
      if (!auraAction.aura?.radius || !auraAction.schemaModifiers?.length) continue;

      // Check if actor is within aura radius
      const distanceFeet = getDistanceCells(actor, combatant) * 5;
      if (distanceFeet > auraAction.aura.radius) continue;

      // Check if combatant is incapacitated (auras typically don't work if source is incapacitated)
      const combatantConditions = getConditions(combatant);
      if (hasIncapacitatingCondition(combatantConditions)) continue;

      // Evaluate and apply aura modifiers
      for (const modifier of auraAction.schemaModifiers ?? []) {
        const isActive = evaluateCondition(modifier.condition as ConditionExpression, evalCtx);

        if (!isActive) continue;

        applySchemaModifierEffectWithSource(
          modifier,
          result,
          `aura:${combatant.id}:${auraAction.id}:${modifier.id}`
        );
      }
    }
  }

  return result;
}

/**
 * Check if a combatant has any incapacitating condition.
 */
function hasIncapacitatingCondition(conditions: ConditionState[]): boolean {
  const incapacitating = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
  return conditions.some(c => incapacitating.includes(c.name) && c.probability > 0);
}

// ============================================================================
// ADVANTAGE RESOLUTION
// ============================================================================

/**
 * Resolves advantage/disadvantage per D&D 5e cancellation rules.
 * Any advantage + any disadvantage = none (they cancel regardless of count).
 */
export function resolveAdvantageState(
  advantageSources: number,
  disadvantageSources: number
): AdvantageState {
  if (advantageSources > 0 && disadvantageSources > 0) {
    return 'none'; // Cancel each other
  }
  if (advantageSources > 0) return 'advantage';
  if (disadvantageSources > 0) return 'disadvantage';
  return 'none';
}

// ============================================================================
// MERGE LOGIC
// ============================================================================

/**
 * Merges multiple partial modifier sets into a final ModifierSet.
 */
function mergeModifiers(partials: PartialModifiers[]): ModifierSet {
  let totalAttackAdvSources = 0;
  let totalAttackDisadvSources = 0;
  let totalAttackBonus = 0;
  let totalTargetACBonus = 0;
  let totalSaveAdvSources = 0;
  let totalSaveDisadvSources = 0;
  let totalSaveBonus = 0;
  let totalDamageBonus = 0;
  let hasAutoCrit = false;
  let hasAutoMiss = false;
  const allSources: string[] = [];

  for (const partial of partials) {
    totalAttackAdvSources += partial.attackAdvSources;
    totalAttackDisadvSources += partial.attackDisadvSources;
    totalAttackBonus += partial.attackBonus;
    totalTargetACBonus += partial.targetACBonus;
    totalSaveAdvSources += partial.saveAdvSources;
    totalSaveDisadvSources += partial.saveDisadvSources;
    totalSaveBonus += partial.saveBonus;
    totalDamageBonus += partial.damageBonus;
    if (partial.hasAutoCrit) hasAutoCrit = true;
    if (partial.hasAutoMiss) hasAutoMiss = true;
    allSources.push(...partial.sources);
  }

  return {
    attackAdvantage: resolveAdvantageState(totalAttackAdvSources, totalAttackDisadvSources),
    attackBonus: totalAttackBonus,
    targetACBonus: totalTargetACBonus,
    saveAdvantage: resolveAdvantageState(totalSaveAdvSources, totalSaveDisadvSources),
    saveBonus: totalSaveBonus,
    damageBonus: totalDamageBonus,
    hasAutoCrit,
    hasAutoMiss,
    sources: allSources,
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates an empty ModifierSet with default values.
 */
export function createEmptyModifierSet(): ModifierSet {
  return {
    attackAdvantage: 'none',
    attackBonus: 0,
    targetACBonus: 0,
    saveAdvantage: 'none',
    saveBonus: 0,
    damageBonus: 0,
    hasAutoCrit: false,
    hasAutoMiss: false,
    sources: [],
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Gathers all modifiers affecting an action for each target.
 * Pipeline Step 2: After findTargets, before determineSuccess.
 *
 * Collects modifiers from 6 sources:
 * 1. Conditions - D&D 5e conditions on actor/target
 * 2. Buffs - Active effects (Bless, Shield, etc.)
 * 3. Situational - Cover, long range, flanking
 * 4. Schema Modifiers - Modifiers on the action itself
 * 5. Passive Traits - Creature passive abilities (Pack Tactics, etc.)
 * 6. Auras - Allied creature auras (Aura of Protection, etc.)
 *
 * Returns one ModifierSet per target.
 */
export function gatherModifiers(
  context: GatherModifiersContext,
  targetResult: TargetResult
): ModifierSet[] {
  const { actor, action, state } = context;

  return targetResult.targets.map(target => {
    // Collect modifiers from all 6 sources
    const conditionMods = collectConditionModifiers(actor, target, action);
    const buffMods = collectBuffModifiers(actor, target);
    const situationalMods = collectSituationalModifiers(actor, target, action, state);
    const schemaMods = evaluateSchemaModifiers(actor, target, action, state);
    const passiveMods = evaluatePassiveTraits(actor, target, action, state);
    const auraMods = evaluateAuraModifiers(actor, target, action, state);

    // Merge all partial modifiers
    return mergeModifiers([
      conditionMods,
      buffMods,
      situationalMods,
      schemaMods,
      passiveMods,
      auraMods,
    ]);
  });
}
