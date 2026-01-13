// Ziel: Plugin-basiertes System für situative Combat-Modifikatoren (AI Layer)
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// Architektur:
// - ADAPTER: Importiert Basis-Logik aus combatTracking/resolution/gatherModifiers
// - ModifierEvaluator Interface für AI-spezifische Plugins
// - ModifierRegistry für dynamische Plugin-Registrierung
// - evaluateSituationalModifiers() kombiniert Core + Plugins
// - +/-5 Approximation für Advantage/Disadvantage (Performance)
//
// Core vs AI Split:
// - Core (gatherModifiers): Conditions, Buffs, Schema-Modifiers, Passive Traits, Auras
// - AI (hier): Registry-Plugins für AI-spezifische Evaluation (long-range, cover)
//
// Pipeline-Position:
// - Aufgerufen von: actionScoring.calculatePairScore() → evaluateSituationalModifiers()
// - Plugins in: modifiers/*.ts (longRange, cover, etc.)
// - Output: SituationalModifiers (netAdvantage, effectiveAttackMod, etc.)

import type { Action } from '@/types/entities';
import type { PropertyModifier } from '@/types/entities/conditionExpression';
import type { GridPosition, ConditionState, Combatant, CombatState } from '@/types/combat';
import {
  gatherModifiers,
  resolveAdvantageState as coreResolveAdvantage,
  type ModifierSet,
  type GatherModifiersContext,
} from '../combatTracking/resolution/gatherModifiers';

// Re-export ConditionState für Consumer
export type { ConditionState } from '@/types/combat';

// ============================================================================
// MODIFIER EFFECT TYPES
// ============================================================================

/** Mögliche Effekte eines Modifiers */
export interface ModifierEffect {
  advantage?: boolean;           // Grants advantage
  disadvantage?: boolean;        // Grants disadvantage
  attackBonus?: number;          // Flat attack bonus (+1, +2, etc.)
  acBonus?: number;              // Target AC bonus (cover)
  damageBonus?: number;          // Flat damage bonus
  autoCrit?: boolean;            // Auto-critical hit (e.g., paralyzed target)
  autoMiss?: boolean;            // Auto-miss (full cover)

  // Generic property modifiers for action modifications
  propertyModifiers?: PropertyModifier[];
}

/** Akkumulierte Modifiers für einen Angriff */
export interface SituationalModifiers {
  effects: ModifierEffect[];     // Alle aktiven Effekte
  sources: string[];             // IDs der aktiven Modifier-Quellen

  // Computed (nach Akkumulation)
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  totalAttackBonus: number;      // Summe aller attackBonus
  totalACBonus: number;          // Summe aller acBonus (Cover etc.)
  totalDamageBonus: number;      // Summe aller damageBonus
  effectiveAttackMod: number;    // +5 für Advantage, -5 für Disadvantage, 0 sonst
  hasAutoCrit: boolean;          // Mindestens ein autoCrit aktiv
  hasAutoMiss: boolean;          // Mindestens ein autoMiss aktiv
}

// ============================================================================
// MODIFIER CONTEXT
// ============================================================================
// ConditionState wird aus @/types/combat importiert (Single Source of Truth)

/** Kontext für einen einzelnen Combatant */
export interface CombatantContext {
  position: GridPosition;
  groupId: string;
  participantId: string;
  conditions: ConditionState[];
  ac: number;
  hp: number;
  maxHp: number;              // Für HP-Prozent-Berechnungen (Bloodied)
  creatureId?: string;        // Für Creature-Type-Checks (Aura of Authority)
}

/** SimulationState für Modifier-Evaluation - direkte Combatant-Referenz */
export interface ModifierSimulationState {
  combatants: Combatant[];   // Direkte Referenz, keine Kopie
  alliances: Record<string, string[]>;
}

/** Vollständiger Kontext für Modifier-Evaluation */
export interface ModifierContext {
  attacker: CombatantContext;
  target: CombatantContext;
  action: Action;
  state: ModifierSimulationState;
  cell?: GridPosition;           // Optional: Evaluierte Position (für AI)
}

// ============================================================================
// MODIFIER EVALUATOR INTERFACE (Plugin)
// ============================================================================

/** Ein einzelner Modifier-Evaluator (Plugin) */
export interface ModifierEvaluator {
  id: string;                    // Unique ID: 'long-range', 'pack-tactics', etc.
  name: string;                  // Display name für Debug/UI
  description: string;           // Erklärung für Debug/UI

