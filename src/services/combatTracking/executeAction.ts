// Ziel: Action-Ausführung und Protocol-Logging
// Siehe: docs/services/combatTracking.md
//
// Single Source of Truth für Action-Execution.
// KEINE AI-Logik - nur State-Mutation basierend auf übergebener Aktion.
//
// Datenfluss:
// combatantAI.selectNextAction() → wählt nächste Aktion
// executeAction()                → mutiert State + Budget, gibt ActionResult zurück
// Bei 'pass'                     → advanceTurn()

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: resolveHealing() für Healing-Actions
// - Aktuell: nur damage Actions implementiert
// - Spec: difficulty.md#5.1.b (healing intent)
//
// [TODO]: resolveCondition() für Control-Actions
// - Aktuell: Conditions nicht angewendet
// - Spec: difficulty.md#5.1.d
//
// [TODO]: damageReceived von Reactions tracken
// - Aktuell: Hellish Rebuke etc. nicht auf Angreifer angewendet
//
// [HACK]: Keine Condition-Tracking
// - conditionProb immer 0 in resolveAttack()
// - Spec: difficulty.md#5.1.d beschreibt Condition-Wahrscheinlichkeiten
//
// [HACK]: Save-Bonus bei Damage-Reactions via HP approximiert
// - processReactionTrigger() nutzt HP/30 + 2 statt echtem Save-Bonus
//
// [HACK]: Shield AC-Bonus nicht persistent
// - resolveAttackWithReactions() erhoeht AC nur fuer diese Resolution
// - RAW: Shield AC-Bonus gilt bis Start des naechsten eigenen Zuges

import type { Action } from '@/types/entities';
import type {
  TurnAction,
  CombatProtocolEntry,
  Combatant,
  GridPosition,
  ProbabilityDistribution,
  CombatantSimulationState,
  CombatState,
  TurnBudget,
  AttackResolution,
} from '@/types/combat';
import type { TriggerEvent } from '@/constants/action';
import type { ReactionContext, ReactionResult } from '@/types/combat';

import {
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  getExpectedValue,
  diceExpressionToPMF,
  addConstant,
} from '@/utils';

import {
  getPosition,
  setPosition,
  setHP,
  advanceTurn,
  getHP,
  getAC,
  getDeathProbability,
  markDeadCombatants,
} from './combatState';
// Verwendet CombatState statt CombatStateWithScoring - baseValuesCache nicht benötigt
import { getActions } from './combatState';
import {
  calculateBaseDamagePMF,
  calculateHitChance,
  calculateMultiattackDamage,
  getDistance,
  findMatchingReactions,
  shouldUseReaction,
  evaluateReaction,
} from '@/services/combatantAI';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[executeAction]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ergebnis einer ausgeführten Aktion.
 */
export interface ActionResult {
  damageDealt: number;
  damageReceived: number;  // Von Reactions (Hellish Rebuke etc.)
  healingDone: number;
  notes: string[];         // "Critical hit", "Killed Goblin", etc.
}

/**
 * Interface für Reaction-Trigger-Events.
 */
export interface ReactionTrigger {
  event: TriggerEvent;
  source: Combatant;
  target?: Combatant;
  action?: Action;
  damage?: number;
  spellLevel?: number;
}

/**
 * Erweitertes AttackResolution mit Reaction-Informationen.
 */
export interface AttackResolutionWithReactions extends AttackResolution {
  attackedReactions: ReactionResult[];
  damagedReactions: ReactionResult[];
  attackHit: boolean;
  targetACBonus: number;
}

// ============================================================================
// TURN BUDGET HELPERS (importiert für lokale Verwendung)
// ============================================================================

/** Verbraucht die Reaction. */
function consumeReaction(budget: TurnBudget): void {
  budget.hasReaction = false;
}

