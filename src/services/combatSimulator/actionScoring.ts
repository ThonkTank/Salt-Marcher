// Ziel: DPR-basierte Bewertungslogik fuer Combat-Aktionen
// Siehe: docs/services/combatSimulator/actionScoring.md
//
// Score-Komponenten (alle auf DPR-Skala):
// - damageComponent = hitChance x expectedDamage
// - controlComponent = enemyDPR x duration x successProb
// - healingComponent = allyDPR x survivalRoundsGained
// - buffComponent = (offensive: extraDPR) | (defensive: DPR secured)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Save-Bonus Schaetzung via HP statt CR
// - getTypicalSaveBonus() nutzt HP als Proxy fuer CR, da CombatProfile kein CR-Feld hat
// - Formel: CR ~= HP-basierte Schaetzung, dann Save-Bonus = CR/3 + 2
// - Ideal: Creature-Schema um CR erweitern, in CombatProfile uebernehmen
//
// [HACK]: Condition Duration als statische Lookup-Tabelle
// - CONDITION_DURATION nutzt feste Werte statt action.effects[].duration
// - Viele Conditions haben variable Duration (z.B. "until save" vs "3 rounds")
// - Ideal: Duration aus Action-Effect extrahieren, Lookup nur als Fallback
//
// [HACK]: Incoming DPR gleichmaessig auf Allies verteilt
// - estimateIncomingDPR() teilt totalEnemyDPR / allyCount
// - Ignoriert Threat-Assessment (Tank vs Squishy) und Positioning
// - Ideal: Feindliche Target-Praeferenzen beruecksichtigen
//
// [HACK]: Contested Checks als 50% Erfolgswahrscheinlichkeit
// - extractBaseControlValues() setzt baseSuccessProb = 0.5 fuer contested
// - Ignoriert Skill-Boni und Ability-Scores beider Seiten
// - Ideal: Skill-Modifier aus CombatProfile nutzen
//
// [HACK]: grantMovement als Extra-Action interpretiert
// - extractBaseBuffValues() setzt baseExtraActions += 1 bei grantMovement
// - grantMovement kann auch nur Dash sein, nicht Extra Attack (Haste)
// - Ideal: Zwischen Dash-Bonus und echtem Extra-Action unterscheiden
//
// [HACK]: Combatant-Value mit hardcodierten Gewichtungsfaktoren
// - estimateCombatantValue() nutzt dmg + heal*0.5 + controlDC*0.7
// - Faktoren sind heuristisch, nicht validiert
// - Ideal: Gewichtung basierend auf Combat-Outcome-Analyse kalibrieren
//
// [HACK]: Concentration Remaining Duration als 50% Heuristik
// - REMAINING_DURATION_FACTOR = 0.5 statt actual tracking
// - Verbleibende Duration muesste im State getrackt werden
// - Ideal: Concentration-Start-Round speichern, echte Remaining berechnen
//
// [HACK]: Concentration Target nicht getrackt
// - estimateRemainingConcentrationValue() nutzt Durchschnitts-DPR aller Feinde/Allies
// - Wenn Hold Person auf Goblin A aktiv ist und Goblin A stirbt, Score bleibt gleich
// - Ideal: concentratingOn erweitern um target(s) Array, dann spezifische DPR nutzen
//
// [HACK]: Buff Multiplier Extraktion dupliziert in estimateRemainingConcentrationValue()
// - Inline-Extraktion von offensive/defensive Multipliers
// - Gleiche Logik existiert in extractBaseBuffValues()
// - Ideal: Shared Helper fuer Buff-Multiplier Extraktion oder Cache-Values wiederverwenden
//
// [HACK]: Healing Concentration mit hardcodiertem 0.5 Faktor
// - estimateRemainingConcentrationValue() nutzt healEV * 0.5 fuer per-round value
// - Ignoriert allyDPR und incomingDPR Verhaeltnis
// - Ideal: Konsistente Formel wie bei calculateHealingComponent()
//
// [TODO]: Implementiere AoE Target-Set Berechnung
// - Spec: evaluateAoEAction() mit getEnemiesInAoE()
// - Aktuell: Nur Single-Target Scoring implementiert
// - Betrifft: Fireball, Breath Weapons, etc.
//
// [TODO]: Implementiere Multi-Target Healing/Buff Scoring
// - Spec: "Mass Cure Wounds" sollte mehrere Allies scoren
// - Aktuell: Nur Single-Target bewertet
// - Betrifft: targeting.type = 'multiple' bei healing/buff
//
// [TODO]: Implementiere Friendly Fire Scoring fuer AoE
// - Spec: aoeScore = sum(enemyDamage) - sum(allyDamage)
// - Aktuell: Nicht implementiert
// - Betrifft: targeting.friendlyFire = true
//
// --- Phase 6: Reaction System ---
//
// [HACK]: Reaction Trigger-Matching via Fallback-Heuristiken
// - matchesTrigger() nutzt Action-Eigenschaften wenn kein triggerCondition
// - Melee → leaves-reach, counter → spell-cast, AC-Buff → attacked
// - Ideal: Alle Reactions mit explizitem triggerCondition.event definieren
//
// [HACK]: Counterspell Spellcasting-Modifier hardcoded
// - evaluateCounterspellReaction() nutzt spellcastingMod = 4
// - CombatProfile hat keinen Spellcasting-Modifier
// - Ideal: spellcastingAbility + proficiency aus Profile extrahieren
//
// [HACK]: Opportunity Cost mit statischen Wahrscheinlichkeiten
// - estimateExpectedReactionValue() nutzt 20% OA, 50% Shield, 30% Counterspell
// - Ignoriert tatsaechliche Feind-Positionen und Spell-Caster
// - Ideal: Positionsbasierte Wahrscheinlichkeiten berechnen
//
// [HACK]: Spell-Value Schaetzung mit Heuristiken
// - estimateSpellValue() nutzt spellLevel * 8 fuer Buffs
// - Faktoren sind nicht validiert
// - Ideal: Buff-Effekte analysieren wie bei calculateBuffComponent()
//
// [TODO]: Absorb Elements Extra-Damage Tracking
// - evaluateDamagedReaction() berechnet nur Resistance-Value
// - Extra Melee-Damage auf naechstem Angriff nicht getrackt
// - Benoetigt: State-Tracking fuer "next melee attack" Bonus
//

