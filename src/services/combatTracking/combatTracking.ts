// Ziel: Combat State-Management und Action-Resolution
// Siehe: docs/services/combatTracking.md
//
// UI-orientierter Service für Combat-Tracker:
// - "Combatant X macht Combatant Y Z Schaden" → Service übernimmt State-Updates
// - Profile-Erstellung aus Party und Encounter-Gruppen
// - Turn Budget Tracking (D&D 5e Action Economy)
//
// Wird von combatantAI und Workflows genutzt.

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Keine Condition-Tracking
// - conditionProb immer 0 in resolveAttack()
// - Spec: difficulty.md#5.1.d beschreibt Condition-Wahrscheinlichkeiten
//
// [TODO]: Implementiere resolveHealing() für Healing-Actions
// - Spec: difficulty.md#5.1.b (healing intent)
//
// [TODO]: Implementiere resolveCondition() für Control-Actions
// - Spec: difficulty.md#5.1.b (control intent)
//
// [TODO]: Bonus Actions Requirement-Prüfung (requires.priorAction)
// - generateBonusActions() in combatantAI.ts prüft Requirements
// - Spec: turnExploration.md#bonus-action-requirements
//
// --- Phase 6: Reaction System ---
//
// [HACK]: Save-Bonus bei Damage-Reactions via HP approximiert
// - processReactionTrigger() nutzt HP/30 + 2 statt echtem Save-Bonus
// - CombatProfile hat kein saves-Feld
// - Ideal: Save-Boni aus Creature/Character-Schema extrahieren
//
// [HACK]: Counterspell Success nur via counter-Feld geprueft
// - processReactionTrigger() setzt spellCountered wenn reaction.counter existiert
// - Keine DC-Pruefung bei hoeherem Spell-Level
// - Ideal: DC-Check implementieren wenn counterspellLevel < spellLevel
//
// [HACK]: Shield AC-Bonus nicht persistent
// - resolveAttackWithReactions() erhoeht AC nur fuer diese Resolution
// - RAW: Shield AC-Bonus gilt bis Start des naechsten eigenen Zuges
// - Ideal: ConditionState mit temporaerem AC-Modifier tracken
//
// [TODO]: Damage-Reactions gegen Angreifer anwenden
// - processReactionTrigger() berechnet Hellish Rebuke Schaden
// - Schaden wird nicht auf Angreifer-HP angewendet
// - Benoetigt: Rueckgabe und Application in Combat-Flow
//

import type { Action } from '@/types/entities';
import {
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  getExpectedValue,
  diceExpressionToPMF,
  addConstant,
} from '@/utils';
import { calculateBaseDamagePMF } from '../combatantAI/combatHelpers';
// Reaction-Funktionen konsolidiert in actionScoring.ts
import {
  findMatchingReactions,
  shouldUseReaction,
  evaluateReaction,
} from '../combatantAI/actionScoring';
// Types sind jetzt in @/types/combat (Single Source of Truth)
import type { ReactionContext, ReactionResult } from '@/types/combat';
import type { TriggerEvent } from '@/constants/action';

// Types aus @/types/combat (Single Source of Truth)
// Re-exports sind in index.ts - hier nur lokale Imports
import type {
  ProbabilityDistribution,
  TurnBudget,
  AttackResolution,
  Combatant,
  CombatantSimulationState,
} from '@/types/combat';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatTracking]', ...args);
  }
};

// ============================================================================
// IMPORTS FROM combatState.ts (für lokale Verwendung)
// ============================================================================
// Re-exports sind in index.ts - hier nur lokale Imports

import {
  getHP,
  getAC,
  getSpeed,
  getActions,
  getDeathProbability,
} from './combatState';


// ============================================================================
// TURN BUDGET FUNCTIONS
// ============================================================================

/**
 * Prüft ob ein Combatant Bonus Actions hat.
 * Bonus Actions sind Actions mit timing.type === 'bonus'.
 */
export function hasAnyBonusAction(combatant: Combatant): boolean {
  return getActions(combatant).some(a => a.timing.type === 'bonus');
}

/** Erstellt TurnBudget aus Combatant. */
export function createTurnBudget(combatant: Combatant): TurnBudget {
  const speed = getSpeed(combatant);
  const walkSpeed = speed.walk ?? 30;
  const movementCells = Math.floor(walkSpeed / 5);

  debug('createTurnBudget:', {
    id: combatant.id,
    walkSpeed,
    movementCells,
  });

  return {
    movementCells,
    baseMovementCells: movementCells,
    hasAction: true,
    hasDashed: false,
    hasBonusAction: hasAnyBonusAction(combatant),
    hasReaction: true,      // Für OA-Detection später
  };
}

