// Ziel: Unified Action Scoring - alle Aktionstypen durch eine Pipeline
// Siehe: docs/services/combatantAI/actionScoring.md
//
// Score = Summe aller Effekte einer Action (alle auf DPR-Skala):
// - scoreDamageComponent() = hitChance × expectedDamage
// - scoreHealingComponent() = allyDPR × survivalRoundsGained
// - scoreEffect() für jeden Effect:
//   - Condition: targetDPR × duration × successProb
//   - StatModifier: DPR-Äquivalent des Buffs/Debuffs
//   - RollModifier: Advantage/Disadvantage Wert
// - scoreTriggerResponse() für Reactions auf eingehende Angriffe
// - scoreCounterComponent() für Counterspell
//
// Pipeline-Position:
// - Aufgerufen von: turnExecution.expandAndPrune(), combatantAI, combatTracking
// - Nutzt: situationalModifiers.evaluateSituationalModifiers()
// - Output: number (DPR-normalized Score)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Condition Duration als statische Lookup-Tabelle
// - CONDITION_DURATION nutzt feste Werte statt action.effects[].duration
// - Ideal: Duration aus Action-Effect extrahieren, Lookup nur als Fallback
//
// [HACK]: Incoming DPR gleichmaessig auf Allies verteilt
// - calculateIncomingDPR() teilt totalEnemyDPR / allyCount
// - Ideal: Feindliche Target-Praeferenzen beruecksichtigen
//
// [HACK]: Contested Checks als 50% Erfolgswahrscheinlichkeit
// - Ideal: Skill-Modifier aus CombatProfile nutzen
//
// [HACK]: Opportunity Cost mit statischen Wahrscheinlichkeiten
// - estimateExpectedReactionValue() nutzt 20% OA, 50% Shield, 30% Counterspell
// - Ideal: Positionsbasierte Wahrscheinlichkeiten berechnen
//
// [TODO]: AoE Target-Set Berechnung
// [TODO]: Multi-Target Healing/Buff Scoring
// [TODO]: Friendly Fire Scoring

import type { Action, ActionEffect } from '@/types/entities';
import type {
  Combatant,
  CombatantSimulationState,
  ActionIntent,
  ActionTargetScore,
  ReactionContext,
  TurnBudget,
} from '@/types/combat';
import type { TriggerEvent } from '@/constants/action';
import {
  getHP,
  getAC,
  getActions,
  getGroupId,
  getPosition,
  getConditions,
} from '../../combatTracking';
import {
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  feetToCell,
} from '@/utils';
import {
  resolveMultiattackRefs,
  getDistance,
  isAllied,
  calculateHitChance,
  calculateMultiattackDamage,
} from '../helpers/combatHelpers';
import {
  evaluateSituationalModifiers,
  type ModifierContext,
  type CombatantContext,
  type SituationalModifiers,
} from '../situationalModifiers';
// Note: Core modifiers are registered in combatantAI/index.ts to avoid circular dependencies

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[actionScoring]', ...args);
  }
};

// ============================================================================
// CONDITION DURATION LOOKUP
// ============================================================================

/** Erwartete Dauer von Conditions in Runden (fuer Control-Scoring). HACK: siehe Header */
export const CONDITION_DURATION: Record<string, number> = {
  paralyzed: 2.5,    // Wiederholter Save am Ende jeder Runde
  stunned: 1.5,      // Oft nur bis Ende naechster Runde
  frightened: 3,     // Distanz-abhaengig
  restrained: 2.5,   // Wiederholter Save oder Aktion zum Befreien
  prone: 0.5,        // Aufstehen kostet halbes Movement
  incapacitated: 2,  // Generisch
  blinded: 2,
  charmed: 3,
  deafened: 1,
  grappled: 2,
  poisoned: 3,
  petrified: 5,      // Sehr lang
  unconscious: 2,
};

/** Default Duration wenn Condition nicht in Lookup. */
export const DEFAULT_CONDITION_DURATION = 1.5;

/**
 * Threshold für Reaction-Entscheidung.
 * Reaction wird genutzt wenn: reactionValue > opportunityCost × REACTION_THRESHOLD
 */
export const REACTION_THRESHOLD = 0.6;

// Import fuer lokale Nutzung
import {
  calculateEffectiveDamagePotential,
  calculateDamagePotential,
  calculateSaveFailChance,
} from '../helpers/combatHelpers';

/**
 * Berechnet erwarteten eingehenden DPR fuer einen Ally. HACK: siehe Header
 * Fuer Healing-Score: survivalRoundsGained = healAmount / incomingDPR
 */
