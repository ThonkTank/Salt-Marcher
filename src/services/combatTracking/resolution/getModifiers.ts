// Ziel: Sammelt alle Modifier die eine Aktion beeinflussen
// Siehe: docs/services/combatTracking/getModifiers.md
//
// Unified Modifier Architecture: 5 Quellen
// 1. attacker.combatState.modifiers[]  → Conditions, Buffs, Traits
// 2. target.combatState.modifiers[]    → Conditions, Buffs, Traits
// 3. action.modifierRefs[] + schemaModifiers[] → Action-dependent
// 4. state.areaEffects[]               → Cover, Auras, Zones
// 5. Auto-Ranged Modifiers             → Long Range, Ranged in Melee (D&D 5e Core)
//
// Alle Modifier verwenden das einheitliche SchemaModifier Format.

import type {
  Combatant,
  CombatState,
} from '@/types/combat';
import type {
  CombatEvent,
  SchemaModifier,
  SchemaModifierEffect,
} from '@/types/entities/combatEvent';
import type { TargetResult } from './findTargets';
import type { EvaluationContext } from '@/utils/combatModifiers';
import {
  getPosition,
  getConditions,
} from '../combatState';
import {
  evaluateCondition,
  isAllied,
} from '@/utils/combatModifiers';
import { modifierPresetsMap } from '../../../../presets/modifiers';

// DEBUG helper
const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[getModifiers]', ...args);
  }
};

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
  actor: Combatant;
  action: CombatEvent;
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

/** Modifier source for contextual effect resolution */
type ModifierSource = 'actor' | 'target' | 'action' | 'area';

/** Modifier with tracked source */
interface TrackedModifier {
  modifier: SchemaModifier;
  source: ModifierSource;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts attack type from action check field.
 * Supports both legacy format ({ type: 'attack', attackType: ... }) and
 * unified check format ({ roll: { type: 'attack', attackType: ... } }).
 */
function getCheckAttackType(action: CombatEvent): string | undefined {
  if (!action.check) return undefined;

  // Legacy format: { type: 'attack', attackType: ... }
  if ('type' in action.check && action.check.type === 'attack') {
    return (action.check as { attackType?: string }).attackType;
  }

  // Unified format: { roll: { type: 'attack', attackType: ... } }
  if ('roll' in action.check && action.check.roll?.type === 'attack') {
    return action.check.roll.attackType;
  }

  return undefined;
}

/** Calculate distance between two combatants in cells (Chebyshev distance) */
function getDistanceCells(a: Combatant, b: Combatant): number {
  const posA = getPosition(a);
  const posB = getPosition(b);
  return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y));
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
 * Uses Combatant types directly.
 */
