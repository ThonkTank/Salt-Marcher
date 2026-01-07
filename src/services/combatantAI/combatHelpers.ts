// Ziel: Gemeinsame Helper-Funktionen für Combat-AI, Combat-Tracking und Combat-Resolver
// Siehe: docs/services/combatantAI/
//
// Konsolidiert duplizierte Logik:
// - Alliance/Hostility Checks
// - Hit-Chance und Multiattack-Damage Berechnung
// - Damage/Healing PMF Berechnung
// - Range-Extraktion (Multiattack-aware)
// - Distance/Position Helpers
// - Action-Iteration mit Multiattack-Expansion

import type { Action } from '@/types/entities';
import type { AbilityScores, AbilityName } from '@/types/entities/creature';
import type { Combatant } from '@/types/combat';
import { isNPC } from '@/types/combat';
import {
  type ProbabilityDistribution,
  type GridPosition,
  diceExpressionToPMF,
  addConstant,
  getDistance as gridGetDistance,
  feetToCell,
  clamp,
  calculateEffectiveDamage,
  convolveDistributions,
  createSingleValue,
  getExpectedValue,
} from '@/utils';
import type { SituationalModifiers } from './situationalModifiers';
import {
  getAbilities,
  getSaveProficiencies,
  getCR,
  getActions,
} from '../combatTracking';

// ============================================================================
// MULTIATTACK RESOLUTION
// ============================================================================

/**
 * Löst Multiattack-Referenzen auf und gibt alle referenzierten Actions zurück.
 * Gibt leeres Array zurück wenn keine Multiattack oder keine gültigen Refs.
 *
 * @param action Die Multiattack-Action
 * @param allActions Alle verfügbaren Actions (für Ref-Lookup)
 * @returns Array mit aufgelösten Actions (count-mal dupliziert)
 */
export function resolveMultiattackRefs(action: Action, allActions: Action[]): Action[] {
  if (!action.multiattack?.attacks?.length) return [];

  const resolved: Action[] = [];
  for (const entry of action.multiattack.attacks) {
    const refAction = allActions.find(a => a.name === entry.actionRef);
    if (refAction) {
      // count-mal hinzufügen für korrekte Gewichtung
      for (let i = 0; i < entry.count; i++) {
        resolved.push(refAction);
      }
    }
  }
  return resolved;
}

/**
 * Iteriert über alle Actions, expandiert Multiattacks in einzelne Refs.
 * Ruft callback für jede aufgelöste Action auf.
 *
 * @param actions Alle verfügbaren Actions
 * @param callback Wird für jede Action (inkl. Multiattack-Refs) aufgerufen
 */
export function forEachResolvedAction(
  actions: Action[],
  callback: (action: Action) => void
): void {
  for (const action of actions) {
    if (action.multiattack) {
      const refs = resolveMultiattackRefs(action, actions);
      refs.forEach(callback);
    } else {
      callback(action);
    }
  }
}

// ============================================================================
// DAMAGE & HEALING PMF
// ============================================================================

/**
 * Berechnet Base Damage PMF für eine Action (ohne Hit-Chance).
 * Konsolidiert: estimateDamagePotential, calculatePairScore, resolveAttack
 *
 * @param action Die Action mit damage-Feld
 * @returns Base Damage PMF oder null wenn keine damage
 */
export function calculateBaseDamagePMF(action: Action): ProbabilityDistribution | null {
  if (!action.damage) return null;
  return addConstant(
    diceExpressionToPMF(action.damage.dice),
    action.damage.modifier
  );
}

/**
 * Berechnet Base Healing PMF für eine Action.
 * Konsolidiert: estimateHealPotential, calculatePairScore (healing case)
 *
 * @param action Die Action mit healing-Feld
 * @returns Base Healing PMF oder null wenn keine healing
 */
export function calculateBaseHealingPMF(action: Action): ProbabilityDistribution | null {
  if (!action.healing) return null;
  return addConstant(
    diceExpressionToPMF(action.healing.dice),
    action.healing.modifier
  );
}