  /** Prüft ob dieser Modifier aktiv ist */
  isActive: (ctx: ModifierContext) => boolean;

  /** Liefert den Effekt wenn aktiv */
  getEffect: (ctx: ModifierContext) => ModifierEffect;

  /** Optional: Priorität für Evaluation (höher = früher, default: 0) */
  priority?: number;
}

// ============================================================================
// MODIFIER REGISTRY
// ============================================================================

/** Registry für alle Modifier-Plugins */
export class ModifierRegistry {
  private evaluators: Map<string, ModifierEvaluator> = new Map();

  /** Registriert einen Modifier-Evaluator */
  register(evaluator: ModifierEvaluator): void {
    if (this.evaluators.has(evaluator.id)) {
      console.warn(`[ModifierRegistry] Overwriting existing evaluator: ${evaluator.id}`);
    }
    this.evaluators.set(evaluator.id, evaluator);
  }

  /** Entfernt einen Modifier-Evaluator */
  unregister(id: string): void {
    this.evaluators.delete(id);
  }

  /** Gibt alle registrierten Evaluators zurück (sortiert nach Priorität) */
  getAll(): ModifierEvaluator[] {
    return Array.from(this.evaluators.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /** Gibt einen spezifischen Evaluator zurück */
  get(id: string): ModifierEvaluator | undefined {
    return this.evaluators.get(id);
  }

  /** Anzahl registrierter Evaluators */
  get size(): number {
    return this.evaluators.size;
  }

  /** Löscht alle registrierten Evaluators (für Tests) */
  clear(): void {
    this.evaluators.clear();
  }
}

// Globale Registry-Instanz
export const modifierRegistry = new ModifierRegistry();

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[situationalModifiers]', ...args);
  }
};

// ============================================================================
// ADVANTAGE STATE RESOLUTION
// ============================================================================

/**
 * Resolves advantage/disadvantage per D&D 5e cancellation rules.
 * Any advantage + any disadvantage = normal roll (they cancel).
 *
 * Note: Uses 'normal' for backwards compatibility with AI layer.
 * Core uses 'none' instead. This function wraps core and converts.
 */
export function resolveAdvantageState(
  hasAdvantage: boolean,
  hasDisadvantage: boolean
): 'advantage' | 'disadvantage' | 'normal' {
  const result = coreResolveAdvantage(
    hasAdvantage ? 1 : 0,
    hasDisadvantage ? 1 : 0
  );
  return result === 'none' ? 'normal' : result;
}

// ============================================================================
// TYPE CONVERSION
// ============================================================================

/**
 * Converts ModifierSet from gatherModifiers to SituationalModifiers format.
 */
function modifierSetToSituationalModifiers(
  modSet: ModifierSet,
  additionalEffects: ModifierEffect[] = [],
  additionalSources: string[] = []
): SituationalModifiers {
  // Convert base ModifierSet to ModifierEffect
  const baseEffect: ModifierEffect = {
    advantage: modSet.attackAdvantage === 'advantage',
    disadvantage: modSet.attackAdvantage === 'disadvantage',
    attackBonus: modSet.attackBonus,
    acBonus: modSet.targetACBonus,
    damageBonus: modSet.damageBonus,
    autoCrit: modSet.hasAutoCrit,
    autoMiss: modSet.hasAutoMiss,
  };

  const allEffects = [baseEffect, ...additionalEffects];
  const allSources = [...modSet.sources, ...additionalSources];

  // Accumulate all effects
  return accumulateEffects(allEffects, allSources);
}

// ============================================================================
// EFFECT ACCUMULATION
// ============================================================================

/**
 * Akkumuliert mehrere ModifierEffects zu finalen SituationalModifiers.
 */