import type { Action } from '@/types/entities';
import type {
  CombatProfile,
  SimulationState,
  ActionIntent,
  ActionTargetScore,
  ActionBaseValues,
  TurnBudget,
} from '@/types/combat';
import type { TriggerEvent } from '@/constants/action';
import {
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  feetToCell,
} from '@/utils';
import {
  resolveMultiattackRefs,
  getActionMaxRangeCells,
  getDistance,
  isAllied,
  isHostile,
  calculateHitChance,
  calculateMultiattackDamage,
} from './combatHelpers';
import {
  evaluateSituationalModifiers,
  type ModifierContext,
  type CombatantContext,
  type SituationalModifiers,
} from './situationalModifiers';
import {
  getBaseValuesCacheKey,
  getCachedBaseValues,
  setCachedBaseValues,
} from './baseValuesCache';

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

// ============================================================================
// SAVE & DPR ESTIMATION HELPERS
// ============================================================================

/**
 * Schaetzt typischen Save-Bonus basierend auf CR/Level. HACK: siehe Header
 * Verwendet fuer Save-DC Erfolgswahrscheinlichkeit.
 *
 * CR-Tabelle (DMG-approximiert):
 * CR 0-4:  +2 bis +4
 * CR 5-10: +4 bis +7
 * CR 11-16: +7 bis +10
 * CR 17+: +10 bis +14
 */
export function getTypicalSaveBonus(target: CombatProfile, ability: string): number {
  // Approximation: HP als Proxy fuer CR
  // Hoehere HP = hoeherer CR = hoeherer Save
  const targetHp = getExpectedValue(target.hp);

  // CR-Schaetzung basierend auf HP (grob)
  let estimatedCR: number;
  if (targetHp <= 30) estimatedCR = 2;
  else if (targetHp <= 70) estimatedCR = 5;
  else if (targetHp <= 120) estimatedCR = 10;
  else if (targetHp <= 200) estimatedCR = 15;
  else estimatedCR = 20;

  // Save-Bonus aus CR ableiten (vereinfacht)
  // Typischer Save-Bonus = CR/3 + 2
  const baseBonus = Math.floor(estimatedCR / 3) + 2;

  // Ability-spezifische Adjustierung (optional)
  // DEX/CON/WIS sind typischerweise hoeher bei Monstern
  const goodSaves = ['dex', 'con', 'wis'];
  const abilityLower = ability.toLowerCase();
  const isGoodSave = goodSaves.some(s => abilityLower.includes(s));

  return isGoodSave ? baseBonus + 2 : baseBonus;
}

/**
 * Berechnet Wahrscheinlichkeit dass ein Save fehlschlaegt.
 * Formel: (DC - saveBonus - 1) / 20, geclampt auf [0.05, 0.95]
 */
export function calculateSaveFailChance(dc: number, target: CombatProfile, ability: string): number {
  const saveBonus = getTypicalSaveBonus(target, ability);
  const failChance = (dc - saveBonus - 1) / 20;
  // Clamp: Min 5% Erfolg, Max 95% Erfolg (Nat 1/20 Regeln)
  return Math.max(0.05, Math.min(0.95, failChance));
}

/**
 * Schaetzt erwarteten eingehenden DPR fuer einen Ally. HACK: siehe Header
 * Fuer Healing-Score: survivalRoundsGained = healAmount / incomingDPR
 */
export function estimateIncomingDPR(ally: CombatProfile, state: SimulationState): number {
  const enemies = getCandidates(ally, state, 'damage');
  if (enemies.length === 0) return 1; // Minimum um Division durch 0 zu vermeiden

  // Summe aller feindlichen DPR gegen diese AC
  let totalEnemyDPR = 0;
  for (const enemy of enemies) {
    totalEnemyDPR += estimateEffectiveDamagePotential(enemy.actions, ally.ac);
  }

  // Verteile auf alle Allies (vereinfacht: gleichmaessig)
  const allies = state.profiles.filter(p =>
    isAllied(ally.groupId, p.groupId, state.alliances)
  );
  const allyCount = Math.max(1, allies.length);

  return totalEnemyDPR / allyCount;
}

// ============================================================================
// POTENTIAL ESTIMATION
// ============================================================================

/** Schaetzt Damage-Potential (ohne AC, reiner Wuerfel-EV). */
export function estimateDamagePotential(actions: Action[]): number {
  return actions.reduce((maxDmg, action) => {
    if (action.multiattack) {
      // Multiattack: Summe aller referenzierten Actions
      const refs = resolveMultiattackRefs(action, actions);
      const totalDmg = refs.reduce((sum, ref) => {
        if (!ref.damage) return sum;
        const dmgPMF = diceExpressionToPMF(ref.damage.dice);
        return sum + getExpectedValue(addConstant(dmgPMF, ref.damage.modifier));
      }, 0);
      return Math.max(maxDmg, totalDmg);
    }

    if (!action.damage) return maxDmg;
    const dmgPMF = diceExpressionToPMF(action.damage.dice);
    const expectedDmg = getExpectedValue(addConstant(dmgPMF, action.damage.modifier));
    return Math.max(maxDmg, expectedDmg);
  }, 0);
}

/**
 * Schaetzt effektives Damage-Potential unter Beruecksichtigung von Hit-Chance.
 * Verwendet fuer Danger-Score Berechnung: Wie viel Schaden kann der Feind mir zufuegen?
 */
