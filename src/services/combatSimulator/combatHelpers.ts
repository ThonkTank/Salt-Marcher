// Ziel: Gemeinsame Helper-Funktionen für Combat-AI und Combat-Resolver
// Siehe: docs/services/combatSimulator/
//
// Konsolidiert duplizierte Logik:
// - Damage/Healing PMF Berechnung
// - Range-Extraktion (Multiattack-aware)
// - Distance/Position Helpers
// - Action-Iteration mit Multiattack-Expansion

import type { Action } from '@/types/entities';
import {
  type ProbabilityDistribution,
  type GridPosition,
  diceExpressionToPMF,
  addConstant,
  getDistance as gridGetDistance,
  feetToCell,
} from '@/utils';

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
 * Konsolidiert: calculateMovement, getNearestEnemy
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
