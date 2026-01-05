// Ziel: Plugin-basiertes System für situative Combat-Modifikatoren
// Siehe: docs/services/combatSimulator/combatantAI.md
//
// Architektur:
// - ModifierEvaluator Interface für einzelne Modifier-Plugins
// - ModifierRegistry für dynamische Registrierung
// - evaluateSituationalModifiers() akkumuliert alle aktiven Effekte
// - +/-5 Approximation für Advantage/Disadvantage (Performance)
//
// Erweiterbarkeit:
// 1. Neue Datei in modifiers/ erstellen
// 2. ModifierEvaluator implementieren
// 3. Import in modifiers/index.ts hinzufügen
// Keine Core-Änderungen nötig!

import type { Action } from '@/types/entities';
import type { GridPosition } from '@/utils';

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
// CONDITION STATE (für Combatant Conditions)
// ============================================================================

/** Condition-State für Combatants */
export interface ConditionState {
  name: string;
  probability?: number;          // Für probabilistische Conditions
  effect?: 'incapacitated' | 'disadvantage' | 'other';
}

// ============================================================================
// MODIFIER CONTEXT
// ============================================================================

/** Kontext für einen einzelnen Combatant */
export interface CombatantContext {
  position: GridPosition;
  groupId: string;
  participantId: string;
  conditions: ConditionState[];
  ac: number;
  hp: number;
}

/** Minimale SimulationState-Info für Modifier-Evaluation */
export interface ModifierSimulationState {
  profiles: Array<{
    position: GridPosition;
    groupId: string;
    participantId: string;
    conditions?: ConditionState[];
  }>;
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
 */
export function resolveAdvantageState(
  hasAdvantage: boolean,
  hasDisadvantage: boolean
): 'advantage' | 'disadvantage' | 'normal' {
  if (hasAdvantage && hasDisadvantage) return 'normal';
  if (hasAdvantage) return 'advantage';
  if (hasDisadvantage) return 'disadvantage';
  return 'normal';
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
// MAIN EVALUATION FUNCTION
// ============================================================================

/**
 * Evaluiert alle registrierten Modifiers und akkumuliert Effekte.
 * Nutzt die globale Registry.
 */
export function evaluateSituationalModifiers(
  context: ModifierContext
): SituationalModifiers {
  const evaluators = modifierRegistry.getAll();
  const activeEffects: ModifierEffect[] = [];
  const activeSources: string[] = [];

  for (const evaluator of evaluators) {
    try {
      if (evaluator.isActive(context)) {
        const effect = evaluator.getEffect(context);
        activeEffects.push(effect);
        activeSources.push(evaluator.id);

        debug('Modifier active:', {
          id: evaluator.id,
          effect,
        });
      }
    } catch (error) {
      console.error(`[situationalModifiers] Error in evaluator ${evaluator.id}:`, error);
    }
  }

  const result = accumulateEffects(activeEffects, activeSources);

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