export function estimateEffectiveDamagePotential(
  actions: Action[],
  targetAC: number
): number {
  return actions.reduce((maxDmg, action) => {
    if (action.multiattack) {
      const refs = resolveMultiattackRefs(action, actions);
      const totalEffective = refs.reduce((sum, ref) => {
        if (!ref.damage || !ref.attack) return sum;
        const baseDmg = getExpectedValue(addConstant(
          diceExpressionToPMF(ref.damage.dice),
          ref.damage.modifier
        ));
        const hitChance = calculateHitChance(ref.attack.bonus, targetAC);
        return sum + baseDmg * hitChance;
      }, 0);
      return Math.max(maxDmg, totalEffective);
    }

    if (!action.damage || !action.attack) return maxDmg;
    const baseDmg = getExpectedValue(addConstant(
      diceExpressionToPMF(action.damage.dice),
      action.damage.modifier
    ));
    const hitChance = calculateHitChance(action.attack.bonus, targetAC);
    return Math.max(maxDmg, baseDmg * hitChance);
  }, 0);
}

/** Schaetzt Heal-Potential (reiner Wuerfel-EV). */
export function estimateHealPotential(actions: Action[]): number {
  return actions.reduce((maxHeal, action) => {
    if (!action.healing) return maxHeal;
    const healPMF = diceExpressionToPMF(action.healing.dice);
    const expectedHeal = getExpectedValue(addConstant(healPMF, action.healing.modifier));
    return Math.max(maxHeal, expectedHeal);
  }, 0);
}

/**
 * Schaetzt Control-Potential basierend auf Save DC.
 * Hoeherer DC = effektivere Control (analog zu hoeherem Damage).
 */
export function estimateControlPotential(actions: Action[]): number {
  return actions.reduce((maxDC, action) => {
    // Nur Actions mit Conditions zaehlen
    if (!action.effects?.some(e => e.condition)) return maxDC;

    // DC als Mass fuer Effektivitaet (analog zu Damage-Wuerfel)
    if (action.save) {
      return Math.max(maxDC, action.save.dc);
    } else if (action.autoHit) {
      return Math.max(maxDC, 20); // Auto-Hit = maximale Effektivitaet
    }

    return maxDC;
  }, 0);
}

/**
 * Gesamtwert eines Combatants (AC-unabhaengig). HACK: siehe Header
 * Fuer Vergleich: "Wie wertvoll ist dieser Ally fuer das Team?"
 */
