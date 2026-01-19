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

import type { CombatEvent, BaseActionRef, PropertyModifier } from '@/types/entities/combatEvent';
import type { AbilityScores, AbilityName } from '@/types/entities/creature';
import type { Combatant, CombatState, CombatantSimulationState } from '@/types/combat';
import type { CombatCellProperties } from '@/types/combatTerrain';
import { isNPC } from '@/types/combat';
import { getReachablePositionsWithTerrain } from '../../combatTerrain';
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
  getRelevantCells,
  positionsEqual,
  positionToKey,
} from '@/utils';
import type { SituationalModifiers } from '../situationalModifiers';
import {
  getAbilities,
  getSaveProficiencies,
  getCR,
  getCombatEvents,
  getSpeed,
} from '../../combatTracking';

// ============================================================================
// MULTIATTACK RESOLUTION
// ============================================================================

/**
 * Löst Multiattack-Referenzen auf und gibt alle referenzierten Actions zurück.
 * Bei orRef wird die primäre Action (actionRef) zurückgegeben.
 * Gibt leeres Array zurück wenn keine Multiattack oder keine gültigen Refs.
 *
 * @param action Die Multiattack-Action
 * @param allActions Alle verfügbaren Actions (für Ref-Lookup)
 * @returns Array mit aufgelösten Actions (count-mal dupliziert)
 */