export function calculateIncomingDPR(ally: Combatant, state: CombatantSimulationState): number {
  const enemies = getEnemies(ally, state);
  if (enemies.length === 0) return 1; // Minimum um Division durch 0 zu vermeiden

  // Summe aller feindlichen DPR gegen diese AC
  const allyAC = getAC(ally);
  let totalEnemyDPR = 0;
  for (const enemy of enemies) {
    totalEnemyDPR += calculateEffectiveDamagePotential(getActions(enemy), allyAC);
  }

  // Verteile auf alle Allies (vereinfacht: gleichmaessig)
  const allies = state.combatants.filter(c =>
    isAllied(getGroupId(ally), getGroupId(c), state.alliances)
  );
  const allyCount = Math.max(1, allies.length);

  return totalEnemyDPR / allyCount;
}

// ============================================================================
// CONCENTRATION MANAGEMENT
// ============================================================================

/**
 * Prueft ob eine Action Concentration erfordert.
 */
export function isConcentrationSpell(action: Action): boolean {
  return action.concentration === true;
}

/** Heuristik: Verbleibende Duration als Anteil der Original-Duration. HACK: siehe Header */
const REMAINING_DURATION_FACTOR = 0.5;

/**
 * Schaetzt verbleibenden Wert eines aktiven Concentration-Spells.
 * Basiert auf: erwartete verbleibende Runden x DPR-Effekt pro Runde.
 * HACK: Mehrere Vereinfachungen - siehe Header (Concentration Target, Buff Multiplier, Healing).
 *
 * Formel: remainingDuration x perRoundValue
 *
 * Die Funktion erkennt den Spell-Intent und berechnet den per-round Value:
 * - Control: targetDPR x successProb (Schaden pro Runde verhindert)
 * - Buff Offensive: allyDPR x offensiveMultiplier (extra DPR pro Runde)
 * - Buff Defensive: allyDPR x defensiveMultiplier (geschuetzter DPR pro Runde)
 * - Damage over Time: baseDamage x successProb (Schaden pro Runde)
 *
 * @param spell Der aktive Concentration-Spell
 * @param profile Der Caster-Profile (fuer Ally-Lookups)
 * @param state SimulationState fuer Target-Lookups
 * @returns Geschaetzter verbleibender Wert in DPR-Skala
 */
export function estimateRemainingConcentrationValue(
  spell: Action,
  combatant: Combatant,
  state: CombatantSimulationState
): number {
  const intent = getActionIntent(spell);

  // Original-Duration aus Spell extrahieren
  const durationEffect = spell.effects?.find(e => e.duration);
  const originalDuration = durationEffect?.duration?.value ?? 3;
  const remainingDuration = originalDuration * REMAINING_DURATION_FACTOR;

  let perRoundValue = 0;

  switch (intent) {
    case 'control': {
      // Control: targetDPR x successProb
      // Wir schaetzen den durchschnittlichen Target-DPR
      const enemies = getEnemies(combatant, state);
      if (enemies.length > 0) {
        const avgEnemyDPR = enemies.reduce((sum, e) =>
          sum + calculateDamagePotential(getActions(e)), 0) / enemies.length;

        // Success-Prob aus Spell-Save extrahieren (approx via typischem Target)
        let successProb = 0.5; // Default
        if (spell.save && enemies[0]) {
          successProb = calculateSaveFailChance(spell.save.dc, enemies[0], spell.save.ability);
        }

        perRoundValue = avgEnemyDPR * successProb;
      }
      break;
    }

    case 'buff': {
      // Buff: DPR-Beitrag pro Runde
      const allies = getAllies(combatant, state);
      if (allies.length > 0) {
        const avgAllyDPR = allies.reduce((sum, a) =>
          sum + calculateDamagePotential(getActions(a)), 0) / allies.length;

        // Buff-Multipliers aus Effects extrahieren
        let offensiveMultiplier = 0;
        let defensiveMultiplier = 0;

        for (const effect of spell.effects ?? []) {
          // Roll Modifiers (Advantage)
          if (effect.rollModifiers) {
            for (const mod of effect.rollModifiers) {
              if (mod.on === 'attacks' && mod.type === 'advantage') {
                offensiveMultiplier += 0.25;
              }
            }
          }

          // Stat Modifiers
          if (effect.statModifiers) {
            for (const mod of effect.statModifiers) {
              if (mod.stat === 'ac') {
                defensiveMultiplier += mod.value * 0.05;
              }
              if (mod.stat === 'attack') {
                offensiveMultiplier += mod.value * 0.05;
              }
              if (mod.dice) {
                const diceEV = getExpectedValue(diceExpressionToPMF(mod.dice));
                if (mod.stat === 'attack') {
                  offensiveMultiplier += diceEV * 0.05;
                }
              }
            }
          }
        }

        perRoundValue = avgAllyDPR * (offensiveMultiplier + defensiveMultiplier);
      }
      break;
    }

    case 'damage': {
      // Damage over Time (z.B. Moonbeam, Spirit Guardians)
      // Berechne durchschnittlichen Schaden pro Runde
      if (spell.damage) {
        const baseDamageEV = getExpectedValue(addConstant(
          diceExpressionToPMF(spell.damage.dice),
          spell.damage.modifier
        ));

        let successProb = 1.0;
        if (spell.save) {
          // Durchschnittlicher Target fuer Success-Prob
          const enemies = getEnemies(combatant, state);
          if (enemies.length > 0) {
            successProb = calculateSaveFailChance(spell.save.dc, enemies[0], spell.save.ability);
            // Half-on-save: Effektiver Schaden
            if (spell.save.onSave === 'half') {
              successProb = successProb + (1 - successProb) * 0.5;
            }
          }
        }

        perRoundValue = baseDamageEV * successProb;
      }
      break;
    }

    case 'healing': {
      // Healing-over-time ist selten Concentration, aber falls vorhanden
      if (spell.healing) {
        const baseHealEV = getExpectedValue(addConstant(
          diceExpressionToPMF(spell.healing.dice),
          spell.healing.modifier
        ));
        // Simplified: Heal-Value pro Runde als DPR-Aequivalent
        perRoundValue = baseHealEV * 0.5; // Heal ist ~50% so wertvoll wie Damage
      }
      break;
    }
  }

  const totalValue = remainingDuration * perRoundValue;

  debug('estimateRemainingConcentrationValue:', {
    spell: spell.name,
    intent,
    originalDuration,
    remainingDuration,
    perRoundValue,
    totalValue,
  });

  return totalValue;
}