function buildEvaluationContext(
  attacker: Combatant,
  target: Combatant,
  action: CombatEvent,
  state: Readonly<CombatState>
): EvaluationContext {
  return {
    self: attacker,
    attacker,
    target,
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
function applyEffectFields(effect: SchemaModifierEffect, result: PartialModifiers): void {
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

/**
 * Applies a SchemaModifier using unified contextualEffects system.
 *
 * Effect contexts:
 * - passive: Always applied (for all sources)
 * - Source 'actor': Apply whenAttacking effects
 * - Source 'target': Apply whenDefending + whenDefendingMelee/Ranged effects
 * - Source 'action'/'area': Apply passive effects only
 */
function applyModifierEffect(
  mod: SchemaModifier,
  source: ModifierSource,
  isAdjacent: boolean,
  result: PartialModifiers
): void {
  const ctx = mod.contextualEffects;
  let applied = false;

  // Passive effects: Always applied when modifier is active
  if (ctx.passive) {
    applyEffectFields(ctx.passive, result);
    applied = true;
  }

  // Actor's modifiers: apply whenAttacking
  if (source === 'actor' && ctx.whenAttacking) {
    applyEffectFields(ctx.whenAttacking, result);
    applied = true;
  }

  // Target's modifiers: apply whenDefending and melee/ranged variants
  if (source === 'target') {
    // General defending effect
    if (ctx.whenDefending) {
      applyEffectFields(ctx.whenDefending, result);
      applied = true;
    }

    // Melee-specific (adjacent)
    if (isAdjacent && ctx.whenDefendingMelee) {
      applyEffectFields(ctx.whenDefendingMelee, result);
      applied = true;
    }

    // Ranged-specific (non-adjacent)
    if (!isAdjacent && ctx.whenDefendingRanged) {
      applyEffectFields(ctx.whenDefendingRanged, result);
      applied = true;
    }
  }

  if (applied) {
    result.sources.push(mod.id);
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
 * Contextual Effects:
 * - Actor modifiers: Apply whenAttacking effects
 * - Target modifiers: Apply whenDefending + melee/ranged variants based on adjacency
 * - Action/Area modifiers: Use legacy effect field (no contextual effects)
 */
export function getModifiers(
  context: GetModifiersContext,
  targetResult: TargetResult
): ModifierSet[] {
  const { actor, action, state } = context;

  return targetResult.targets.map(target => {
    // Build evaluation context for the expression DSL
    const evalCtx = buildEvaluationContext(actor, target, action, state);

    // Calculate adjacency for melee/ranged distinction
    const isAdjacent = getDistanceCells(actor, target) <= 1;

    // 1. Collect all SchemaModifier from the 4 sources WITH source tracking
    const trackedModifiers: TrackedModifier[] = [
      // Source 1: Actor modifiers (Conditions, Buffs, Traits)
      ...actor.combatState.modifiers.map(am => ({ modifier: am.modifier, source: 'actor' as const })),
      // Source 2: Target modifiers (Conditions, Buffs, Traits)
      ...target.combatState.modifiers.map(am => ({ modifier: am.modifier, source: 'target' as const })),
      // Source 3: Action modifiers (refs + inline)
      ...resolveModifierRefs(action.modifierRefs ?? []).map(m => ({ modifier: m, source: 'action' as const })),
      ...(action.schemaModifiers ?? []).map(m => ({ modifier: m, source: 'action' as const })),
      // Source 4: Area effects (Cover, Auras, Zones)
      ...getAreaModifiers(actor, target, state).map(m => ({ modifier: m, source: 'area' as const })),
    ];

    // Source 5: Auto-applied ranged attack modifiers (Long Range Disadvantage, Ranged in Melee)
    // D&D 5e Core Rules - automatically apply to all ranged weapon/spell attacks
    const checkAttackType = getCheckAttackType(action);
    const isRangedAction =
      checkAttackType === 'ranged-weapon' ||
      checkAttackType === 'ranged-spell' ||
      action.actionType === 'ranged-weapon' ||
      action.actionType === 'ranged-spell' ||
      (action.range?.type === 'ranged');

    if (isRangedAction) {
      const rangedModifiers = [
        modifierPresetsMap.get('ranged-long-range'),
        modifierPresetsMap.get('ranged-in-melee'),
      ].filter((m): m is SchemaModifier => m !== undefined);

      trackedModifiers.push(
        ...rangedModifiers.map(m => ({ modifier: m, source: 'action' as const }))
      );

      debug('Auto-applied ranged modifiers:', {
        actionId: action.id,
        modifierIds: rangedModifiers.map(m => m.id),
      });
    }

    // 2. Evaluate and accumulate (sorted by priority, higher first)
    const result = createEmptyPartial();
    const sortedModifiers = trackedModifiers.sort(
      (a, b) => (b.modifier.priority ?? 0) - (a.modifier.priority ?? 0)
    );

    for (const { modifier, source } of sortedModifiers) {
      if (evaluateCondition(modifier.condition, evalCtx)) {
        applyModifierEffect(modifier, source, isAdjacent, result);
      }
    }

    // 3. Finalize: resolve advantage states
    const finalModifiers = {
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

    debug('finalModifiers:', {
      targetId: target.id,
      attackAdvantage: finalModifiers.attackAdvantage,
      sources: finalModifiers.sources,
      advSources: result.attackAdvSources,
      disadvSources: result.attackDisadvSources,
    });

    return finalModifiers;
  });
}