export function resolveMultiattackRefs(action: CombatEvent, allActions: CombatEvent[]): CombatEvent[] {
  if (!action.multiattack?.attacks?.length) return [];

  const resolved: CombatEvent[] = [];
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
 * Prüft ob ein Multiattack Ranged-Optionen hat (für Mixed Melee/Ranged Multiattacks).
 * Berücksichtigt sowohl actionRef als auch orRef.
 */
export function multiattackHasRangedOption(action: CombatEvent, allActions: CombatEvent[]): boolean {
  if (!action.multiattack?.attacks?.length) return false;

  for (const entry of action.multiattack.attacks) {
    // Check primary actionRef
    const primaryAction = allActions.find(a => a.name === entry.actionRef);
    if (primaryAction && (primaryAction.range?.normal ?? 5) > 5) {
      return true;
    }

    // Check orRef alternative
    if (entry.orRef) {
      const altAction = allActions.find(a => a.name === entry.orRef);
      if (altAction && (altAction.range?.normal ?? 5) > 5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Prüft ob ein Multiattack Melee-Optionen hat.
 * Berücksichtigt sowohl actionRef als auch orRef.
 */
export function multiattackHasMeleeOption(action: CombatEvent, allActions: CombatEvent[]): boolean {
  if (!action.multiattack?.attacks?.length) return false;

  for (const entry of action.multiattack.attacks) {
    // Check primary actionRef
    const primaryAction = allActions.find(a => a.name === entry.actionRef);
    if (primaryAction && (primaryAction.range?.normal ?? 5) <= 5) {
      return true;
    }

    // Check orRef alternative
    if (entry.orRef) {
      const altAction = allActions.find(a => a.name === entry.orRef);
      if (altAction && (altAction.range?.normal ?? 5) <= 5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Iteriert über alle Actions, expandiert Multiattacks in einzelne Refs.
 * Ruft callback für jede aufgelöste Action auf.
 *
 * @param actions Alle verfügbaren Actions
 * @param callback Wird für jede Action (inkl. Multiattack-Refs) aufgerufen
 */
export function forEachResolvedAction(
  actions: CombatEvent[],
  callback: (action: CombatEvent) => void
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
// BASE ACTION RESOLUTION
// ============================================================================

/**
 * Löst eine BaseAction-Referenz auf und gibt die passende Basis-Action zurück.
 * Analog zu resolveMultiattackRefs(), aber für inherit-Pattern (OA, etc.).
 *
 * @param ref Die BaseAction-Referenz mit Selektionskriterien
 * @param allActions Alle verfügbaren Actions des Combatants
 * @returns Die aufgelöste Basis-Action oder null wenn keine passt
 */
export function resolveBaseAction(
  ref: BaseActionRef,
  allActions: CombatEvent[]
): CombatEvent | null {
  // Filtere nach Kriterien
  const matches = allActions.filter(a => {
    // actionType-Filter
    if (ref.actionType && ref.actionType.length > 0) {
      if (!ref.actionType.includes(a.actionType)) return false;
    }

    // properties-Filter: ALLE required properties müssen vorhanden sein
    if (ref.properties && ref.properties.length > 0) {
      const actionProps = a.properties ?? [];
      if (!ref.properties.every(p => actionProps.includes(p))) return false;
    }

    // Nur Actions mit Damage (für inherit sinnvoll)
    if (!a.damage) return false;

    return true;
  });

  if (matches.length === 0) return null;

  // Selektion bei mehreren Matches
  const selectMode = ref.select ?? 'best-damage';

  switch (selectMode) {
    case 'best-damage': {
      // Wähle Action mit höchstem erwarteten Schaden
      return matches.reduce((best, curr) => {
        const bestDmg = getExpectedDamageValue(best);
        const currDmg = getExpectedDamageValue(curr);
        return currDmg > bestDmg ? curr : best;
      });
    }

    case 'best-attack': {
      // Wähle Action mit höchstem Attack-Bonus
      return matches.reduce((best, curr) => {
        const bestAtk = best.attack?.bonus ?? -Infinity;
        const currAtk = curr.attack?.bonus ?? -Infinity;
        return currAtk > bestAtk ? curr : best;
      });
    }

    case 'first':
    default:
      return matches[0];
  }
}

/**
 * Berechnet erwarteten Schaden einer Action (für resolveBaseAction Selektion).
 * Hilfsfunktion die nur den EV des Damage-Dice + Modifier berechnet.
 */
function getExpectedDamageValue(action: CombatEvent): number {
  if (!action.damage) return 0;
  const dmgPMF = diceExpressionToPMF(action.damage.dice);
  return getExpectedValue(addConstant(dmgPMF, action.damage.modifier));
}

// Import and re-export resolveSpellWithCaster from canonical location (combatTracking/resolution)
// Moved there to avoid import cycles and align with Resolution Pipeline architecture
import { resolveSpellWithCaster } from '../../combatTracking/resolution/resolveSpellStats';
export { resolveSpellWithCaster };

/**
 * Wendet baseAction-Resolution auf eine Action an und merged die Stats.
 * Wird VOR Attack-Resolution aufgerufen (für OA etc.).
 *
 * Bei usage='inherit': Übernimmt attack, damage und properties von der Basis-Action.
 * Range bleibt von der ursprünglichen Action (OA hat eigene Reach-Regeln).
 *
 * @param action Die Action mit baseAction-Referenz
 * @param combatantActions Alle Actions des ausführenden Combatants
 * @returns Resolved Action mit gemergten Stats
 */
export function resolveActionWithBase(
  action: CombatEvent,
  combatantActions: CombatEvent[]
): CombatEvent {
  // 1. Spell-Stats injizieren (falls isSpell: true)
  let resolved = resolveSpellWithCaster(action, combatantActions);

  // 2. BaseAction Resolution (für OA etc.)
  if (!resolved.baseAction || resolved.baseAction.usage !== 'inherit') {
    return resolved;
  }

  const baseAction = resolveBaseAction(resolved.baseAction, combatantActions);
  if (!baseAction) {
    // Keine passende Basis-Action gefunden → unverändert zurück
    // (isActionUsable hätte dies bereits verhindern sollen)
    return resolved;
  }

  // Merge: Behalte Action-spezifische Felder, übernehme Combat-Stats
  return {
    ...resolved,
    attack: baseAction.attack,
    damage: baseAction.damage,
    // range bleibt von OA (5ft Reach) - nicht von Basis übernehmen
    properties: baseAction.properties,
  };
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
export function calculateBaseDamagePMF(action: CombatEvent): ProbabilityDistribution | null {
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
export function calculateBaseHealingPMF(action: CombatEvent): ProbabilityDistribution | null {
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
export function getActionMaxRangeFeet(action: CombatEvent, allActions: CombatEvent[]): number {
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
export function getActionMaxRangeCells(action: CombatEvent, allActions: CombatEvent[]): number {
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

/** Options für terrain-aware getReachableCells(). */
export interface GetReachableCellsOptions {
  terrainMap?: Map<string, CombatCellProperties>;
  combatant?: Combatant;
  state?: CombatantSimulationState;
  /** Optional: Map-Grenzen. Cells außerhalb werden gefiltert. */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

/** Prüft ob Position innerhalb der Bounds liegt. */
function isWithinBounds(
  pos: GridPosition,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return pos.x >= bounds.minX && pos.x <= bounds.maxX &&
         pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

/**
 * Berechnet alle erreichbaren Zellen inkl. aktueller Position.
 * Konsolidiert duplizierte Logik aus allen Selektoren.
 *
 * Mit `options.terrainMap`: Nutzt Dijkstra-Pathfinding mit Terrain-Kosten.
 * Ohne `options`: Geometrische Berechnung (backward-compatible).
 * Mit `options.bounds`: Filtert Cells außerhalb der Map-Grenzen.
 *
 * @param currentCell Aktuelle Position
 * @param movementCells Verfügbare Bewegungs-Cells
 * @param options Optional: Terrain-Map, Combatant, State und Bounds für terrain-aware Pathfinding
 * @returns Array mit erreichbaren Positionen (aktuelle Position immer zuerst)
 */
export function getReachableCells(
  currentCell: GridPosition,
  movementCells: number,
  options?: GetReachableCellsOptions
): GridPosition[] {
  if (movementCells <= 0) return [currentCell];

  let cells: GridPosition[];

  // Terrain-aware Pathfinding wenn alle erforderlichen Optionen vorhanden
  if (options?.terrainMap && options?.combatant && options?.state) {
    cells = getReachablePositionsWithTerrain(
      currentCell,
      movementCells,
      options.terrainMap,
      options.combatant,
      options.state
    );
  } else {
    // Fallback: Geometrische Berechnung (backward-compatible)
    cells = [
      currentCell,
      ...getRelevantCells(currentCell, movementCells)
        .filter(cell => !positionsEqual(cell, currentCell))
        .filter(cell => getDistance(currentCell, cell) <= movementCells),
    ];
  }

  // Bounds-Filterung wenn angegeben
  if (options?.bounds) {
    cells = cells.filter(cell => isWithinBounds(cell, options.bounds!));
    // Sicherstellen dass aktuelle Position immer enthalten (auch wenn außerhalb)
    if (!cells.some(c => positionsEqual(c, currentCell))) {
      cells.unshift(currentCell);
    }
  }

  return cells;
}

// ============================================================================
// ALLIANCE HELPERS (Re-exported from combatModifiers for backwards compatibility)
// ============================================================================
// Single Source of Truth: @/utils/combatModifiers/helpers
export { isAllied, isHostile } from '@/utils/combatModifiers';

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
 * Berechnet Expected Value einer einzelnen Attack-Action mit Hit-Chance.
 * Helper für calculateMultiattackDamage.
 */
function calculateSingleAttackExpectedValue(
  refAction: CombatEvent,
  targetAC: number,
  attackModifier: number
): number {
  if (!refAction.damage || !refAction.attack) return 0;

  const baseDamage = addConstant(
    diceExpressionToPMF(refAction.damage.dice),
    refAction.damage.modifier
  );

  let hitChance = calculateHitChance(refAction.attack.bonus, targetAC);
  hitChance += attackModifier * 0.05;
  hitChance = Math.max(0.05, Math.min(0.95, hitChance));

  return getExpectedValue(calculateEffectiveDamage(baseDamage, hitChance));
}

/**
 * Berechnet kombinierte Damage-PMF für Multiattack.
 * Konvolviert alle referenzierten Actions (jeweils mit Hit-Chance).
 * Bei orRef wird die Action mit höherem Expected Damage verwendet.
 *
 * @param action Die Multiattack-Action
 * @param allActions Alle verfügbaren Actions des Attackers (für Ref-Lookup)
 * @param targetAC AC des Ziels für Hit-Chance-Berechnung
 * @param attackModifier Optional: Situativer Modifier auf Hit-Chance (z.B. +5 für Advantage)
 * @returns Kombinierte Damage-PMF oder null wenn keine gültigen Refs
 */
export function calculateMultiattackDamage(
  action: CombatEvent,
  allActions: CombatEvent[],
  targetAC: number,
  attackModifier: number = 0
): ProbabilityDistribution | null {
  if (!action.multiattack?.attacks?.length) {
    return null;
  }

  let totalDamage = createSingleValue(0);
  let validAttacksFound = false;

  for (const entry of action.multiattack.attacks) {
    const primaryAction = allActions.find(a => a.name === entry.actionRef);
    const altAction = entry.orRef ? allActions.find(a => a.name === entry.orRef) : null;

    // Wähle die bessere Option (höherer Expected Damage)
    let bestAction: CombatEvent | null = null;

    if (primaryAction?.damage && primaryAction?.attack) {
      if (altAction?.damage && altAction?.attack) {
        // Beide Optionen verfügbar - wähle höheren Expected Damage
        const primaryEV = calculateSingleAttackExpectedValue(primaryAction, targetAC, attackModifier);
        const altEV = calculateSingleAttackExpectedValue(altAction, targetAC, attackModifier);
        bestAction = primaryEV >= altEV ? primaryAction : altAction;
      } else {
        bestAction = primaryAction;
      }
    } else if (altAction?.damage && altAction?.attack) {
      bestAction = altAction;
    }

    if (!bestAction) continue;

    validAttacksFound = true;

    const baseDamage = addConstant(
      diceExpressionToPMF(bestAction.damage!.dice),
      bestAction.damage!.modifier
    );

    let hitChance = calculateHitChance(bestAction.attack!.bonus, targetAC);
    hitChance += attackModifier * 0.05;
    hitChance = Math.max(0.05, Math.min(0.95, hitChance));

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
export function calculateDamagePotential(actions: CombatEvent[]): number {
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
  actions: CombatEvent[],
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
export function calculateHealPotential(actions: CombatEvent[]): number {
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
export function calculateControlPotential(actions: CombatEvent[]): number {
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
  const actions = getCombatEvents(combatant);
  const dmg = calculateDamagePotential(actions);
  const heal = calculateHealPotential(actions);
  const controlDC = calculateControlPotential(actions);

  return dmg + (heal * 0.5) + (controlDC * 0.7);
}

// ============================================================================
// TURN ORDER HELPERS
// ============================================================================

/**
 * Berechnet Runden bis zum nächsten Turn eines Combatants.
 * Berücksichtigt zyklische Turn-Order.
 *
 * @param target Der Combatant dessen Turn berechnet wird
 * @param current Der aktuell agierende Combatant
 * @param state Combat State mit turnOrder und currentTurnIndex
 * @returns Anzahl der Turns bis target wieder dran ist (0 = jetzt dran)
 */
export function getTurnsUntilNextTurn(
  target: Combatant,
  current: Combatant,
  state: CombatState
): number {
  const { turnOrder, currentTurnIndex } = state;
  const targetIndex = turnOrder.indexOf(target.id);
  const currentIndex = turnOrder.indexOf(current.id);

  // Fallback wenn nicht in Turn Order
  if (targetIndex === -1 || currentIndex === -1) return 0;

  // Gleicher Combatant = 0 Turns
  if (targetIndex === currentIndex) return 0;

  // Berechne Position relativ zum aktuellen Turn
  const orderLength = turnOrder.length;

  // Wenn Target nach Current in dieser Runde
  if (targetIndex > currentTurnIndex) {
    return targetIndex - currentTurnIndex;
  }

  // Target kommt in nächster Runde (hat diese Runde schon gehandelt)
  return (orderLength - currentTurnIndex) + targetIndex;
}

// ============================================================================
// MOVEMENT BAND HELPERS
// ============================================================================

/**
 * Berechnet Movement-Bands für einen Combatant.
 * Band 0 = aktuelle Position
 * Band 1 = erreichbar in 1 Runde
 * Band 2 = erreichbar in 2 Runden etc.
 *
 * @param position Aktuelle Position des Combatants
 * @param combatant Der Combatant (für Speed)
 * @param maxBands Maximale Anzahl Bands zu berechnen
 * @returns Map von Band-Nummer zu Set von Cell-Keys
 */
export function getMovementBands(
  position: GridPosition,
  combatant: Combatant,
  maxBands: number
): Map<number, Set<string>> {
  const speed = getSpeed(combatant);
  const movementPerRound = feetToCell(speed.walk ?? 30);
  const bands = new Map<number, Set<string>>();

  // Band 0 = aktuelle Position
  bands.set(0, new Set([positionToKey(position)]));

  // Berechne weitere Bands
  for (let band = 1; band <= maxBands; band++) {
    const bandCells = new Set<string>();
    const maxDist = band * movementPerRound;
    const minDist = (band - 1) * movementPerRound;

    // Erzeuge alle Zellen im Band-Ring
    const allReachable = getRelevantCells(position, maxDist);
    for (const cell of allReachable) {
      const dist = getDistance(position, cell);
      if (dist > minDist && dist <= maxDist) {
        bandCells.add(positionToKey(cell));
      }
    }

    bands.set(band, bandCells);
  }

  return bands;
}

/**
 * Ermittelt in welchem Movement-Band eine Zelle liegt.
 *
 * @param cellKey Cell-Key der zu prüfenden Zelle
 * @param bands Movement-Bands Map
 * @returns Band-Nummer (0 = aktuelle Position, -1 = außerhalb)
 */
export function getCellBand(
  cellKey: string,
  bands: Map<number, Set<string>>
): number {
  for (const [bandNum, cells] of bands) {
    if (cells.has(cellKey)) return bandNum;
  }
  return -1;
}

// ============================================================================
// DISTANCE DECAY
// ============================================================================

/** Decay-Konstanten für Map-Projektion */
export const DECAY_CONSTANTS = {
  /** Decay pro Cell Entfernung */
  PER_STEP: 0.95,
  /** Extra Decay beim Überschreiten einer Movement-Band Grenze */
  BAND_CROSSING: 0.7,
  /** Maximale Movement-Bands für Projektion */
  MAX_BANDS: 3,
  /** Decay pro Turn Entfernung (für Threat/Support) */
  TURN_DECAY: 0.9,
} as const;

/**
 * Wendet Distance Decay auf einen Wert an.
 * Kombiniert Per-Step Decay und Band-Crossing Decay.
 *
 * @param value Der Ausgangswert
 * @param sourceCell Position der Quelle
 * @param targetCell Position für die der Wert berechnet wird
 * @param bands Movement-Bands des betrachtenden Combatants
 * @returns Decay-gewichteter Wert
 */
export function applyDistanceDecay(
  value: number,
  sourceCell: GridPosition,
  targetCell: GridPosition,
  bands: Map<number, Set<string>>
): number {
  const sourceCellKey = positionToKey(sourceCell);
  const targetCellKey = positionToKey(targetCell);

  // Gleiche Zelle = kein Decay
  if (sourceCellKey === targetCellKey) return value;

  // 1. Per-Step Decay basierend auf Distanz
  const distance = getDistance(sourceCell, targetCell);
  let decayedValue = value * Math.pow(DECAY_CONSTANTS.PER_STEP, distance);

  // 2. Band-Crossing Decay
  const sourceBand = getCellBand(sourceCellKey, bands);
  const targetBand = getCellBand(targetCellKey, bands);

  // Anzahl überschrittener Band-Grenzen
  const bandsCrossed = Math.abs(targetBand - sourceBand);
  if (bandsCrossed > 0) {
    decayedValue *= Math.pow(DECAY_CONSTANTS.BAND_CROSSING, bandsCrossed);
  }

  return decayedValue;
}

// ============================================================================
// PROPERTY MODIFIER APPLICATION
// ============================================================================

/**
 * Gets a nested property value from an object using a dot-separated path.
 * @param obj The object to read from
 * @param path Dot-separated path like 'range.normal' or 'attack.bonus'
 * @returns The value at the path, or undefined if not found
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Sets a nested property value on an object using a dot-separated path.
 * Creates intermediate objects if needed.
 * @param obj The object to modify
 * @param path Dot-separated path like 'range.normal' or 'attack.bonus'
 * @param value The value to set
 */
function setByPath(obj: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Applies property modifiers to an action, returning a modified copy.
 *
 * This function enables generic modification of any action property via
 * JSON paths (e.g., 'range.normal', 'attack.bonus', 'damage.modifier').
 *
 * Operations:
 * - add: Adds value to current (numeric only)
 * - multiply: Multiplies current by value (numeric only)
 * - set: Replaces current with value
 * - min: Sets to minimum of current and value (numeric only)
 * - max: Sets to maximum of current and value (numeric only)
 *
 * @param action The action to modify
 * @param modifiers Array of property modifiers to apply
 * @returns A new action object with modifications applied
 *
 * @example
 * // Long-Limbed: +5 ft reach on melee attacks
 * applyPropertyModifiers(action, [
 *   { path: 'range.normal', operation: 'add', value: 5 }
 * ]);
 *
 * @example
 * // Magic Weapon: +1 to attack and damage
 * applyPropertyModifiers(action, [
 *   { path: 'attack.bonus', operation: 'add', value: 1 },
 *   { path: 'damage.modifier', operation: 'add', value: 1 }
 * ]);
 */
export function applyPropertyModifiers(
  action: CombatEvent,
  modifiers: PropertyModifier[]
): CombatEvent {
  if (!modifiers.length) return action;

  // Deep clone to avoid mutating the original
  const modified = JSON.parse(JSON.stringify(action)) as CombatEvent;

  for (const mod of modifiers) {
    // Support both legacy 'property' and new 'path' field
    const path = mod.path ?? mod.property;
    if (!path) continue;

    const currentValue = getByPath(modified, path);
    const operation = mod.operation ?? 'set'; // Default to 'set' for legacy modifiers

    switch (operation) {
      case 'add': {
        if (typeof currentValue === 'number' && typeof mod.value === 'number') {
          setByPath(modified, path, currentValue + mod.value);
        } else if (currentValue === undefined && typeof mod.value === 'number') {
          // If path doesn't exist, treat as 0 + value
          setByPath(modified, path, mod.value);
        }
        break;
      }

      case 'multiply': {
        if (typeof currentValue === 'number' && typeof mod.value === 'number') {
          setByPath(modified, path, currentValue * mod.value);
        }
        break;
      }

      case 'set': {
        setByPath(modified, path, mod.value);
        break;
      }

      case 'min': {
        if (typeof currentValue === 'number' && typeof mod.value === 'number') {
          setByPath(modified, path, Math.min(currentValue, mod.value));
        } else if (currentValue === undefined && typeof mod.value === 'number') {
          setByPath(modified, path, mod.value);
        }
        break;
      }

      case 'max': {
        if (typeof currentValue === 'number' && typeof mod.value === 'number') {
          setByPath(modified, path, Math.max(currentValue, mod.value));
        } else if (currentValue === undefined && typeof mod.value === 'number') {
          setByPath(modified, path, mod.value);
        }
        break;
      }
    }
  }

  return modified;
}

// Alias for migration (old name was resolveCombatEventWithBase)
export const resolveCombatEventWithBase = resolveActionWithBase;
export const getCombatEventMaxRangeCells = getActionMaxRangeCells;