// ============================================================================
// ACTION INTENT & CANDIDATES
// ============================================================================

/** Erkennt Intent einer Action: damage, healing, control, oder buff. */
export function getActionIntent(action: Action): ActionIntent {
  // Healing hat hoechste Prioritaet
  if (action.healing) return 'healing';

  // Control: Action verursacht Condition
  if (action.effects?.some(e => e.condition)) return 'control';

  // Buff: Action gewaehrt Stat/Roll-Modifikatoren oder extra Movement (ohne Damage)
  // Pruefe auf buff-spezifische Effects OHNE damage
  if (!action.damage) {
    const hasBuff = action.effects?.some(e =>
      (e.statModifiers && e.statModifiers.length > 0) ||
      (e.rollModifiers && e.rollModifiers.length > 0) ||
      e.grantMovement
    );
    if (hasBuff) return 'buff';
  }

  // Default: Damage
  return 'damage';
}

// Import fuer lokale Nutzung
import {
  getCandidates,
  getEnemies,
  getAllies,
} from '../helpers/actionSelection';

// ============================================================================
// ACTION/TARGET SCORING
// ============================================================================

/**
 * Berechnet Score für eine (Action, Target)-Kombination.
 * Summiert alle Effekte der Action (Damage, Healing, Conditions, Buffs, etc.)
 *
 * @param triggerContext Optional: Kontext für Reactions (eingehender Angriff, Spell, etc.)
 */