/** Prüft ob noch sinnvolle Aktionen möglich sind. */
export function hasBudgetRemaining(budget: TurnBudget): boolean {
  return budget.movementCells > 0 || budget.hasAction || budget.hasBonusAction;
}

/** Verbraucht Movement-Cells (1 Cell = 5ft). */
export function consumeMovement(budget: TurnBudget, cells: number = 1): void {
  budget.movementCells = Math.max(0, budget.movementCells - cells);
}

/** Verbraucht die Action für diesen Zug. */
export function consumeAction(budget: TurnBudget): void {
  budget.hasAction = false;
}

/** Verbraucht die Bonus Action für diesen Zug. */
export function consumeBonusAction(budget: TurnBudget): void {
  budget.hasBonusAction = false;
}

/** Verbraucht die Reaction. TODO: OA-Trigger-Detection (siehe Header) */
export function consumeReaction(budget: TurnBudget): void {
  budget.hasReaction = false;
}

/** Dash fügt die Basis-Bewegungsrate hinzu und verbraucht die Action. */
export function applyDash(budget: TurnBudget): void {
  budget.movementCells += budget.baseMovementCells;
  budget.hasAction = false;
  budget.hasDashed = true;
}

// ============================================================================
// ACTION RESOLUTION
// ============================================================================

// Shared helpers for hit chance and multiattack damage
import {
  calculateHitChance,
  calculateMultiattackDamage,
} from '../combatantAI/combatHelpers';

/**
 * Resolves a single attack action against a target.
 * Supports both single attacks and multiattack.
 */
export function resolveAttack(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  acBonus?: number
): AttackResolution | null {
  let effectiveDamage: ProbabilityDistribution;
  const targetAC = getAC(target) + (acBonus ?? 0);

  if (action.multiattack) {
    const multiDamage = calculateMultiattackDamage(action, getActions(attacker), targetAC);
    if (!multiDamage) {
      debug('resolveAttack: multiattack has no valid refs', { actionName: action.name });
      return null;
    }
    effectiveDamage = multiDamage;
  } else {
    if (!action.attack) {
      debug('resolveAttack: action has no attack', { actionName: action.name });
      return null;
    }

    const baseDamage = calculateBaseDamagePMF(action);
    if (!baseDamage) {
      debug('resolveAttack: action has no damage', { actionName: action.name });
      return null;
    }

    const hitChance = calculateHitChance(action.attack.bonus, targetAC);
    effectiveDamage = calculateEffectiveDamage(
      baseDamage,
      hitChance,
      getDeathProbability(attacker),
      0 // conditionProb - HACK: keine Conditions
    );
  }

  const newTargetHP = applyDamageToHP(getHP(target), effectiveDamage);
  const newDeathProbability = calculateDeathProbability(newTargetHP);
  const damageDealt = getExpectedValue(effectiveDamage);

  debug('resolveAttack:', {
    attacker: attacker.id,
    target: target.id,
    action: action.name,
    isMultiattack: !!action.multiattack,
    damageDealt,
    newDeathProbability,
  });

  return {
    newTargetHP,
    damageDealt,
    newDeathProbability,
  };
}

// ============================================================================
// REACTION PROCESSING
// ============================================================================

/**
 * Interface fuer Reaction-Trigger-Events.
 * Wird von Combat-Flow verwendet um Reactions auszuloesen.
 */
export interface ReactionTrigger {
  /** Das ausloesende Event */
  event: TriggerEvent;
  /** Der Ausloeser (Angreifer, Spell-Caster, etc.) */
  source: Combatant;
  /** Optional: Das Ziel des Triggers */
  target?: Combatant;
  /** Optional: Die ausloesende Action */
  action?: Action;
  /** Optional: Zugefuegter Schaden (bei 'damaged' Event) */
  damage?: number;
  /** Optional: Spell-Level (bei 'spell-cast' Event) */
  spellLevel?: number;
}

/**
 * Prueft und fuehrt Reactions fuer alle relevanten Combatants aus.
 * Wird nach relevanten Events aufgerufen (attacked, damaged, spell-cast, etc.)
 *
 * @param trigger Der ausloesende Trigger
 * @param state CombatantSimulationState mit allen Combatants
 * @param budgets Map von combatantId zu TurnBudget fuer Reaction-Tracking
 * @returns Array von ReactionResults (ausgefuehrte und abgelehnte Reactions)
 */