// ============================================================================
// ACTION RESOLUTION
// ============================================================================

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
      0, // attackerDeathProb: nicht relevant für Runde-für-Runde Simulation
      0  // conditionProb - HACK: keine Conditions
    );
  }

  const currentHP = getHP(target);
  const newTargetHP = applyDamageToHP(currentHP, effectiveDamage);
  const newDeathProbability = calculateDeathProbability(newTargetHP);
  const damageDealt = getExpectedValue(effectiveDamage);

  // HP des Targets aktualisieren
  setHP(target, newTargetHP);

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
 * Prueft und fuehrt Reactions fuer alle relevanten Combatants aus.
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

  for (const combatant of state.combatants) {
    if (combatant.id === trigger.source.id) continue;
    if (getDeathProbability(combatant) >= 0.95) continue;

    const budget = budgets.get(combatant.id);
    if (!budget?.hasReaction) continue;

    const matchingReactions = findMatchingReactions(combatant, trigger.event);
    if (matchingReactions.length === 0) continue;

    const context: ReactionContext = {
      event: trigger.event,
      source: trigger.source,
      target: trigger.target,
      action: trigger.action,
      damage: trigger.damage,
      spellLevel: trigger.spellLevel,
    };

    let bestReaction = matchingReactions[0];
    let bestScore = evaluateReaction(bestReaction, context, combatant, state);

    for (let i = 1; i < matchingReactions.length; i++) {
      const score = evaluateReaction(matchingReactions[i], context, combatant, state);
      if (score > bestScore) {
        bestScore = score;
        bestReaction = matchingReactions[i];
      }
    }

    if (!shouldUseReaction(bestReaction, context, combatant, state, budget)) {
      debug('processReactionTrigger: reaction not worth using', {
        combatant: combatant.id,
        reaction: bestReaction.name,
      });
      results.push({ reactor: combatant, reaction: bestReaction, executed: false });
      continue;
    }

    consumeReaction(budget);

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
      }
    }

    // Counterspell
    if (trigger.event === 'spell-cast' && bestReaction.counter) {
      result.effect!.spellCountered = true;
    }

    // Hellish Rebuke / Damage-Reactions
    if (trigger.event === 'damaged' && bestReaction.damage) {
      const damagePMF = diceExpressionToPMF(bestReaction.damage.dice);
      let damage = getExpectedValue(addConstant(damagePMF, bestReaction.damage.modifier));

      if (bestReaction.save) {
        const saveBonus = Math.floor(getExpectedValue(getHP(trigger.source)) / 30) + 2;
        const dc = bestReaction.save.dc;
        const failChance = Math.min(0.95, Math.max(0.05, (dc - saveBonus - 1) / 20));

        if (bestReaction.save.onSave === 'half') {
          damage = damage * failChance + (damage * 0.5) * (1 - failChance);
        } else {
          damage = damage * failChance;
        }
      }

      result.effect!.damage = damage;
    }

    results.push(result);
  }

  return results;
}

/**
 * Loest einen Angriff auf inklusive Reaction-Verarbeitung.
 */