// ============================================================================
// RANGE CALCULATION
// ============================================================================

/**
 * Berechnet maximale Range einer Action in Feet.
 * Berücksichtigt Multiattack: nimmt max Range aus allen Refs.
 *
 * Konsolidiert: calculatePairScore, getMaxAttackRange
 *
 * @param action Die Action (kann Multiattack sein)
 * @param allActions Alle verfügbaren Actions (für Multiattack-Lookup)
 * @returns Maximale Range in Feet
 */
export function getActionMaxRangeFeet(action: Action, allActions: Action[]): number {
  if (action.multiattack) {
    const refs = resolveMultiattackRefs(action, allActions);
    return refs.reduce((max, ref) => {
      if (!ref.range) return max;
      return Math.max(max, ref.range.long ?? ref.range.normal ?? 0);
    }, 0);
  }
  return action.range?.long ?? action.range?.normal ?? 5;
}

/**
 * Berechnet maximale Range einer Action in Cells.
 *
 * @param action Die Action (kann Multiattack sein)
 * @param allActions Alle verfügbaren Actions (für Multiattack-Lookup)
 * @returns Maximale Range in Cells
 */
export function getActionMaxRangeCells(action: Action, allActions: Action[]): number {
  return feetToCell(getActionMaxRangeFeet(action, allActions));
}

// ============================================================================
// DISTANCE & POSITION HELPERS
// ============================================================================

/** Combat Profile minimal interface für Distance-Helpers. */
export interface PositionedProfile {
  position: GridPosition;
}

/** Ergebnis von findNearestProfile. */
export interface NearestResult<T extends PositionedProfile> {
  profile: T;
  distance: number;
}

/**
 * Berechnet Distanz zwischen zwei Positionen (in Cells).
 * Wrapper um gridGetDistance mit PHB-Variant (Diagonalen = 1 Cell).
 */
export function getDistance(a: GridPosition, b: GridPosition): number {
  return gridGetDistance(a, b, 'phb-variant');
}

/**
 * Findet das nächste Profil aus einer Liste von Kandidaten.
 *
 * @param from Ausgangsposition
 * @param candidates Liste von Profilen mit Position
 * @returns Nächstes Profil mit Distanz oder null wenn leer
 */
export function findNearestProfile<T extends PositionedProfile>(
  from: GridPosition,
  candidates: T[]
): NearestResult<T> | null {
  if (candidates.length === 0) return null;

  let nearest = candidates[0];
  let nearestDist = getDistance(from, nearest.position);

  for (const candidate of candidates) {
    const dist = getDistance(from, candidate.position);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }

  return { profile: nearest, distance: nearestDist };
}

/**
 * Berechnet minimale Distanz zu einer Liste von Profilen.
 *
 * @param from Ausgangsposition
 * @param profiles Liste von Profilen mit Position
 * @returns Minimale Distanz in Cells (Infinity wenn leer)
 */