export function processReactionTrigger(
  trigger: ReactionTrigger,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): ReactionResult[] {
  const results: ReactionResult[] = [];

  debug('processReactionTrigger:', {
    event: trigger.event,
    source: trigger.source.id,
    target: trigger.target?.id,
  });

  // Finde alle Combatants die auf dieses Event reagieren koennten
  for (const combatant of state.combatants) {
    // Skip Source (kann nicht auf eigene Aktion reagieren)
    if (combatant.id === trigger.source.id) {
      continue;
    }

    // Skip tote Combatants
    if (getDeathProbability(combatant) >= 0.95) {
      continue;
    }

    // Pruefe ob Reaction verfuegbar
    const budget = budgets.get(combatant.id);
    if (!budget?.hasReaction) {
      continue;
    }

    // Finde passende Reactions fuer dieses Event
    const matchingReactions = findMatchingReactions(combatant, trigger.event);

    if (matchingReactions.length === 0) {
      continue;
    }

    // Erstelle ReactionContext
    const context: ReactionContext = {
      event: trigger.event,
      source: trigger.source,
      target: trigger.target,
      action: trigger.action,
      damage: trigger.damage,
      spellLevel: trigger.spellLevel,
    };

    // Waehle beste Reaction basierend auf Score
    let bestReaction = matchingReactions[0];
    let bestScore = evaluateReaction(bestReaction, context, combatant, state);

    for (let i = 1; i < matchingReactions.length; i++) {
      const score = evaluateReaction(matchingReactions[i], context, combatant, state);
      if (score > bestScore) {
        bestScore = score;
        bestReaction = matchingReactions[i];
      }
    }

    // Pruefe ob Reaction genutzt werden soll
    if (!shouldUseReaction(bestReaction, context, combatant, state, budget)) {
      debug('processReactionTrigger: reaction not worth using', {
        combatant: combatant.id,
        reaction: bestReaction.name,
        score: bestScore,
      });
      results.push({
        reactor: combatant,
        reaction: bestReaction,
        executed: false,
      });
      continue;
    }

    // Reaction ausfuehren
    consumeReaction(budget);

    // Effekte basierend auf Event-Typ
    const result: ReactionResult = {
      reactor: combatant,
      reaction: bestReaction,
      executed: true,
      effect: {},
    };

    // Shield: AC-Bonus
    if (trigger.event === 'attacked' && bestReaction.effects) {
      const acBonus = bestReaction.effects.reduce((total, effect) => {
        const acMod = effect.statModifiers?.find(m => m.stat === 'ac');
        return total + (acMod?.value ?? 0);
      }, 0);

      if (acBonus > 0) {
        result.effect!.acBonus = acBonus;
        debug('processReactionTrigger: Shield AC bonus', {
          combatant: combatant.id,
          acBonus,
        });
      }
    }

    // Counterspell: Spell gecountert
    if (trigger.event === 'spell-cast' && bestReaction.counter) {
      result.effect!.spellCountered = true;
      debug('processReactionTrigger: Counterspell', {
        combatant: combatant.id,
        counteredSpell: trigger.action?.name,
      });
    }

    // Hellish Rebuke / Damage-Reactions: Schaden
    if (trigger.event === 'damaged' && bestReaction.damage) {
      // Schaden wird als expected value berechnet
      const damagePMF = diceExpressionToPMF(bestReaction.damage.dice);
      let damage = getExpectedValue(addConstant(damagePMF, bestReaction.damage.modifier));

      // Save-basierte Reactions
      if (bestReaction.save) {
        const saveBonus = Math.floor(getExpectedValue(getHP(trigger.source)) / 30) + 2; // Approximation
        const dc = bestReaction.save.dc;
        const failChance = Math.min(0.95, Math.max(0.05, (dc - saveBonus - 1) / 20));

        if (bestReaction.save.onSave === 'half') {
          damage = damage * failChance + (damage * 0.5) * (1 - failChance);
        } else {
          damage = damage * failChance;
        }
      }

      result.effect!.damage = damage;
      debug('processReactionTrigger: Damage reaction', {
        combatant: combatant.id,
        damage,
      });
    }

    results.push(result);

    debug('processReactionTrigger: reaction executed', {
      combatant: combatant.id,
      reaction: bestReaction.name,
      effect: result.effect,
    });
  }

  return results;
}

// ============================================================================
// COMBAT FLOW INTEGRATION
// ============================================================================

/**
 * Erweitertes AttackResolution mit Reaction-Informationen.
 */