export function accumulateEffects(
  effects: ModifierEffect[],
  sources: string[]
): SituationalModifiers {
  let hasAdvantage = false;
  let hasDisadvantage = false;
  let totalAttackBonus = 0;
  let totalACBonus = 0;
  let totalDamageBonus = 0;
  let hasAutoCrit = false;
  let hasAutoMiss = false;

  for (const effect of effects) {
    if (effect.advantage) hasAdvantage = true;
    if (effect.disadvantage) hasDisadvantage = true;
    if (effect.attackBonus) totalAttackBonus += effect.attackBonus;
    if (effect.acBonus) totalACBonus += effect.acBonus;
    if (effect.damageBonus) totalDamageBonus += effect.damageBonus;
    if (effect.autoCrit) hasAutoCrit = true;
    if (effect.autoMiss) hasAutoMiss = true;
  }

  const netAdvantage = resolveAdvantageState(hasAdvantage, hasDisadvantage);

  // +/-5 Approximation für Advantage/Disadvantage
  let effectiveAttackMod = 0;
  if (netAdvantage === 'advantage') effectiveAttackMod = 5;
  if (netAdvantage === 'disadvantage') effectiveAttackMod = -5;

  return {
    effects,
    sources,
    netAdvantage,
    totalAttackBonus,
    totalACBonus,
    totalDamageBonus,
    effectiveAttackMod,
    hasAutoCrit,
    hasAutoMiss,
  };
}

// ============================================================================
// CORE ADAPTER
// ============================================================================

/**
 * Finds a Combatant by participantId.
 */
function findCombatant(participantId: string, combatants: Combatant[]): Combatant | undefined {
  return combatants.find(c => c.id === participantId);
}

/**
 * Calls gatherModifiers from combatTracking and converts the result.
 * This is the bridge between AI ModifierContext and Combat GatherModifiersContext.
 */
function gatherModifiersForAI(context: ModifierContext): ModifierSet | null {
  const actor = findCombatant(context.attacker.participantId, context.state.combatants);
  const target = findCombatant(context.target.participantId, context.state.combatants);

  if (!actor || !target) {
    debug('gatherModifiersForAI: Could not find actor or target combatant');
    return null;
  }

  // Build GatherModifiersContext
  const gatherCtx: GatherModifiersContext = {
    actor,
    action: context.action,
    state: {
      combatants: context.state.combatants,
      alliances: context.state.alliances,
      // Minimal CombatState fields needed
    } as unknown as CombatState,
  };

  // Call gatherModifiers with single target
  const targetResult = {
    targets: [target],
    isAoE: false,
    primaryTarget: target,
  };

  const results = gatherModifiers(gatherCtx, targetResult);
  return results[0] ?? null;
}

// ============================================================================
// MAIN EVALUATION FUNCTION
// ============================================================================

/**
 * Evaluiert alle Modifiers und akkumuliert Effekte.
 *
 * Combines:
 * 1. Core modifiers from gatherModifiers (conditions, buffs, schema-modifiers, etc.)
 * 2. Registry plugins (AI-specific evaluators)
 */
export function evaluateSituationalModifiers(
  context: ModifierContext
): SituationalModifiers {
  // 1. Get base modifiers from core combat tracking
  const baseModifiers = gatherModifiersForAI(context);

  // 2. Evaluate registry plugins (AI-specific)
  const evaluators = modifierRegistry.getAll();
  const pluginEffects: ModifierEffect[] = [];
  const pluginSources: string[] = [];

  for (const evaluator of evaluators) {
    try {
      if (evaluator.isActive(context)) {
        const effect = evaluator.getEffect(context);
        pluginEffects.push(effect);
        pluginSources.push(evaluator.id);

        debug('Plugin modifier active:', {
          id: evaluator.id,
          effect,
        });
      }
    } catch (error) {
      console.error(`[situationalModifiers] Error in evaluator ${evaluator.id}:`, error);
    }
  }

  // 3. Merge base and plugin modifiers
  let result: SituationalModifiers;

  if (baseModifiers) {
    result = modifierSetToSituationalModifiers(baseModifiers, pluginEffects, pluginSources);
  } else {
    // Fallback: Only use plugin effects
    result = accumulateEffects(pluginEffects, pluginSources);
  }

  debug('evaluateSituationalModifiers:', {
    attackerId: context.attacker.participantId,
    targetId: context.target.participantId,
    actionName: context.action.name,
    activeSources: result.sources,
    netAdvantage: result.netAdvantage,
    effectiveAttackMod: result.effectiveAttackMod,
  });

  return result;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/** Factory für leere Modifiers (keine aktiven Effekte) */
export function createEmptyModifiers(): SituationalModifiers {
  return {
    effects: [],
    sources: [],
    netAdvantage: 'normal',
    totalAttackBonus: 0,
    totalACBonus: 0,
    totalDamageBonus: 0,
    effectiveAttackMod: 0,
    hasAutoCrit: false,
    hasAutoMiss: false,
  };
}