export function estimateCombatantValue(profile: CombatProfile): number {
  const dmg = estimateDamagePotential(profile.actions);
  const heal = estimateHealPotential(profile.actions);
  const controlDC = estimateControlPotential(profile.actions); // 0-20

  // Gewichtung: Alle auf "Damage-aequivalenter" Skala
  // - Damage direkt
  // - Heal als "geretteter Damage" (~50%)
  // - Control-DC skaliert (DC 15 = 10 Damage-Aequivalent)
  const value = dmg + (heal * 0.5) + (controlDC * 0.7);
  debug('estimateCombatantValue:', { participantId: profile.participantId, dmg, heal, controlDC, value });
  return value;
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
  profile: CombatProfile,
  state: SimulationState
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
      const enemies = getCandidates(profile, state, 'damage');
      if (enemies.length > 0) {
        const avgEnemyDPR = enemies.reduce((sum, e) =>
          sum + estimateDamagePotential(e.actions), 0) / enemies.length;

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
      const allies = getCandidates(profile, state, 'buff');
      if (allies.length > 0) {
        const avgAllyDPR = allies.reduce((sum, a) =>
          sum + estimateDamagePotential(a.actions), 0) / allies.length;

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
          const enemies = getCandidates(profile, state, 'damage');
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

/** Filtert moegliche Ziele basierend auf Intent und Allianzen. */
export function getCandidates(
  attacker: CombatProfile,
  state: SimulationState,
  intent: ActionIntent
): CombatProfile[] {
  const alive = (p: CombatProfile) => (p.deathProbability ?? 0) < 0.95;

  switch (intent) {
    case 'healing':
    case 'buff':
      // Verbuendete (ausser sich selbst) fuer Healing und Buffs
      return state.profiles.filter(p =>
        isAllied(attacker.groupId, p.groupId, state.alliances) &&
        p.participantId !== attacker.participantId &&
        alive(p)
      );
    case 'damage':
    case 'control':
      // Feinde (nicht verbuendet)
      return state.profiles.filter(p =>
        isHostile(attacker.groupId, p.groupId, state.alliances) &&
        alive(p)
      );
  }
}

// ============================================================================
// ACTION/TARGET SCORING
// ============================================================================

/**
 * Berechnet Score fuer eine (Action, Target)-Kombination.
 * Nutzt Base-Values-Cache (Combat-Level) + Situative Modifiers (per Position).
 *
 * @param distanceCells Distanz in Cells
 * @param state SimulationState fuer Modifier-Evaluation (Ally-Positionen etc.)
 */
export function calculatePairScore(
  attacker: CombatProfile,
  action: Action,
  target: CombatProfile,
  distanceCells: number,
  state?: SimulationState
): ActionTargetScore | null {
  const intent = getActionIntent(action);

  // Range-Check (action.range ist in Feet, konvertiere zu Cells)
  // Multiattack: Max-Range aus referenzierten Actions
  let maxRangeFeet: number;
  if (action.multiattack) {
    const refs = resolveMultiattackRefs(action, attacker.actions);
    maxRangeFeet = refs.reduce((max, ref) => {
      if (!ref.range) return max;
      const refRange = ref.range.long ?? ref.range.normal;
      return Math.max(max, refRange);
    }, 0);
  } else {
    maxRangeFeet = action.range.long ?? action.range.normal;
  }

  const maxRangeCells = feetToCell(maxRangeFeet);
  if (distanceCells > maxRangeCells) {
    debug('calculatePairScore: out of range', { actionName: action.name, distanceCells, maxRangeCells });
    return null;
  }

  // Multiattack: Separate Logik (kombinierte PMF, nicht gecacht)
  if (action.multiattack) {
    const multiDamage = calculateMultiattackDamage(action, attacker.actions, target.ac);
    if (!multiDamage) return null;
    const score = getExpectedValue(multiDamage);
    debug('calculatePairScore (multiattack):', { actionName: action.name, score });
    return { action, target, score, intent };
  }

  // Base-Values-Cache: Hole oder berechne Base-Values
  let baseValues = getCachedBaseValues(attacker, action, target);
  if (!baseValues) {
    baseValues = calculateAndCacheBaseValues(attacker, action, target);
    debug('calculatePairScore: base values computed', {
      cacheKey: getBaseValuesCacheKey(attacker, action, target),
      baseValues,
    });
  } else {
    debug('calculatePairScore: base values cache hit', {
      cacheKey: getBaseValuesCacheKey(attacker, action, target),
    });
  }

  // Situational Modifiers evaluieren (positionsabhaengig, nicht gecacht)
  let modifiers: SituationalModifiers | undefined;
  if (state) {
    const attackerContext: CombatantContext = {
      position: attacker.position,
      groupId: attacker.groupId,
      participantId: attacker.participantId,
      conditions: attacker.conditions ?? [],
      ac: attacker.ac,
      hp: getExpectedValue(attacker.hp),
    };
    const targetContext: CombatantContext = {
      position: target.position,
      groupId: target.groupId,
      participantId: target.participantId,
      conditions: target.conditions ?? [],
      ac: target.ac,
      hp: getExpectedValue(target.hp),
    };
    const modifierContext: ModifierContext = {
      attacker: attackerContext,
      target: targetContext,
      action,
      state: {
        profiles: state.profiles.map(p => ({
          position: p.position,
          groupId: p.groupId,
          participantId: p.participantId,
          conditions: p.conditions,
        })),
        alliances: state.alliances,
      },
    };
    modifiers = evaluateSituationalModifiers(modifierContext);
  }

  // Score aus gecachten Base-Values + situativen Modifiern
  let score = computeScoreFromBaseValues(baseValues, intent, target, modifiers, state);
  if (score === null) {
    debug('calculatePairScore: no valid score', { actionName: action.name, intent, baseValues });
    return null;
  }

  // Concentration-Switch-Kosten abziehen falls anwendbar
  // Wenn der Caster bereits konzentriert und eine neue Concentration-Action waehlt,
  // muss der Wert des bestehenden Spells vom neuen Score abgezogen werden.
  if (state && isConcentrationSpell(action) && attacker.concentratingOn) {
    const remainingValue = estimateRemainingConcentrationValue(
      attacker.concentratingOn,
      attacker,
      state
    );
    const originalScore = score;
    score = score - remainingValue;

    debug('calculatePairScore: concentration switch cost', {
      actionName: action.name,
      currentConcentration: attacker.concentratingOn.name,
      remainingValue,
      originalScore,
      adjustedScore: score,
    });
  }

  debug('calculatePairScore:', {
    actionName: action.name,
    intent,
    score,
    hasModifiers: !!modifiers,
    hasConcentrationCost: !!(isConcentrationSpell(action) && attacker.concentratingOn),
  });

  return { action, target, score, intent };
}

/**
 * Waehlt beste (Action, Target)-Kombination basierend auf EV-Score.
 * Standalone aufrufbar fuer Encounter-Runner: "Was soll diese Kreatur tun?"
 */
export function selectBestActionAndTarget(
  attacker: CombatProfile,
  state: SimulationState
): ActionTargetScore | null {
  const scores: ActionTargetScore[] = [];

  for (const action of attacker.actions) {
    const intent = getActionIntent(action);
    const candidates = getCandidates(attacker, state, intent);

    for (const target of candidates) {
      const distance = getDistance(attacker.position, target.position);
      const pairScore = calculatePairScore(attacker, action, target, distance, state);
      if (pairScore) scores.push(pairScore);
    }
  }

  if (scores.length === 0) {
    debug('selectBestActionAndTarget: no valid actions for', attacker.participantId);
    return null;
  }

  // Beste Kombination nach Score
  const best = scores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  debug('selectBestActionAndTarget:', {
    attacker: attacker.participantId,
    bestAction: best.action.name,
    bestTarget: best.target.participantId,
    bestScore: best.score,
    intent: best.intent,
  });

  return best;
}

/**
 * Berechnet maximale Angriffsreichweite eines Profils (in Cells).
 */
export function getMaxAttackRange(profile: CombatProfile): number {
  let maxRange = 0;

  const updateMaxRange = (act: Action) => {
    if (act.damage && act.range) {
      const rangeFeet = act.range.long ?? act.range.normal;
      maxRange = Math.max(maxRange, feetToCell(rangeFeet));
    }
  };

  for (const action of profile.actions) {
    if (action.multiattack) {
      // Multiattack: Max-Range aus Refs
      const refs = resolveMultiattackRefs(action, profile.actions);
      refs.forEach(updateMaxRange);
    } else {
      updateMaxRange(action);
    }
  }
  return maxRange || 1;  // Default: Melee (1 Cell = 5ft)
}

// ============================================================================
// BASE-VALUE EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Berechnet und cached alle Base-Values fuer eine Action-Target-Kombination.
 * Ruft die spezifischen Extraction-Funktionen basierend auf Action-Intent auf.
 */
export function calculateAndCacheBaseValues(
  caster: CombatProfile,
  action: Action,
  target: CombatProfile
): ActionBaseValues {
  const intent = getActionIntent(action);
  let baseValues: ActionBaseValues = {};

  switch (intent) {
    case 'damage':
      if (action.save) {
        baseValues = extractBaseSaveValues(action, target);
      } else if (action.attack) {
        baseValues = extractBaseDamageValues(caster, action, target);
      } else if (action.damage) {
        // AutoHit Damage
        baseValues = { baseDamageEV: getExpectedValue(addConstant(
          diceExpressionToPMF(action.damage.dice),
          action.damage.modifier
        )) };
      }
      // Multi-effect Actions: Auch Control-Values extrahieren
      if (action.effects?.some(e => e.condition)) {
        const controlValues = extractBaseControlValues(action, target);
        baseValues = { ...baseValues, ...controlValues };
      }
      break;

    case 'healing':
      baseValues = extractBaseHealValues(action);
      break;

    case 'control':
      baseValues = extractBaseControlValues(action, target);
      break;

    case 'buff':
      baseValues = extractBaseBuffValues(action);
      break;
  }

  // Cache setzen
  setCachedBaseValues(caster, action, target, baseValues);

  debug('calculateAndCacheBaseValues:', {
    cacheKey: getBaseValuesCacheKey(caster, action, target),
    baseValues,
  });

  return baseValues;
}

/**
 * Extrahiert Base-Damage-Values fuer Attack-Roll Actions.
 */
function extractBaseDamageValues(
  _caster: CombatProfile,
  action: Action,
  target: CombatProfile
): Partial<Pick<ActionBaseValues, 'baseDamageEV' | 'baseHitChance'>> {
  if (!action.damage || !action.attack) {
    return {};
  }

  // Base Damage EV (Wuerfel + Modifier)
  const baseDamageEV = getExpectedValue(addConstant(
    diceExpressionToPMF(action.damage.dice),
    action.damage.modifier
  ));

  // Base Hit-Chance (ohne situative Modifiers)
  const baseHitChance = calculateHitChance(action.attack.bonus, target.ac);

  return { baseDamageEV, baseHitChance };
}

/**
 * Extrahiert Base-Values fuer Save-based Damage Actions.
 */
function extractBaseSaveValues(
  action: Action,
  target: CombatProfile
): Partial<Pick<ActionBaseValues, 'baseDamageEV' | 'baseSaveFailChance'>> {
  if (!action.damage || !action.save) {
    return {};
  }

  // Base Damage EV
  const baseDamageEV = getExpectedValue(addConstant(
    diceExpressionToPMF(action.damage.dice),
    action.damage.modifier
  ));

  // Base Save Fail Chance
  const baseSaveFailChance = calculateSaveFailChance(
    action.save.dc,
    target,
    action.save.ability
  );

  return { baseDamageEV, baseSaveFailChance };
}

/**
 * Extrahiert Base-Heal-Values.
 */
function extractBaseHealValues(
  action: Action
): Partial<Pick<ActionBaseValues, 'baseHealEV'>> {
  if (!action.healing) {
    return {};
  }

  const baseHealEV = getExpectedValue(addConstant(
    diceExpressionToPMF(action.healing.dice),
    action.healing.modifier
  ));

  return { baseHealEV };
}

/**
 * Extrahiert Base-Control-Values. HACK: siehe Header (contested = 0.5)
 */
function extractBaseControlValues(
  action: Action,
  target: CombatProfile
): Partial<Pick<ActionBaseValues, 'baseControlDuration' | 'baseSuccessProb'>> {
  // Finde Condition-Effect
  const conditionEffect = action.effects?.find(e => e.condition);
  if (!conditionEffect?.condition) {
    return {};
  }

  // Duration aus Lookup
  const baseControlDuration = CONDITION_DURATION[conditionEffect.condition] ?? DEFAULT_CONDITION_DURATION;

  // Success Probability
  let baseSuccessProb: number;
  if (action.save) {
    baseSuccessProb = calculateSaveFailChance(action.save.dc, target, action.save.ability);
  } else if (action.contested) {
    baseSuccessProb = 0.5; // Approximation fuer Contested
  } else if (action.autoHit) {
    baseSuccessProb = 1.0;
  } else if (action.attack) {
    baseSuccessProb = calculateHitChance(action.attack.bonus, target.ac);
  } else {
    baseSuccessProb = 0.5; // Default
  }

  return { baseControlDuration, baseSuccessProb };
}

/**
 * Extrahiert Base-Buff-Values. HACK: siehe Header (grantMovement = Extra-Action)
 */
function extractBaseBuffValues(
  action: Action
): Partial<Pick<ActionBaseValues, 'baseOffensiveMultiplier' | 'baseDefensiveMultiplier' | 'baseExtraActions' | 'baseDuration'>> {
  if (!action.effects?.length) {
    return {};
  }

  let baseOffensiveMultiplier = 0;
  let baseDefensiveMultiplier = 0;
  let baseExtraActions = 0;

  // Duration aus erstem Effect mit Duration oder Default
  const durationEffect = action.effects.find(e => e.duration);
  const baseDuration = durationEffect?.duration?.value ?? 3;

  for (const effect of action.effects) {
    // Offensive Buffs (Advantage via rollModifiers)
    if (effect.rollModifiers) {
      for (const mod of effect.rollModifiers) {
        if (mod.on === 'attacks' && mod.type === 'advantage') {
          baseOffensiveMultiplier += 0.25; // Advantage = +5 to-hit = +25%
        }
      }
    }

    // Stat Modifiers
    if (effect.statModifiers) {
      for (const mod of effect.statModifiers) {
        if (mod.stat === 'ac') {
          baseDefensiveMultiplier += mod.value * 0.05; // +1 AC = -5% hit chance
        }
        if (mod.stat === 'attack') {
          baseOffensiveMultiplier += mod.value * 0.05; // +1 to-hit = +5%
        }
        if (mod.dice) {
          const diceEV = getExpectedValue(diceExpressionToPMF(mod.dice));
          if (mod.stat === 'attack') {
            baseOffensiveMultiplier += diceEV * 0.05;
          }
        }
      }
    }

    // Extra Actions (Haste)
    if (effect.grantMovement) {
      baseExtraActions += 1;
    }
  }

  return {
    baseOffensiveMultiplier: baseOffensiveMultiplier > 0 ? baseOffensiveMultiplier : undefined,
    baseDefensiveMultiplier: baseDefensiveMultiplier > 0 ? baseDefensiveMultiplier : undefined,
    baseExtraActions: baseExtraActions > 0 ? baseExtraActions : undefined,
    baseDuration,
  };
}

/**
 * Berechnet finalen Score aus gecachten Base-Values und situativen Modifiern.
 */
export function computeScoreFromBaseValues(
  baseValues: ActionBaseValues,
  intent: ActionIntent,
  target: CombatProfile,
  modifiers?: SituationalModifiers,
  state?: SimulationState
): number | null {
  switch (intent) {
    case 'damage': {
      // Attack Roll Damage
      if (baseValues.baseDamageEV !== undefined && baseValues.baseHitChance !== undefined) {
        // Situative Modifier anwenden
        let adjustedHitChance = baseValues.baseHitChance;
        if (modifiers) {
          adjustedHitChance += modifiers.effectiveAttackMod * 0.05;
          adjustedHitChance = Math.max(0.05, Math.min(0.95, adjustedHitChance));
        }
        const damageScore = baseValues.baseDamageEV * adjustedHitChance;

        // Multi-effect: Control-Score addieren
        if (baseValues.baseControlDuration !== undefined && baseValues.baseSuccessProb !== undefined) {
          const targetDPR = estimateDamagePotential(target.actions);
          const controlScore = targetDPR * baseValues.baseControlDuration * baseValues.baseSuccessProb;
          return damageScore + controlScore;
        }

        return damageScore;
      }

      // Save-based Damage
      if (baseValues.baseDamageEV !== undefined && baseValues.baseSaveFailChance !== undefined) {
        // Half-on-save: Annahme dass Action half-on-save hat (konservativ)
        const effectiveDamage = baseValues.baseDamageEV * baseValues.baseSaveFailChance +
          (baseValues.baseDamageEV * 0.5) * (1 - baseValues.baseSaveFailChance);
        return effectiveDamage;
      }

      // AutoHit Damage
      if (baseValues.baseDamageEV !== undefined) {
        return baseValues.baseDamageEV;
      }

      return null;
    }

    case 'healing': {
      if (!state || baseValues.baseHealEV === undefined) return null;

      const allyDPR = estimateDamagePotential(target.actions);
      const incomingDPR = estimateIncomingDPR(target, state);
      const survivalRoundsGained = baseValues.baseHealEV / Math.max(1, incomingDPR);

      return allyDPR * survivalRoundsGained;
    }

    case 'control': {
      if (baseValues.baseControlDuration === undefined || baseValues.baseSuccessProb === undefined) {
        return null;
      }

      const targetDPR = estimateDamagePotential(target.actions);
      return targetDPR * baseValues.baseControlDuration * baseValues.baseSuccessProb;
    }

    case 'buff': {
      const allyDPR = estimateDamagePotential(target.actions);
      const duration = baseValues.baseDuration ?? 3;
      let buffScore = 0;

      if (baseValues.baseOffensiveMultiplier !== undefined) {
        buffScore += allyDPR * baseValues.baseOffensiveMultiplier * duration;
      }
      if (baseValues.baseDefensiveMultiplier !== undefined) {
        buffScore += allyDPR * baseValues.baseDefensiveMultiplier * duration;
      }
      if (baseValues.baseExtraActions !== undefined) {
        buffScore += allyDPR * baseValues.baseExtraActions * duration;
      }

      return buffScore > 0 ? buffScore : null;
    }

    default:
      return null;
  }
}

// ============================================================================
// REACTION SYSTEM
// ============================================================================

/**
 * Threshold fuer Reaction-Entscheidung.
 * Reaction wird genutzt wenn: reactionValue > opportunityCost × REACTION_THRESHOLD
 */
export const REACTION_THRESHOLD = 0.6;

/**
 * Kontext fuer Reaction-Evaluation.
 * Beschreibt das ausloesende Event und alle relevanten Informationen.
 */
export interface ReactionContext {
  /** Das ausloesende Event (attacked, damaged, spell-cast, leaves-reach, etc.) */
  event: TriggerEvent;
  /** Der Ausloeser (Angreifer, Spell-Caster, sich bewegende Kreatur) */
  source: CombatProfile;
  /** Optional: Das Ziel des Triggers (bei attacked/damaged der Verteidiger) */
  target?: CombatProfile;
  /** Optional: Die ausloesende Action */
  action?: Action;
  /** Optional: Bereits zugefuegter Schaden (bei 'damaged' Event) */
  damage?: number;
  /** Optional: Spell-Level (bei 'spell-cast' Event fuer Counterspell) */
  spellLevel?: number;
}

/**
 * Ergebnis einer Reaction-Ausfuehrung.
 */
export interface ReactionResult {
  /** Der Reactor (wer hat reagiert) */
  reactor: CombatProfile;
  /** Die verwendete Reaction */
  reaction: Action;
  /** Ob die Reaction ausgefuehrt wurde */
  executed: boolean;
  /** Optionale Effekte der Reaction */
  effect?: {
    /** Schaden der zugefuegt wurde (OA, Hellish Rebuke) */
    damage?: number;
    /** AC-Bonus der gewaehrt wurde (Shield) */
    acBonus?: number;
    /** Ob ein Spell gecountert wurde (Counterspell) */
    spellCountered?: boolean;
  };
}

/**
 * Filtert verfuegbare Reactions aus den Actions eines Profiles.
 * Reactions haben timing.type === 'reaction'.
 */
export function getAvailableReactions(profile: CombatProfile): Action[] {
  return profile.actions.filter(a => a.timing.type === 'reaction');
}

/**
 * Prueft ob eine Reaction fuer ein bestimmtes Trigger-Event relevant ist.
 * Nutzt action.timing.triggerCondition.event fuer exaktes Matching.
 *
 * Fallback-Logik fuer Actions ohne explizites triggerCondition:
 * - Melee-Attacks → 'leaves-reach' (OA)
 * - Actions mit counter → 'spell-cast' (Counterspell)
 * - Damage-Actions mit 'damaged' im Namen → 'damaged' (Hellish Rebuke)
 */
export function matchesTrigger(reaction: Action, event: TriggerEvent): boolean {
  // Explizites triggerCondition hat Vorrang
  if (reaction.timing.triggerCondition?.event) {
    return reaction.timing.triggerCondition.event === event;
  }

  // Fallback-Heuristiken basierend auf Action-Eigenschaften
  switch (event) {
    case 'leaves-reach':
      // OA: Melee-Attacks ohne triggerCondition
      return reaction.actionType === 'melee-weapon' || reaction.actionType === 'melee-spell';

    case 'spell-cast':
      // Counterspell: Actions mit counter-Feld
      return reaction.counter !== undefined;

    case 'attacked':
      // Shield-artige Reactions: AC-Buff ohne Damage
      return !reaction.damage && reaction.effects?.some(e =>
        e.statModifiers?.some(m => m.stat === 'ac')
      ) === true;

    case 'damaged':
      // Hellish Rebuke-artige Reactions: Damage als Response
      return reaction.damage !== undefined && !reaction.attack;

    default:
      return false;
  }
}

/**
 * Findet alle passenden Reactions fuer ein Event aus den Actions eines Profiles.
 */
export function findMatchingReactions(
  profile: CombatProfile,
  event: TriggerEvent
): Action[] {
  const reactions = getAvailableReactions(profile);
  return reactions.filter(r => matchesTrigger(r, event));
}

/**
 * Bewertet eine Reaction gegen einen Trigger-Kontext.
 * Nutzt unterschiedliche Scoring-Logik basierend auf dem Reaction-Typ.
 *
 * @returns Score in DPR-Skala (vergleichbar mit anderen Action-Scores)
 */
export function evaluateReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatProfile,
  state: SimulationState
): number {
  const event = context.event;

  debug('evaluateReaction:', {
    reaction: reaction.name,
    event,
    source: context.source.participantId,
    target: context.target?.participantId,
  });

  // Opportunity Attack: Melee-Damage gegen fliehenden Feind
  if (event === 'leaves-reach') {
    return evaluateOAReaction(reaction, context, profile, state);
  }

  // Shield: AC-Boost gegen eingehenden Angriff
  if (event === 'attacked') {
    return evaluateShieldReaction(reaction, context, profile);
  }

  // Counterspell: Spell aufheben
  if (event === 'spell-cast') {
    return evaluateCounterspellReaction(reaction, context, profile, state);
  }

  // Hellish Rebuke / Absorb Elements: Damage als Response
  if (event === 'damaged') {
    return evaluateDamagedReaction(reaction, context, profile);
  }

  // Unbekanntes Event - Fallback auf allgemeine Damage-Bewertung
  if (reaction.damage) {
    const pairScore = calculatePairScore(profile, reaction, context.source, 1, state);
    return pairScore?.score ?? 0;
  }

  return 0;
}

/**
 * Bewertet Opportunity Attack Reaction.
 * Score = hitChance × expectedDamage
 */
function evaluateOAReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatProfile,
  state: SimulationState
): number {
  // OA ist ein normaler Melee-Attack gegen den Fliehenden
  const pairScore = calculatePairScore(profile, reaction, context.source, 1, state);
  if (!pairScore) return 0;

  debug('evaluateOAReaction:', {
    reaction: reaction.name,
    target: context.source.participantId,
    score: pairScore.score,
  });

  return pairScore.score;
}

/**
 * Bewertet Shield-artige Reactions (AC-Boost).
 * Score = (hitChanceReduction) × expectedIncomingDamage
 *
 * Formel:
 * - hitChance(currentAC) - hitChance(currentAC + acBonus)
 * - × erwarteter Schaden der eingehenden Action
 */
function evaluateShieldReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatProfile
): number {
  // AC-Bonus aus Reaction extrahieren
  const acBonus = reaction.effects?.reduce((total, effect) => {
    const acMod = effect.statModifiers?.find(m => m.stat === 'ac');
    return total + (acMod?.value ?? 0);
  }, 0) ?? 0;

  if (acBonus <= 0) return 0;

  // Attack-Bonus des Angreifers
  const attackBonus = context.action?.attack?.bonus ?? 5;  // Default +5

  // Hit-Chance Reduktion berechnen
  const currentHitChance = calculateHitChance(attackBonus, profile.ac);
  const shieldedHitChance = calculateHitChance(attackBonus, profile.ac + acBonus);
  const hitChanceReduction = currentHitChance - shieldedHitChance;

  // Erwarteter eingehender Schaden
  let expectedDamage = 10;  // Default
  if (context.action?.damage) {
    const damagePMF = diceExpressionToPMF(context.action.damage.dice);
    expectedDamage = getExpectedValue(addConstant(damagePMF, context.action.damage.modifier));
  }

  const score = hitChanceReduction * expectedDamage;

  debug('evaluateShieldReaction:', {
    reaction: reaction.name,
    acBonus,
    currentHitChance,
    shieldedHitChance,
    hitChanceReduction,
    expectedDamage,
    score,
  });

  return score;
}