export function calculatePairScore(
  attacker: Combatant,
  action: Action,
  target: Combatant,
  distanceCells: number,
  state?: CombatantSimulationState,
  triggerContext?: ReactionContext
): ActionTargetScore | null {
  const attackerActions = getActions(attacker);
  const targetAC = getAC(target);

  // Range-Check
  let maxRangeFeet: number;
  if (action.multiattack) {
    const refs = resolveMultiattackRefs(action, attackerActions);
    maxRangeFeet = refs.reduce((max, ref) => {
      if (!ref.range) return max;
      return Math.max(max, ref.range.long ?? ref.range.normal);
    }, 0);
  } else {
    maxRangeFeet = action.range.long ?? action.range.normal;
  }

  const maxRangeCells = feetToCell(maxRangeFeet);
  if (distanceCells > maxRangeCells) {
    debug('calculatePairScore: out of range', { actionName: action.name, distanceCells, maxRangeCells });
    return null;
  }

  // Multiattack: Separate Logik (kombinierte PMF)
  if (action.multiattack) {
    const multiDamage = calculateMultiattackDamage(action, attackerActions, targetAC);
    if (!multiDamage) return null;
    const score = getExpectedValue(multiDamage);
    debug('calculatePairScore (multiattack):', { actionName: action.name, score });
    return { action, target, score, intent: 'damage' };
  }

  // Situational Modifiers evaluieren
  let modifiers: SituationalModifiers | undefined;
  if (state) {
    const attackerContext: CombatantContext = {
      position: getPosition(attacker),
      groupId: getGroupId(attacker),
      participantId: attacker.id,
      conditions: getConditions(attacker),
      ac: getAC(attacker),
      hp: getExpectedValue(getHP(attacker)),
    };
    const targetContext: CombatantContext = {
      position: getPosition(target),
      groupId: getGroupId(target),
      participantId: target.id,
      conditions: getConditions(target),
      ac: getAC(target),
      hp: getExpectedValue(getHP(target)),
    };
    modifiers = evaluateSituationalModifiers({
      attacker: attackerContext,
      target: targetContext,
      action,
      state: {
        profiles: state.combatants.map(c => ({
          position: getPosition(c),
          groupId: getGroupId(c),
          participantId: c.id,
          conditions: getConditions(c),
        })),
        alliances: state.alliances,
      },
    });
  }

  // ========================================
  // EFFEKT-SUMMIERUNG (statt Intent-Routing)
  // ========================================
  let score = 0;

  // 1. Damage Component
  if (action.damage) {
    score += scoreDamageComponent(action, target, modifiers);
  }

  // 2. Healing Component
  if (action.healing && state) {
    score += scoreHealingComponent(action, target, state);
  }

  // 3. Effects (Conditions, Buffs, etc.)
  for (const effect of action.effects ?? []) {
    score += scoreEffect(effect, action, target, state);
  }

  // 4. Counter (Counterspell)
  if (action.counter && triggerContext?.spellLevel !== undefined) {
    score += scoreCounterComponent(action, triggerContext);
  }

  // 5. Trigger-Response (Shield auf incoming attack)
  if (triggerContext?.action && !action.damage && hasACBuff(action)) {
    score += scoreTriggerResponse(action, triggerContext, attacker);
  }

  // 6. Concentration-Switch-Kosten
  if (state && isConcentrationSpell(action)) {
    score -= getConcentrationSwitchCost(attacker, state);
  }

  if (score === 0) {
    debug('calculatePairScore: zero score', { actionName: action.name });
    return null;
  }

  const intent = getActionIntent(action);  // Für Logging/Metadata
  debug('calculatePairScore:', { actionName: action.name, intent, score });

  return { action, target, score, intent };
}

// ============================================================================
// SCORE COMPONENTS
// ============================================================================

/** Damage-Score: hitChance × expectedDamage oder saveFailChance × damage */
function scoreDamageComponent(
  action: Action,
  target: Combatant,
  modifiers?: SituationalModifiers
): number {
  if (!action.damage) return 0;

  const baseDamageEV = getExpectedValue(addConstant(
    diceExpressionToPMF(action.damage.dice),
    action.damage.modifier
  ));

  // Attack Roll
  if (action.attack) {
    let hitChance = calculateHitChance(action.attack.bonus, getAC(target));
    if (modifiers) {
      hitChance += modifiers.effectiveAttackMod * 0.05;
      hitChance = Math.max(0.05, Math.min(0.95, hitChance));
    }
    return baseDamageEV * hitChance;
  }

  // Save-based
  if (action.save) {
    const saveFailChance = calculateSaveFailChance(action.save.dc, target, action.save.ability);
    // Half-on-save
    if (action.save.onSave === 'half') {
      return baseDamageEV * saveFailChance + (baseDamageEV * 0.5) * (1 - saveFailChance);
    }
    return baseDamageEV * saveFailChance;
  }

  // Auto-hit
  return baseDamageEV;
}

/** Healing-Score: allyDPR × survivalRoundsGained */
function scoreHealingComponent(
  action: Action,
  target: Combatant,
  state: CombatantSimulationState
): number {
  if (!action.healing) return 0;

  const healEV = getExpectedValue(addConstant(
    diceExpressionToPMF(action.healing.dice),
    action.healing.modifier
  ));
  const allyDPR = calculateDamagePotential(getActions(target));
  const incomingDPR = calculateIncomingDPR(target, state);
  const survivalRoundsGained = healEV / Math.max(1, incomingDPR);

  return allyDPR * survivalRoundsGained;
}