export interface AttackResolutionWithReactions extends AttackResolution {
  /** Reactions die auf 'attacked' getriggert wurden (z.B. Shield) */
  attackedReactions: ReactionResult[];
  /** Reactions die auf 'damaged' getriggert wurden (z.B. Hellish Rebuke) */
  damagedReactions: ReactionResult[];
  /** War der Angriff erfolgreich? (nach Shield etc.) */
  attackHit: boolean;
  /** AC-Bonus durch Reactions (z.B. Shield +5) */
  targetACBonus: number;
}

/**
 * Loest einen Angriff auf inklusive Reaction-Verarbeitung.
 *
 * Ablauf:
 * 1. 'attacked' Trigger → Shield-artige Reactions koennen AC erhoehen
 * 2. Attack Resolution mit modifiziertem AC
 * 3. Bei Schaden: 'damaged' Trigger → Hellish Rebuke etc. kann zurueckschlagen
 *
 * @param attacker Der angreifende Combatant
 * @param target Das Ziel des Angriffs
 * @param action Die Attack-Action
 * @param state CombatantSimulationState fuer Reaction-Evaluation
 * @param budgets Budget-Map fuer Reaction-Tracking
 * @returns AttackResolution mit Reaction-Informationen, null bei ungueltigem Attack
 */
export function resolveAttackWithReactions(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): AttackResolutionWithReactions | null {
  // Phase 1: 'attacked' Trigger (vor Damage-Resolution)
  const attackedTrigger: ReactionTrigger = {
    event: 'attacked',
    source: attacker,
    target,
    action,
  };

  const attackedReactions = processReactionTrigger(attackedTrigger, state, budgets);

  // Berechne AC-Bonus aus Reactions (z.B. Shield)
  const targetACBonus = attackedReactions.reduce((total, result) => {
    if (result.executed && result.effect?.acBonus) {
      return total + result.effect.acBonus;
    }
    return total;
  }, 0);

  // Phase 2: Attack Resolution mit AC-Bonus aus Reactions
  const baseResolution = resolveAttack(attacker, target, action, targetACBonus);

  if (!baseResolution) {
    return null;
  }

  // Pruefe ob Angriff getroffen hat (basierend auf Damage > 0)
  const attackHit = baseResolution.damageDealt > 0;

  // Phase 3: 'damaged' Trigger (nur wenn Schaden zugefuegt)
  let damagedReactions: ReactionResult[] = [];

  if (attackHit && baseResolution.damageDealt > 0) {
    const damagedTrigger: ReactionTrigger = {
      event: 'damaged',
      source: attacker,
      target,
      action,
      damage: baseResolution.damageDealt,
    };

    damagedReactions = processReactionTrigger(damagedTrigger, state, budgets);
  }

  debug('resolveAttackWithReactions:', {
    attacker: attacker.id,
    target: target.id,
    action: action.name,
    targetACBonus,
    attackHit,
    damageDealt: baseResolution.damageDealt,
    attackedReactionsCount: attackedReactions.filter(r => r.executed).length,
    damagedReactionsCount: damagedReactions.filter(r => r.executed).length,
  });

  return {
    ...baseResolution,
    attackedReactions,
    damagedReactions,
    attackHit,
    targetACBonus,
  };
}

/**
 * Prueft ob ein Spell durch Counterspell aufgehoben wird.
 *
 * @param caster Der Spell-Caster
 * @param spell Die Spell-Action
 * @param state CombatantSimulationState fuer Reaction-Evaluation
 * @param budgets Budget-Map fuer Reaction-Tracking
 * @returns true wenn der Spell durch Counterspell aufgehoben wurde
 */
export function checkCounterspell(
  caster: Combatant,
  spell: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): { countered: boolean; reactions: ReactionResult[] } {
  // Nur Spells mit spellSlot triggern Counterspell
  if (!spell.spellSlot) {
    return { countered: false, reactions: [] };
  }

  const trigger: ReactionTrigger = {
    event: 'spell-cast',
    source: caster,
    action: spell,
    spellLevel: spell.spellSlot.level,
  };

  const reactions = processReactionTrigger(trigger, state, budgets);

  // Pruefe ob irgendein Counterspell erfolgreich war
  const countered = reactions.some(r => r.executed && r.effect?.spellCountered);

  debug('checkCounterspell:', {
    caster: caster.id,
    spell: spell.name,
    spellLevel: spell.spellSlot.level,
    countered,
    reactionsCount: reactions.filter(r => r.executed).length,
  });

  return { countered, reactions };
}

