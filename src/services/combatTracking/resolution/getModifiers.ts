// Ziel: Sammelt alle Modifier die eine Aktion beeinflussen
// Siehe: docs/services/combatTracking/gatherModifiers.md
//
// Unified Modifier Architecture: 4 Quellen statt 6 Collector-Funktionen
// 1. attacker.combatState.modifiers[]  → Conditions, Buffs, Traits
// 2. target.combatState.modifiers[]    → Conditions, Buffs, Traits
// 3. action.modifierRefs[] + schemaModifiers[] → Action-dependent
// 4. state.areaEffects[]               → Cover, Auras, Zones
//
// Alle Modifier verwenden das einheitliche SchemaModifier Format.

import type {
  Combatant,
  CombatState,
  AreaEffect,
} from '@/types/combat';
import type { Action } from '#entities/action';
import type { SchemaModifier, SchemaModifierEffect } from '@/types/entities/conditionExpression';
import type { TargetResult } from './findTargets';
import type { EvaluationContext } from '@/utils/combatModifiers';
import {
  getPosition,
  getGroupId,
  getConditions,
} from '../combatState';
import {
  evaluateCondition,
  combatantToCombatantContext,
} from '@/utils/combatModifiers';
import { modifierPresetsMap } from '../../../../presets/modifiers';

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
export interface GetModifiersContext {
  attacker: Combatant;
  action: Action;
  state: Readonly<CombatState>;
}

/** Internal: Partial modifiers for accumulation */
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
// HELPER FUNCTIONS
// ============================================================================

/** Calculate distance between two combatants in cells (Chebyshev distance) */
function getDistanceCells(a: Combatant, b: Combatant): number {
  const posA = getPosition(a);
  const posB = getPosition(b);
  return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y));
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

/** Create empty partial modifiers for accumulation */
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

/**
 * Creates an EvaluationContext from attacker/target combatants.
 * Adapts CombatState types to EvaluationContext types.
 */