/** Effect-Score: Summiert Condition, StatModifier, RollModifier Scores */
function scoreEffect(
  effect: ActionEffect,
  action: Action,
  target: Combatant,
  state?: CombatantSimulationState
): number {
  let score = 0;

  // Condition (Control)
  if (effect.condition) {
    const duration = effect.duration?.value
      ?? CONDITION_DURATION[effect.condition]
      ?? DEFAULT_CONDITION_DURATION;
    const targetDPR = calculateDamagePotential(getActions(target));
    const successProb = getSuccessProb(action, target);
    score += targetDPR * duration * successProb;
  }

  // Stat Modifiers (Buffs)
  if (effect.statModifiers) {
    for (const mod of effect.statModifiers) {
      score += scoreStatModifier(mod, target, effect.duration?.value ?? 3, state);
    }
  }

  // Roll Modifiers (Advantage/Disadvantage)
  if (effect.rollModifiers) {
    for (const mod of effect.rollModifiers) {
      score += scoreRollModifier(mod, target, effect.duration?.value ?? 3);
    }
  }

  return score;
}

/** StatModifier-Score: AC/Attack/Damage Buffs → DPR-Äquivalent */
function scoreStatModifier(
  mod: { stat: string; value: number; dice?: string },
  target: Combatant,
  duration: number,
  _state?: CombatantSimulationState
): number {
  const allyDPR = calculateDamagePotential(getActions(target));
  let value = mod.value;
  if (mod.dice) {
    value += getExpectedValue(diceExpressionToPMF(mod.dice));
  }

  switch (mod.stat) {
    case 'ac':
      return allyDPR * (value * 0.05) * duration;  // +1 AC = -5% hit
    case 'attack':
      return allyDPR * (value * 0.05) * duration;  // +1 attack = +5% hit
    case 'damage':
      return value * duration;  // Direct damage bonus
    default:
      return 0;
  }
}

/** RollModifier-Score: Advantage/Disadvantage → ~25% DPR-Änderung */
function scoreRollModifier(
  mod: { on: string; type: string },
  target: Combatant,
  duration: number
): number {
  const allyDPR = calculateDamagePotential(getActions(target));

  if (mod.on === 'attacks' && mod.type === 'advantage') {
    return allyDPR * 0.25 * duration;
  }
  if (mod.on === 'attacks' && mod.type === 'disadvantage') {
    return allyDPR * 0.25 * duration;  // Gegen Feind = positiv
  }
  return 0;
}

/** Counter-Score (Counterspell): spellValue × successProb */
function scoreCounterComponent(
  action: Action,
  triggerContext: ReactionContext
): number {
  const targetSpellLevel = triggerContext.spellLevel ?? 1;
  const counterspellLevel = action.spellSlot?.level ?? 3;

  // Spell-Value schätzen (vereinfacht: 8 DPR pro Level)
  const spellValue = targetSpellLevel * 8;

  // Success-Prob
  let successProb = 1.0;
  if (counterspellLevel < targetSpellLevel) {
    const dc = 10 + targetSpellLevel;
    const spellcastingMod = 4;  // Approximation
    successProb = Math.min(0.95, Math.max(0.05, (20 - dc + spellcastingMod + 1) / 20));
  }

  return spellValue * successProb;
}

/** Trigger-Response-Score (Shield): hitChanceReduction × incomingDamage */
function scoreTriggerResponse(
  action: Action,
  triggerContext: ReactionContext,
  defender: Combatant
): number {
  return calculateShieldScore(
    action,
    triggerContext.action?.attack?.bonus ?? 5,
    getAC(defender),
    triggerContext.action?.damage
  );
}

/** Success-Probability für eine Action (Attack, Save, Contested, AutoHit) */
function getSuccessProb(action: Action, target: Combatant): number {
  if (action.save) {
    return calculateSaveFailChance(action.save.dc, target, action.save.ability);
  }
  if (action.contested) {
    return 0.5;  // HACK: siehe Header
  }
  if (action.autoHit) {
    return 1.0;
  }
  if (action.attack) {
    return calculateHitChance(action.attack.bonus, getAC(target));
  }
  return 0.5;
}

/** Prüft ob Action einen AC-Buff hat (für Shield-Detection) */
function hasACBuff(action: Action): boolean {
  return action.effects?.some(e =>
    e.statModifiers?.some(m => m.stat === 'ac')
  ) ?? false;
}

/**
 * Berechnet Shield-Score für AC-Buff Reactions.
 * Shared Helper für scoreTriggerResponse() und evaluateShieldReaction().
 *
 * Score = hitChanceReduction × expectedDamage
 */