export function resolveAttackWithReactions(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): AttackResolutionWithReactions | null {
  // Phase 1: 'attacked' Trigger
  const attackedTrigger: ReactionTrigger = {
    event: 'attacked',
    source: attacker,
    target,
    action,
  };
  const attackedReactions = processReactionTrigger(attackedTrigger, state, budgets);

  const targetACBonus = attackedReactions.reduce((total, result) => {
    if (result.executed && result.effect?.acBonus) {
      return total + result.effect.acBonus;
    }
    return total;
  }, 0);

  // Phase 2: Attack Resolution
  const baseResolution = resolveAttack(attacker, target, action, targetACBonus);
  if (!baseResolution) return null;

  const attackHit = baseResolution.damageDealt > 0;

  // Phase 3: 'damaged' Trigger
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
 */
export function checkCounterspell(
  caster: Combatant,
  spell: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): { countered: boolean; reactions: ReactionResult[] } {
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
  const countered = reactions.some(r => r.executed && r.effect?.spellCountered);

  return { countered, reactions };
}

// ============================================================================
// PROTOCOL WRITING
// ============================================================================

/**
 * Schreibt einen Protocol-Eintrag für die ausgeführte Aktion.
 */
function writeProtocolEntry(
  state: CombatState,
  combatant: Combatant,
  action: TurnAction,
  positionBefore: GridPosition,
  result: ActionResult
): void {
  const entry: CombatProtocolEntry = {
    round: state.roundNumber,
    combatantId: combatant.id,
    combatantName: combatant.name,
    action,
    damageDealt: result.damageDealt,
    damageReceived: result.damageReceived,
    healingDone: result.healingDone,
    positionBefore,
    positionAfter: getPosition(combatant),
    notes: result.notes,
  };

  state.protocol.push(entry);

  debug('writeProtocolEntry:', {
    round: entry.round,
    combatant: entry.combatantName,
    actionType: action.type,
    damageDealt: entry.damageDealt,
  });
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Führt eine einzelne Aktion aus und mutiert State.
 * KEINE AI-Logik - nur Ausführung.
 *
 * Budget wird aus state.currentTurnBudget gelesen und mutiert.
 * DPR wird automatisch zu state.partyDPR/enemyDPR addiert.
 * Bei 'pass': Ruft advanceTurn() auf um zum nächsten Combatant zu wechseln.
 *
 * @param combatant Der aktive Combatant
 * @param action Die auszuführende Aktion
 * @param state Combat State (wird mutiert)
 * @returns ActionResult mit Zusammenfassung
 */
export function executeAction(
  combatant: Combatant,
  action: TurnAction,
  state: CombatState
): ActionResult {
  const budget = state.currentTurnBudget;
  const positionBefore = { ...getPosition(combatant) };
  let damageDealt = 0;
  let damageReceived = 0;
  const healingDone = 0;  // TODO: Healing Actions implementieren
  const notes: string[] = [];

  // Budget-Map für Reactions (alle Combatants starten mit Reaction)
  const budgets = new Map<string, TurnBudget>();
  for (const c of state.combatants) {
    budgets.set(c.id, { movementCells: 0, baseMovementCells: 0, hasAction: false, hasDashed: false, hasBonusAction: false, hasReaction: true });
  }

  switch (action.type) {
    case 'action': {
      // 1. Movement zu fromPosition (wenn unterschiedlich)
      const currentPos = getPosition(combatant);
      if (action.fromPosition.x !== currentPos.x ||
          action.fromPosition.y !== currentPos.y ||
          action.fromPosition.z !== currentPos.z) {
        const moveCost = getDistance(currentPos, action.fromPosition);
        setPosition(combatant, action.fromPosition);
        budget.movementCells = Math.max(0, budget.movementCells - moveCost);
      }

      // 2. Budget konsumieren
      if (action.action.timing.type === 'bonus') {
        budget.hasBonusAction = false;
      } else {
        budget.hasAction = false;
        // Dash: Extra Movement hinzufügen
        if (action.action.effects?.some(e => e.grantMovement != null)) {
          budget.movementCells += budget.baseMovementCells;
          budget.hasDashed = true;
        }
      }

      // 3. Prüfe ob die Action ein Angriff ist
      if (action.target && action.action.damage) {
        const resolution = resolveAttackWithReactions(
          combatant,
          action.target,
          action.action,
          state,
          budgets
        );

        if (resolution) {
          damageDealt += resolution.damageDealt;

          // Damage von Reactions (Hellish Rebuke etc.) tracken
          for (const reaction of resolution.damagedReactions) {
            if (reaction.executed && reaction.effect?.damage) {
              damageReceived += reaction.effect.damage;
              notes.push(`${reaction.reactor.name} reagiert mit ${reaction.reaction?.name}`);
            }
          }

          // Kill-Note hinzufügen
          if (resolution.newDeathProbability > 0.95) {
            notes.push(`${action.target.name} besiegt`);
          }
        }
      }
      break;
    }

    case 'pass':
      // Turn beenden - zum nächsten Combatant wechseln
      advanceTurn(state);
      break;
  }

  // ZENTRAL: Nach jeder Action tote Combatants markieren
  markDeadCombatants(state);

  // DPR-Tracking: Party vs Enemies
  const groupId = combatant.combatState.groupId;
  const isPartyAlly = groupId === 'party' || (state.alliances['party']?.includes(groupId) ?? false);
  if (isPartyAlly) {
    state.partyDPR += damageDealt;
  } else {
    state.enemyDPR += damageDealt;
  }

  const result: ActionResult = {
    damageDealt,
    damageReceived,
    healingDone,
    notes,
  };

  // Protocol-Eintrag schreiben
  writeProtocolEntry(state, combatant, action, positionBefore, result);

  return result;
}