export function getMinDistanceToProfiles<T extends PositionedProfile>(
  from: GridPosition,
  profiles: T[]
): number {
  if (profiles.length === 0) return Infinity;

  let minDist = Infinity;
  for (const profile of profiles) {
    const dist = getDistance(from, profile.position);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// ============================================================================
// ALLIANCE HELPERS
// ============================================================================

/**
 * Prüft ob zwei Gruppen verbündet sind.
 * Gleiche Gruppe = automatisch verbündet.
 *
 * @param groupA Erste Gruppe
 * @param groupB Zweite Gruppe
 * @param alliances Alliance-Map (groupId → verbündete groupIds)
 * @returns true wenn verbündet
 */
export function isAllied(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  if (groupA === groupB) return true;
  return alliances[groupA]?.includes(groupB) ?? false;
}

/**
 * Prüft ob zwei Gruppen Feinde sind (nicht verbündet).
 *
 * @param groupA Erste Gruppe
 * @param groupB Zweite Gruppe
 * @param alliances Alliance-Map (groupId → verbündete groupIds)
 * @returns true wenn Feinde
 */
export function isHostile(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  return !isAllied(groupA, groupB, alliances);
}

// ============================================================================
// HIT CHANCE CALCULATION
// ============================================================================

/**
 * Berechnet Hit-Chance (5%-95% Range).
 * D&D 5e: Natural 1 immer Miss, Natural 20 immer Hit.
 *
 * @param attackBonus Attack Bonus des Angreifers
 * @param targetAC AC des Ziels
 * @param modifiers Optional: Situational Modifiers (Advantage, Cover, etc.)
 * @returns Hit-Wahrscheinlichkeit (0.05 - 0.95)
 */
export function calculateHitChance(
  attackBonus: number,
  targetAC: number,
  modifiers?: SituationalModifiers
): number {
  // Auto-miss bei Full Cover oder ähnlichem
  if (modifiers?.hasAutoMiss) return 0;

  // Effektive Werte mit Modifiers berechnen
  const effectiveAttackBonus = attackBonus
    + (modifiers?.effectiveAttackMod ?? 0)  // +5 Advantage, -5 Disadvantage
    + (modifiers?.totalAttackBonus ?? 0);   // Flat bonuses

  const effectiveAC = targetAC
    + (modifiers?.totalACBonus ?? 0);       // Cover etc.

  const neededRoll = effectiveAC - effectiveAttackBonus;
  return clamp((21 - neededRoll) / 20, 0.05, 0.95);
}

// ============================================================================
// MULTIATTACK DAMAGE CALCULATION
// ============================================================================

/**
 * Berechnet kombinierte Damage-PMF für Multiattack.
 * Konvolviert alle referenzierten Actions (jeweils mit Hit-Chance).
 *
 * @param action Die Multiattack-Action
 * @param allActions Alle verfügbaren Actions des Attackers (für Ref-Lookup)
 * @param targetAC AC des Ziels für Hit-Chance-Berechnung
 * @returns Kombinierte Damage-PMF oder null wenn keine gültigen Refs
 */
export function calculateMultiattackDamage(
  action: Action,
  allActions: Action[],
  targetAC: number
): ProbabilityDistribution | null {
  if (!action.multiattack?.attacks?.length) {
    return null;
  }

  let totalDamage = createSingleValue(0);
  let validAttacksFound = false;

  for (const entry of action.multiattack.attacks) {
    const refAction = allActions.find(a => a.name === entry.actionRef);
    if (!refAction) continue;

    if (!refAction.damage || !refAction.attack) continue;

    validAttacksFound = true;

    const baseDamage = addConstant(
      diceExpressionToPMF(refAction.damage.dice),
      refAction.damage.modifier
    );

    const hitChance = calculateHitChance(refAction.attack.bonus, targetAC);
    const effectiveDamage = calculateEffectiveDamage(baseDamage, hitChance);

    for (let i = 0; i < entry.count; i++) {
      totalDamage = convolveDistributions(totalDamage, effectiveDamage);
    }
  }

  if (!validAttacksFound) {
    return null;
  }

  return totalDamage;
}

// ============================================================================
// SAVE CALCULATION
// ============================================================================

/**
 * Berechnet Proficiency Bonus aus CR (Monster) oder Level (Character).
 * D&D 5e Formel: floor((CR-1)/4) + 2, geclampt auf 2-9.
 */
export function getProficiencyBonus(c: Combatant): number {
  const crOrLevel = isNPC(c) ? getCR(c) : (c as { level: number }).level;
  // D&D 5e Proficiency-Tabelle: Level 1-4: +2, 5-8: +3, etc.
  return clamp(Math.floor((crOrLevel - 1) / 4) + 2, 2, 9);
}

/**
 * Berechnet Save-Bonus eines Combatants für ein Ability.
 * Formel: Ability Modifier + (Proficiency wenn proficient).
 *
 * @param target Der Combatant dessen Save berechnet wird
 * @param ability Das Ability ('str', 'dex', 'con', 'int', 'wis', 'cha')
 * @returns Save-Bonus (kann negativ sein)
 */
export function getSaveBonus(target: Combatant, ability: AbilityName): number {
  const abilities = getAbilities(target);
  const abilityScore = abilities[ability];
  const modifier = Math.floor((abilityScore - 10) / 2);
  const proficiency = getProficiencyBonus(target);
  const isProficient = getSaveProficiencies(target).includes(ability);
  return modifier + (isProficient ? proficiency : 0);
}

/**
 * Berechnet Wahrscheinlichkeit dass ein Save fehlschlägt.
 * Formel: (DC - saveBonus - 1) / 20, geclampt auf [0.05, 0.95]
 *
 * D&D 5e: Natural 1 ist kein Auto-Fail für Saves, aber wir clampen
 * auf 5%-95% für realistische Erwartungswerte.
 *
 * @param dc Der Save-DC
 * @param target Der Combatant der saven muss
 * @param ability Das Ability für den Save
 * @returns Fail-Wahrscheinlichkeit (0.05 - 0.95)
 */
export function calculateSaveFailChance(
  dc: number,
  target: Combatant,
  ability: AbilityName
): number {
  const saveBonus = getSaveBonus(target, ability);
  const failChance = (dc - saveBonus - 1) / 20;
  return clamp(failChance, 0.05, 0.95);
}

// ============================================================================
// DAMAGE/HEAL/CONTROL POTENTIAL
// ============================================================================

/**
 * Berechnet maximales Damage-Potential (ohne AC, reiner Würfel-EV).
 * Iteriert alle Actions und returnt den höchsten erwarteten Schaden.
 */
export function calculateDamagePotential(actions: Action[]): number {
  return actions.reduce((maxDmg, action) => {
    if (action.multiattack) {
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
 * Berechnet effektives Damage-Potential unter Berücksichtigung von Hit-Chance.
 * Für Danger-Score: Wie viel Schaden kann der Feind mir zufügen?
 */
export function calculateEffectiveDamagePotential(
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

/**
 * Berechnet maximales Heal-Potential (reiner Würfel-EV).
 */
export function calculateHealPotential(actions: Action[]): number {
  return actions.reduce((maxHeal, action) => {
    if (!action.healing) return maxHeal;
    const healPMF = diceExpressionToPMF(action.healing.dice);
    const expectedHeal = getExpectedValue(addConstant(healPMF, action.healing.modifier));
    return Math.max(maxHeal, expectedHeal);
  }, 0);
}

/**
 * Berechnet Control-Potential basierend auf Save DC.
 * Höherer DC = effektivere Control (analog zu höherem Damage).
 */
export function calculateControlPotential(actions: Action[]): number {
  return actions.reduce((maxDC, action) => {
    if (!action.effects?.some(e => e.condition)) return maxDC;

    if (action.save) {
      return Math.max(maxDC, action.save.dc);
    } else if (action.autoHit) {
      return Math.max(maxDC, 20);
    }

    return maxDC;
  }, 0);
}

/**
 * Berechnet Gesamtwert eines Combatants (AC-unabhängig).
 * Für Vergleich: "Wie wertvoll ist dieser Ally für das Team?"
 *
 * Gewichtung (heuristisch):
 * - Damage direkt
 * - Heal als "geretteter Damage" (~50%)
 * - Control-DC skaliert (DC 15 ≈ 10 Damage-Äquivalent)
 */
export function calculateCombatantValue(combatant: Combatant): number {
  const actions = getActions(combatant);
  const dmg = calculateDamagePotential(actions);
  const heal = calculateHealPotential(actions);
  const controlDC = calculateControlPotential(actions);

  return dmg + (heal * 0.5) + (controlDC * 0.7);
}