/**
 * Bewertet Counterspell Reaction.
 * Score = spellValue × successProbability
 *
 * Bei Auto-Success (Counterspell-Level >= Spell-Level): successProb = 1
 * Sonst: DC = 10 + Spell-Level, Check mit Spellcasting-Modifier
 */
function evaluateCounterspellReaction(
  reaction: Action,
  context: ReactionContext,
  _profile: CombatProfile,
  state: SimulationState
): number {
  const targetSpellLevel = context.spellLevel ?? 1;

  // Counterspell-Level aus spellSlot
  const counterspellLevel = reaction.spellSlot?.level ?? 3;  // Default 3rd level

  // Spell-Value schaetzen
  const spellValue = estimateSpellValue(context.action, context.source, state);

  // Success-Probability berechnen
  let successProb = 1.0;

  if (counterspellLevel < targetSpellLevel) {
    // DC-Check erforderlich: DC = 10 + Spell-Level
    const dc = 10 + targetSpellLevel;
    // Spellcasting-Mod schaetzen (typisch: +3 bis +5)
    const spellcastingMod = 4;  // Approximation
    successProb = Math.min(0.95, Math.max(0.05, (20 - dc + spellcastingMod + 1) / 20));
  }

  const score = spellValue * successProb;

  debug('evaluateCounterspellReaction:', {
    reaction: reaction.name,
    targetSpellLevel,
    counterspellLevel,
    spellValue,
    successProb,
    score,
  });

  return score;
}