function calculateShieldScore(
  action: Action,
  attackBonus: number,
  defenderAC: number,
  incomingDamage: { dice: string; modifier: number } | undefined
): number {
  const acBonus = action.effects?.reduce((total, effect) => {
    const acMod = effect.statModifiers?.find(m => m.stat === 'ac');
    return total + (acMod?.value ?? 0);
  }, 0) ?? 0;

  if (acBonus <= 0) return 0;

  const currentHitChance = calculateHitChance(attackBonus, defenderAC);
  const shieldedHitChance = calculateHitChance(attackBonus, defenderAC + acBonus);
  const hitChanceReduction = currentHitChance - shieldedHitChance;

  let expectedDamage = 10;
  if (incomingDamage) {
    const damagePMF = diceExpressionToPMF(incomingDamage.dice);
    expectedDamage = getExpectedValue(addConstant(damagePMF, incomingDamage.modifier));
  }

  return hitChanceReduction * expectedDamage;
}

/** Concentration-Switch-Kosten berechnen */
function getConcentrationSwitchCost(
  attacker: Combatant,
  state: CombatantSimulationState
): number {
  const concentratingOnId = attacker.combatState.concentratingOn;
  if (!concentratingOnId) return 0;

  const currentActions = getActions(attacker);
  const concentratingOnAction = currentActions.find(a => a.id === concentratingOnId);
  if (!concentratingOnAction) return 0;

  return estimateRemainingConcentrationValue(concentratingOnAction, attacker, state);
}

/**
 * Waehlt beste (Action, Target)-Kombination basierend auf EV-Score.
 * Standalone aufrufbar fuer Encounter-Runner: "Was soll diese Kreatur tun?"
 */
export function selectBestActionAndTarget(
  attacker: Combatant,
  state: CombatantSimulationState
): ActionTargetScore | null {
  const scores: ActionTargetScore[] = [];
  const attackerActions = getActions(attacker);
  const attackerPos = getPosition(attacker);

  for (const action of attackerActions) {
    const candidates = getCandidates(attacker, state, action);

    for (const target of candidates) {
      const distance = getDistance(attackerPos, getPosition(target));
      const pairScore = calculatePairScore(attacker, action, target, distance, state);
      if (pairScore) scores.push(pairScore);
    }
  }

  if (scores.length === 0) {
    debug('selectBestActionAndTarget: no valid actions for', attacker.id);
    return null;
  }

  // Beste Kombination nach Score
  const best = scores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  debug('selectBestActionAndTarget:', {
    attacker: attacker.id,
    bestAction: best.action.name,
    bestTarget: best.target.id,
    bestScore: best.score,
    intent: best.intent,
  });

  return best;
}

/**
 * Berechnet maximale Angriffsreichweite eines Combatants (in Cells).
 */
export function getMaxAttackRange(combatant: Combatant): number {
  let maxRange = 0;
  const actions = getActions(combatant);

  const updateMaxRange = (act: Action) => {
    if (act.damage && act.range) {
      const rangeFeet = act.range.long ?? act.range.normal;
      maxRange = Math.max(maxRange, feetToCell(rangeFeet));
    }
  };

  for (const action of actions) {
    if (action.multiattack) {
      // Multiattack: Max-Range aus Refs
      const refs = resolveMultiattackRefs(action, actions);
      refs.forEach(updateMaxRange);
    } else {
      updateMaxRange(action);
    }
  }
  return maxRange || 1;  // Default: Melee (1 Cell = 5ft)
}

// ============================================================================
// REACTION HELPERS
// ============================================================================

/**
 * Filtert verfügbare Reactions aus den Actions eines Combatants.
 */
export function getAvailableReactions(combatant: Combatant): Action[] {
  return getActions(combatant).filter(a => a.timing.type === 'reaction');
}

/**
 * Prüft ob eine Reaction für ein bestimmtes Trigger-Event relevant ist.
 */
export function matchesTrigger(reaction: Action, event: TriggerEvent): boolean {
  // Explizites triggerCondition hat Vorrang
  if (reaction.timing.triggerCondition?.event) {
    return reaction.timing.triggerCondition.event === event;
  }

  // Fallback-Heuristiken
  switch (event) {
    case 'leaves-reach':
      return reaction.actionType === 'melee-weapon' || reaction.actionType === 'melee-spell';
    case 'spell-cast':
      return reaction.counter !== undefined;
    case 'attacked':
      return !reaction.damage && reaction.effects?.some(e =>
        e.statModifiers?.some(m => m.stat === 'ac')
      ) === true;
    case 'damaged':
      return reaction.damage !== undefined && !reaction.attack;
    default:
      return false;
  }
}