function buildEvaluationContext(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): EvaluationContext {
  const attackerCtx = combatantToCombatantContext(attacker);
  const targetCtx = combatantToCombatantContext(target);

  return {
    self: attackerCtx,
    attacker: attackerCtx,
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
// MODIFIER RESOLUTION
// ============================================================================

/**
 * Resolves modifier preset IDs to SchemaModifier objects.
 * Looks up modifiers from presets/modifiers/index.ts.
 */
function resolveModifierRefs(refs: string[]): SchemaModifier[] {
  return refs
    .map(id => modifierPresetsMap.get(id))
    .filter((m): m is SchemaModifier => m !== undefined);
}

/**
 * Collects AreaEffects that affect the attacker/target pair.
 * Handles terrain cover and creature-based auras/zones.
 */
function getAreaModifiers(
  attacker: Combatant,
  target: Combatant,
  state: CombatState
): SchemaModifier[] {
  const result: SchemaModifier[] = [];

  for (const area of state.areaEffects) {
    // Cover: Check if obstacle is between attacker and target
    if (area.ownerId === 'terrain') {
      // TODO: Implement isObstacleBetween with LOS check
      // For now, skip terrain-based cover (requires gridLineOfSight)
      continue;
    }

    // Auras/Zones: Check if attacker or target is in the area
    const owner = state.combatants.find(c => c.id === area.ownerId);
    if (!owner) continue;

    // Skip if owner is incapacitated
    const ownerConditions = getConditions(owner);
    const isIncapacitated = ownerConditions.some(
      c => ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'].includes(c.name) && c.probability > 0
    );
    if (isIncapacitated) continue;

    // Check if combatants are in the area
    const ownerPos = getPosition(owner);
    const attackerPos = getPosition(attacker);
    const targetPos = getPosition(target);

    const radiusCells = Math.ceil((area.area.radius ?? 0) / 5);
    const attackerDist = Math.max(Math.abs(attackerPos.x - ownerPos.x), Math.abs(attackerPos.y - ownerPos.y));
    const targetDist = Math.max(Math.abs(targetPos.x - ownerPos.x), Math.abs(targetPos.y - ownerPos.y));

    const attackerInArea = attackerDist <= radiusCells;
    const targetInArea = targetDist <= radiusCells;

    if (attackerInArea || targetInArea) {
      result.push(area.modifier);
    }
  }

  return result;
}

// ============================================================================
// EFFECT APPLICATION
// ============================================================================

/**
 * Applies a SchemaModifierEffect to partial modifiers.
 */
function applySchemaEffect(effect: SchemaModifierEffect, result: PartialModifiers): void {
  // Advantage/Disadvantage
  if (effect.advantage === true) {
    result.attackAdvSources++;
  }
  if (effect.disadvantage === true) {
    result.attackDisadvSources++;
  }

  // Bonuses
  if (typeof effect.attackBonus === 'number') {
    result.attackBonus += effect.attackBonus;
  }
  if (typeof effect.acBonus === 'number') {
    result.targetACBonus += effect.acBonus;
  }
  if (typeof effect.damageBonus === 'number') {
    result.damageBonus += effect.damageBonus;
  }

  // Auto-Crit/Auto-Miss
  if (effect.autoCrit === true) {
    result.hasAutoCrit = true;
  }
  if (effect.autoMiss === true) {
    result.hasAutoMiss = true;
  }
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
 * Unified architecture with 4 sources (all use SchemaModifier format):
 *
 * 1. attacker.combatState.modifiers[] - Conditions, Buffs, Traits on attacker
 * 2. target.combatState.modifiers[]   - Conditions, Buffs, Traits on target
 * 3. action.modifierRefs[] + schemaModifiers[] - Action-dependent modifiers
 * 4. state.areaEffects[]              - Cover, Auras, Zones
 *
 * All modifiers are evaluated with the expression DSL and applied uniformly.
 */
export function getModifiers(
  context: GetModifiersContext,
  targetResult: TargetResult
): ModifierSet[] {
  const { attacker, action, state } = context;

  return targetResult.targets.map(target => {
    // Build evaluation context for the expression DSL
    const evalCtx = buildEvaluationContext(attacker, target, action, state);

    // 1. Collect all SchemaModifier from the 4 sources
    const allModifiers: SchemaModifier[] = [
      // Source 1: Attacker modifiers (Conditions, Buffs, Traits)
      ...attacker.combatState.modifiers.map(am => am.modifier),
      // Source 2: Target modifiers (Conditions, Buffs, Traits)
      ...target.combatState.modifiers.map(am => am.modifier),
      // Source 3: Action modifiers (refs + inline)
      ...resolveModifierRefs(action.modifierRefs ?? []),
      ...(action.schemaModifiers ?? []),
      // Source 4: Area effects (Cover, Auras, Zones)
      ...getAreaModifiers(attacker, target, state),
    ];

    // 2. Evaluate and accumulate (sorted by priority, higher first)
    const result = createEmptyPartial();
    const sortedModifiers = allModifiers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const mod of sortedModifiers) {
      if (evaluateCondition(mod.condition, evalCtx)) {
        applySchemaEffect(mod.effect, result);
        result.sources.push(mod.id);
      }
    }

    // 3. Finalize: resolve advantage states
    return {
      attackAdvantage: resolveAdvantageState(result.attackAdvSources, result.attackDisadvSources),
      attackBonus: result.attackBonus,
      targetACBonus: result.targetACBonus,
      saveAdvantage: resolveAdvantageState(result.saveAdvSources, result.saveDisadvSources),
      saveBonus: result.saveBonus,
      damageBonus: result.damageBonus,
      hasAutoCrit: result.hasAutoCrit,
      hasAutoMiss: result.hasAutoMiss,
      sources: result.sources,
    };
  });
}

// Legacy alias for backwards compatibility
export { getModifiers as gatherModifiers };
export type { GetModifiersContext as GatherModifiersContext };