/**
 * Bewertet Reactions auf 'damaged' Event (Hellish Rebuke, Absorb Elements).
 * Score = expectedDamage × successProb (fuer Damage-Reactions)
 */
function evaluateDamagedReaction(
  reaction: Action,
  context: ReactionContext,
  _profile: CombatProfile
): number {
  // Damage-Reaction (Hellish Rebuke)
  if (reaction.damage) {
    const damagePMF = diceExpressionToPMF(reaction.damage.dice);
    let baseDamage = getExpectedValue(addConstant(damagePMF, reaction.damage.modifier));

    // Save-basierte Reactions
    if (reaction.save) {
      const saveFailChance = calculateSaveFailChance(
        reaction.save.dc,
        context.source,
        reaction.save.ability
      );
      // Half-on-save typisch fuer Hellish Rebuke
      if (reaction.save.onSave === 'half') {
        baseDamage = baseDamage * saveFailChance + (baseDamage * 0.5) * (1 - saveFailChance);
      } else {
        baseDamage = baseDamage * saveFailChance;
      }
    }

    debug('evaluateDamagedReaction (damage):', {
      reaction: reaction.name,
      baseDamage,
    });

    return baseDamage;
  }

  // Absorb Elements: Resistance + extra Damage (komplex, vereinfacht)
  // Score = incomingDamage × 0.5 (Resistance) + extra Melee-Damage
  if (context.damage && context.damage > 0) {
    const resistanceValue = context.damage * 0.5;

    debug('evaluateDamagedReaction (absorb):', {
      reaction: reaction.name,
      incomingDamage: context.damage,
      resistanceValue,
    });

    return resistanceValue;
  }

  return 0;
}