/**
 * Findet alle passenden Reactions für ein Event.
 */
export function findMatchingReactions(
  combatant: Combatant,
  event: TriggerEvent
): Action[] {
  return getAvailableReactions(combatant).filter(r => matchesTrigger(r, event));
}

/**
 * Schätzt erwarteten Wert zukünftiger Reactions (Opportunity Cost).
 */
export function estimateExpectedReactionValue(
  combatant: Combatant,
  state: CombatantSimulationState
): number {
  const reactions = getAvailableReactions(combatant);
  if (reactions.length === 0) return 0;

  let expectedValue = 0;

  // OA-Potential
  const hasOAReaction = reactions.some(r =>
    r.actionType === 'melee-weapon' || r.actionType === 'melee-spell'
  );
  if (hasOAReaction) {
    const oaChance = 0.2;  // HACK: siehe Header
    const avgOADamage = calculateDamagePotential(reactions.filter(r =>
      r.actionType === 'melee-weapon' || r.actionType === 'melee-spell'
    ));
    expectedValue += oaChance * avgOADamage;
  }

  // Shield-Potential
  const hasShieldReaction = reactions.some(r =>
    r.effects?.some(e => e.statModifiers?.some(m => m.stat === 'ac'))
  );
  if (hasShieldReaction) {
    const shieldChance = 0.5;  // HACK: siehe Header
    const avgIncomingDamage = calculateIncomingDPR(combatant, state);
    const acBonus = 5;
    const hitReduction = acBonus * 0.05;
    expectedValue += shieldChance * avgIncomingDamage * hitReduction;
  }

  // Counterspell-Potential
  const hasCounterspell = reactions.some(r => r.counter !== undefined);
  if (hasCounterspell) {
    const counterspellChance = 0.3;  // HACK: siehe Header
    const avgSpellValue = 15;
    expectedValue += counterspellChance * avgSpellValue;
  }

  return expectedValue;
}

/**
 * Entscheidet ob eine Action genutzt werden soll (inkl. Opportunity Cost für Reactions).
 */
export function shouldUseAction(
  score: number,
  action: Action,
  actor: Combatant,
  state: CombatantSimulationState,
  budget?: TurnBudget
): boolean {
  // Keine Reaction verfügbar
  if (action.timing.type === 'reaction' && budget && !budget.hasReaction) {
    return false;
  }

  // Reactions: Opportunity Cost berücksichtigen
  if (action.timing.type === 'reaction') {
    const opportunityCost = estimateExpectedReactionValue(actor, state);
    return score > opportunityCost * REACTION_THRESHOLD;
  }

  // Standard/Bonus Actions: Jeder positive Score ist gut
  return score > 0;
}

// ============================================================================
// REACTION EVALUATION (für Combat Tracking)
// ============================================================================

/**
 * Bewertet eine Reaction gegen einen Trigger-Kontext.
 * Nutzt unterschiedliche Scoring-Logik basierend auf dem Reaction-Typ.
 *
 * @returns Score in DPR-Skala (vergleichbar mit anderen Action-Scores)
 */
export function evaluateReaction(
  reaction: Action,
  context: ReactionContext,
  combatant: Combatant,
  state: CombatantSimulationState
): number {
  const event = context.event;

  debug('evaluateReaction:', {
    reaction: reaction.name,
    event,
    source: context.source.id,
    target: context.target?.id,
  });

  // Opportunity Attack: Melee-Damage gegen fliehenden Feind
  if (event === 'leaves-reach') {
    const pairScore = calculatePairScore(combatant, reaction, context.source, 1, state);
    return pairScore?.score ?? 0;
  }

  // Shield: AC-Boost gegen eingehenden Angriff
  if (event === 'attacked') {
    return evaluateShieldReaction(reaction, context, combatant);
  }

  // Counterspell: Spell aufheben
  if (event === 'spell-cast') {
    return evaluateCounterspellReaction(reaction, context, combatant, state);
  }

  // Hellish Rebuke / Absorb Elements: Damage als Response
  if (event === 'damaged') {
    return evaluateDamagedReaction(reaction, context, combatant);
  }

  // Unbekanntes Event - Fallback auf allgemeine Damage-Bewertung
  if (reaction.damage) {
    const pairScore = calculatePairScore(combatant, reaction, context.source, 1, state);
    return pairScore?.score ?? 0;
  }

  return 0;
}

/**
 * Bewertet Shield-artige Reactions (AC-Boost).
 */