/**
 * Schaetzt den Wert eines Spells fuer Counterspell-Bewertung.
 * Basiert auf Action-Intent und typischen Effekten.
 */
function estimateSpellValue(
  spell: Action | undefined,
  caster: CombatProfile,
  state: SimulationState
): number {
  if (!spell) return 10;  // Default fuer unbekannte Spells

  const intent = getActionIntent(spell);

  switch (intent) {
    case 'damage': {
      if (!spell.damage) return 10;
      const damagePMF = diceExpressionToPMF(spell.damage.dice);
      const baseDamage = getExpectedValue(addConstant(damagePMF, spell.damage.modifier));
      // AoE-Spells: Multipliziere mit geschaetzter Anzahl Targets
      const targetCount = spell.targeting.type === 'area' ? 3 : 1;
      return baseDamage * targetCount;
    }

    case 'control': {
      // Control-Spell-Value: targetDPR × duration × successProb
      const enemies = getCandidates(caster, state, 'control');
      if (enemies.length === 0) return 15;  // Default

      const avgEnemyDPR = enemies.reduce((sum, e) =>
        sum + estimateDamagePotential(e.actions), 0) / enemies.length;
      const duration = spell.effects?.[0]?.duration?.value ?? 3;

      return avgEnemyDPR * duration * 0.5;  // 50% success assumption
    }

    case 'buff': {
      // Buff-Spell-Value: Schaetzung basierend auf Spell-Level
      const spellLevel = spell.spellSlot?.level ?? 1;
      return spellLevel * 8;  // Heuristik: ~8 DPR pro Spell-Level
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
 * Schaetzt den erwarteten Wert zukuenftiger Reactions (Opportunity Cost).
 *
 * Beruecksichtigt:
 * - Wahrscheinlichkeit dass OA getriggert wird
 * - Wahrscheinlichkeit dass wertvolle Spells gecountert werden koennten
 * - Erwarteter Schaden wenn ohne Shield getroffen
 */
export function estimateExpectedReactionValue(
  profile: CombatProfile,
  state: SimulationState
): number {
  const reactions = getAvailableReactions(profile);
  if (reactions.length === 0) return 0;

  let expectedValue = 0;

  // OA-Potential: Schaetzung basierend auf Feind-Positionen
  const hasOAReaction = reactions.some(r =>
    r.actionType === 'melee-weapon' || r.actionType === 'melee-spell'
  );
  if (hasOAReaction) {
    // Approximation: 20% Chance dass Feind flieht
    const oaChance = 0.2;
    const avgOADamage = estimateDamagePotential(reactions.filter(r =>
      r.actionType === 'melee-weapon' || r.actionType === 'melee-spell'
    ));
    expectedValue += oaChance * avgOADamage;
  }

  // Shield-Potential: Schaetzung basierend auf eingehenden Angriffen
  const hasShieldReaction = reactions.some(r =>
    r.effects?.some(e => e.statModifiers?.some(m => m.stat === 'ac'))
  );
  if (hasShieldReaction) {
    // Approximation: 50% Chance auf relevanten Angriff
    const shieldChance = 0.5;
    const avgIncomingDamage = estimateIncomingDPR(profile, state);
    const acBonus = 5;  // Typischer Shield-Bonus
    const hitReduction = acBonus * 0.05;  // ~5% pro AC
    expectedValue += shieldChance * avgIncomingDamage * hitReduction;
  }

  // Counterspell-Potential: Schaetzung basierend auf feindlichen Castern
  const hasCounterspell = reactions.some(r => r.counter !== undefined);
  if (hasCounterspell) {
    // Approximation: 30% Chance auf wertvollen Spell
    const counterspellChance = 0.3;
    const avgSpellValue = 15;  // Typischer Spell-Wert
    expectedValue += counterspellChance * avgSpellValue;
  }

  debug('estimateExpectedReactionValue:', {
    profileId: profile.participantId,
    hasOA: hasOAReaction,
    hasShield: hasShieldReaction,
    hasCounterspell,
    expectedValue,
  });

  return expectedValue;
}

/**
 * Entscheidet ob eine Reaction genutzt werden soll.
 *
 * Formel: reactionValue > opportunityCost × REACTION_THRESHOLD
 *
 * @returns true wenn die Reaction genutzt werden soll
 */
export function shouldUseReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatProfile,
  state: SimulationState,
  budget?: TurnBudget
): boolean {
  // Keine Reaction verfuegbar
  if (budget && !budget.hasReaction) {
    debug('shouldUseReaction: no reaction available');
    return false;
  }

  const reactionValue = evaluateReaction(reaction, context, profile, state);
  const opportunityCost = estimateExpectedReactionValue(profile, state);

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