function evaluateShieldReaction(
  reaction: Action,
  context: ReactionContext,
  combatant: Combatant
): number {
  return calculateShieldScore(
    reaction,
    context.action?.attack?.bonus ?? 5,
    getAC(combatant),
    context.action?.damage
  );
}

/**
 * Bewertet Counterspell Reaction.
 */
function evaluateCounterspellReaction(
  reaction: Action,
  context: ReactionContext,
  _combatant: Combatant,
  state: CombatantSimulationState
): number {
  const targetSpellLevel = context.spellLevel ?? 1;
  const counterspellLevel = reaction.spellSlot?.level ?? 3;

  // Spell-Value schätzen
  const spellValue = estimateSpellValue(context.action, context.source, state);

  let successProb = 1.0;
  if (counterspellLevel < targetSpellLevel) {
    const dc = 10 + targetSpellLevel;
    const spellcastingMod = 4;  // HACK: Approximation
    successProb = Math.min(0.95, Math.max(0.05, (20 - dc + spellcastingMod + 1) / 20));
  }

  return spellValue * successProb;
}

/**
 * Bewertet Reactions auf 'damaged' Event (Hellish Rebuke, Absorb Elements).
 */
function evaluateDamagedReaction(
  reaction: Action,
  context: ReactionContext,
  _combatant: Combatant
): number {
  if (reaction.damage) {
    const damagePMF = diceExpressionToPMF(reaction.damage.dice);
    let baseDamage = getExpectedValue(addConstant(damagePMF, reaction.damage.modifier));

    if (reaction.save) {
      const saveFailChance = calculateSaveFailChance(
        reaction.save.dc,
        context.source,
        reaction.save.ability
      );
      if (reaction.save.onSave === 'half') {
        baseDamage = baseDamage * saveFailChance + (baseDamage * 0.5) * (1 - saveFailChance);
      } else {
        baseDamage = baseDamage * saveFailChance;
      }
    }

    return baseDamage;
  }

  // Absorb Elements: Resistance + extra Damage (vereinfacht)
  if (context.damage && context.damage > 0) {
    return context.damage * 0.5;
  }

  return 0;
}

/**
 * Schätzt den Wert eines Spells für Counterspell-Bewertung.
 */
function estimateSpellValue(
  spell: Action | undefined,
  caster: Combatant,
  state: CombatantSimulationState
): number {
  if (!spell) return 10;

  const intent = getActionIntent(spell);

  switch (intent) {
    case 'damage': {
      if (!spell.damage) return 10;
      const damagePMF = diceExpressionToPMF(spell.damage.dice);
      const baseDamage = getExpectedValue(addConstant(damagePMF, spell.damage.modifier));
      const targetCount = spell.targeting.type === 'area' ? 3 : 1;
      return baseDamage * targetCount;
    }

    case 'control': {
      const enemies = getEnemies(caster, state);
      if (enemies.length === 0) return 15;

      const avgEnemyDPR = enemies.reduce((sum, e) =>
        sum + calculateDamagePotential(getActions(e)), 0) / enemies.length;
      const duration = spell.effects?.[0]?.duration?.value ?? 3;

      return avgEnemyDPR * duration * 0.5;
    }

    case 'buff': {
      const spellLevel = spell.spellSlot?.level ?? 1;
      return spellLevel * 8;  // HACK: Heuristik
    }

    case 'healing': {
      if (!spell.healing) return 10;
      const healPMF = diceExpressionToPMF(spell.healing.dice);
      return getExpectedValue(addConstant(healPMF, spell.healing.modifier)) * 0.5;
    }

    default:
      return 10;
  }
}

/**
 * Entscheidet ob eine Reaction genutzt werden soll.
 *
 * Formel: reactionValue > opportunityCost × REACTION_THRESHOLD
 */
export function shouldUseReaction(
  reaction: Action,
  context: ReactionContext,
  combatant: Combatant,
  state: CombatantSimulationState,
  budget?: TurnBudget
): boolean {
  if (budget && !budget.hasReaction) {
    debug('shouldUseReaction: no reaction available');
    return false;
  }

  const reactionValue = evaluateReaction(reaction, context, combatant, state);
  const opportunityCost = estimateExpectedReactionValue(combatant, state);

  const threshold = opportunityCost * REACTION_THRESHOLD;
  const shouldUse = reactionValue > threshold;

  debug('shouldUseReaction:', {
    reaction: reaction.name,
    reactionValue,
    opportunityCost,
    threshold,
    shouldUse,
  });

  return shouldUse;
}

