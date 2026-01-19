// Ziel: CombatEvent-Enumeration für Combat-AI
// Siehe: docs/services/combatantAI/buildPossibleCombatEvents.md
//
// Funktionen:
// - buildPossibleCombatEvents(): Generiert alle CombatEvent/Target/Position Kombinationen
// - getThreatWeight(): Personality-basierter Threat-Weight (aktuell: fixed 0.5)
// - hasGrantMovementEffect(): Prüft ob CombatEvent Movement gewährt
// - getAvailableCombatEventsWithLayers(): Verfügbare CombatEvents für CombatantWithLayers
//
// Re-exports:
// - getCandidates, getEnemies, getAllies aus actionSelection
//
// Movement-Bewertung:
// - OpportunityMap: Bewertet Aktions-Potential von jeder Position
// - ThreatMap: Bewertet Sicherheit von jeder Position
// - Distance Decay: Projiziert Werte auf umliegende Zellen

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Threat-Weight hardcoded auf 1.0
// - getThreatWeight() gibt festen Wert zurück statt personality-basierten
// - Korrekt wäre: PERSONALITY_THREAT_WEIGHTS Lookup
//
// [HACK]: generateCandidates() generiert nur Enemy-Targets
// - Healing/Buff CombatEvents gegen Allies werden nicht generiert
// - Combatants attackieren immer, heilen nie Allies
// - Korrekt wäre: getCandidates() für Healing/Buff mit Ally-Targeting
//

import type { CombatEvent } from '@/types/entities/combatEvent';
import type {
  GridPosition,
  TurnBudget,
  ThreatMapEntry,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnCombatEvent,
} from '@/types/combat';
import { positionToKey, getExpectedValue, diceExpressionToPMF, addConstant } from '@/utils';
import { hasLineOfSight } from '@/utils/squareSpace/gridLineOfSight';
import {
  getCombatEventMaxRangeCells,
  getDistance,
  getReachableCells,
  isHostile,
  calculateMultiattackDamage,
  calculateHitChance,
  multiattackHasMeleeOption,
  multiattackHasRangedOption,
} from '../helpers/combatHelpers';
import {
  getGroupId,
  getPosition,
  getAliveCombatants,
  getAC,
  hasGrantMovementEffect,
  hasToTargetMovementCost,
  getMovementRange,
} from '../../combatTracking';
import { calculatePairScore } from './actionScoring';
import { isCombatEventUsable, getEscapeCombatEventsForCombatant } from '../helpers/actionAvailability';
import { standardCombatEvents } from '../../../../presets/actions';
import { getOpportunityAt } from '../layers/threatMap';

// ============================================================================
// RE-EXPORTS (Target Helpers + Movement Helpers)
// ============================================================================

export { getCandidates, getEnemies, getAllies } from '../helpers/actionSelection';

// Re-export from combatTracking for consumers that import from core/
export { hasGrantMovementEffect } from '../../combatTracking';

// ============================================================================
// TYPES
// ============================================================================

/**
 * CombatEvent-Kandidat mit Score für Unified CombatEvent Selection.
 * Nur 'action' Typ - 'pass' wird separat behandelt.
 */
export type ScoredCombatEvent = {
  type: 'action';
  action: CombatEvent;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
};

/**
 * Konvertiert ein CombatEvent-Kandidat-Objekt zu TurnCombatEvent.
 * Akzeptiert ScoredCombatEvent oder interne Typen (CombatEventChainEntry, CombatEventEntry).
 * Zentralisiert die Konvertierung für alle Selectors.
 */
export function toTurnCombatEvent(
  scored: { action: CombatEvent; target?: Combatant; fromPosition: GridPosition }
): TurnCombatEvent {
  return {
    type: 'action',
    action: scored.action,
    target: scored.target,
    position: scored.fromPosition,
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Gewichtung für Threat-Delta im Score. */
const THREAT_WEIGHT = 1.0;

/** Gewichtung für Opportunity-Delta im Score. */
const OPPORTUNITY_WEIGHT = 1.0;

/** Discount für Future-Turn Opportunity (0.5 damit CombatEvents nicht von Movement dominiert werden). */
const FUTURE_DISCOUNT = 0.5;

/**
 * Threshold für Approach-Bonus Aktivierung.
 * Wenn Melee-DPR / Ranged-DPR > Threshold, wird Annäherung belohnt.
 * Bei 1.5: Melee muss 50% besser sein als Ranged.
 */
const APPROACH_BONUS_THRESHOLD = 1.5;

/**
 * Multiplikator für Approach-Bonus bei Movement Richtung Gegner.
 * Wird auf (meleeDPR - rangedDPR) × (closedDistance / totalDistance) angewendet.
 */
const APPROACH_BONUS_MULTIPLIER = 0.5;

/**
 * Intrinsischer Bonus für produktive CombatEvents (Damage/Healing/Control).
 * Verhindert dass Movement-only höher scored als verfügbare Angriffe.
 * Konservativ gewählt: CombatEvents leicht bevorzugt, Movement bleibt relevant.
 */
const ACTION_INTRINSIC_BONUS = 1.8;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Personality-basierter Threat-Weight.
 * HACK: Aktuell fixed 1.0, später personality-basiert. siehe Header
 */
export function getThreatWeight(_combatant: Combatant): number {
  // FUTURE: Personality-basiert
  // const personality = combatant.personality ?? 'neutral';
  // return PERSONALITY_THREAT_WEIGHTS[personality] ?? 1.0;
  return THREAT_WEIGHT;
}

/** Ergebnis von calculateMeleeRangedDPRRatio() */
export interface MeleeRangedDPRRatio {
  meleeDPR: number;
  rangedDPR: number;
  ratio: number;
}

/**
 * Berechnet das Verhältnis von Melee-DPR zu Ranged-DPR.
 * Wert > 1 bedeutet: Melee ist besser als Ranged.
 *
 * Berücksichtigt Multiattack-CombatEvents korrekt:
 * - Multiattack mit Melee-Refs wird als Melee gewertet
 * - Damage wird mit Hit-Chance gegen targetAC berechnet
 *
 * @param combatant Der Combatant dessen DPR-Ratio berechnet wird
 * @param targetAC Die AC des typischen Gegners
 * @returns { meleeDPR, rangedDPR, ratio }
 */
export function calculateMeleeRangedDPRRatio(
  combatant: CombatantWithLayers,
  targetAC: number
): MeleeRangedDPRRatio {
  const actions = combatant._layeredCombatEvents ?? [];

  let meleeDPR = 0;
  let rangedDPR = 0;

  for (const action of actions) {
    // Skip non-damage actions
    if (!action.damage && !action.multiattack) continue;

    // Multiattack: Berechne kombinierte DPR und prüfe ob Melee oder Ranged
    // Mit orRef kann ein Multiattack BEIDE Optionen haben (z.B. Greatsword or Longbow)
    if (action.multiattack) {
      const pmf = calculateMultiattackDamage(action, actions, targetAC);
      if (!pmf) continue;

      const expectedDmg = getExpectedValue(pmf);

      // Prüfe ob Multiattack Melee- und/oder Ranged-Optionen hat (inkl. orRef)
      const hasMelee = multiattackHasMeleeOption(action, actions);
      const hasRanged = multiattackHasRangedOption(action, actions);

      // Multiattack trägt zu beiden Kategorien bei wenn beide Optionen verfügbar
      if (hasMelee) {
        meleeDPR = Math.max(meleeDPR, expectedDmg);
      }
      if (hasRanged) {
        rangedDPR = Math.max(rangedDPR, expectedDmg);
      }
      continue;
    }

    // Einzelne CombatEvent
    if (!action.damage) continue;

    const range = action.range?.normal ?? 5;
    const isMelee = range <= 5;

    // Berechne expected damage mit Hit-Chance
    const baseDamagePMF = addConstant(
      diceExpressionToPMF(action.damage.dice),
      action.damage.modifier
    );
    const baseDamage = getExpectedValue(baseDamagePMF);

    let expectedDmg = baseDamage;
    if (action.attack) {
      const hitChance = calculateHitChance(action.attack.bonus, targetAC);
      expectedDmg = baseDamage * hitChance;
    }

    if (isMelee) {
      meleeDPR = Math.max(meleeDPR, expectedDmg);
    } else {
      rangedDPR = Math.max(rangedDPR, expectedDmg);
    }
  }

  // Ratio berechnen (Infinity wenn nur Melee, 1 wenn beide 0)
  const ratio = rangedDPR > 0
    ? meleeDPR / rangedDPR
    : (meleeDPR > 0 ? Infinity : 1);

  return { meleeDPR, rangedDPR, ratio };
}

// Movement helpers imported from combatTracking/movement.ts:
// - hasGrantMovementEffect
// - hasToTargetMovementCost
// - getMovementRange

/**
 * Prüft ob CombatEvent das entsprechende Timing-Budget hat.
 */
export function hasTimingBudget(action: CombatEvent, budget: TurnBudget): boolean {
  if (!action.timing) return true; // Legacy actions without timing are always available
  switch (action.timing.type) {
    case 'action': return budget.hasAction;
    case 'bonus': return budget.hasBonusAction;
    case 'free': return true;
    default: return false;
  }
}

/**
 * Version for CombatantWithLayers that uses _layeredCombatEvents.
 * Combines layered actions with standard actions and dynamic escape actions.
 * Filters by availability and supports priorActions context for requirements checking.
 */
export function getAvailableCombatEventsWithLayers(
  combatant: CombatantWithLayers,
  context: { priorActions?: CombatEvent[] } = {}
): CombatEvent[] {
  // Dynamic escape actions for until-escape conditions (grappled, restrained, etc.)
  const escapeCombatEvents = getEscapeCombatEventsForCombatant(combatant);
  const allCombatEvents = [...combatant._layeredCombatEvents ?? [], ...standardCombatEvents, ...escapeCombatEvents];
  return allCombatEvents.filter(a => isCombatEventUsable(a, combatant, context));
}

/**
 * Berechnet verbleibendes Budget nach Ausführung einer Aktion.
 * Wird für remainingOpportunity-Berechnung benötigt.
 */
export function subtractCombatEventCost(budget: TurnBudget, action: CombatEvent): TurnBudget {
  const result = { ...budget };

  if (!action.timing) return result; // Legacy actions without timing don't consume budget

  switch (action.timing.type) {
    case 'action':
      result.hasAction = false;
      break;
    case 'bonus':
      result.hasBonusAction = false;
      break;
    case 'reaction':
      result.hasReaction = false;
      break;
    // 'free' und 'passive' verbrauchen kein CombatEvent-Budget
  }

  return result;
}

/**
 * Erstellt ein frisches Budget für nächsten Turn.
 * Für Future-Opportunity Berechnung bei positionsverändernden CombatEvents.
 */
function getFreshBudget(baseBudget: TurnBudget): TurnBudget {
  return {
    hasAction: true,
    hasBonusAction: true,
    hasReaction: true,
    movementCells: baseBudget.baseMovementCells,
    baseMovementCells: baseBudget.baseMovementCells,
  };
}

/**
 * Berechnet kombinierte Opportunity für eine Position.
 * Kombiniert "was kann ich JETZT noch tun" + "was kann ich NÄCHSTEN Turn tun".
 *
 * @param cell Ziel-Position
 * @param combatant Virtueller Combatant an der Position
 * @param remainingBudget Budget nach der aktuellen CombatEvent
 * @param isMoving True wenn Position sich ändert (für futureOpportunity)
 * @param state Combat State
 * @returns Kombinierter Opportunity-Score (bereits gewichtet)
 */
function calculatePositionOpportunity(
  cell: GridPosition,
  combatant: CombatantWithLayers,
  remainingBudget: TurnBudget,
  isMoving: boolean,
  state: CombatantSimulationStateWithLayers
): number {
  // Was kann ich DIESEN Turn noch tun?
  const remainingOpportunity = getOpportunityAt(cell, combatant, remainingBudget, state);

  // Was kann ich NÄCHSTEN Turn tun? (nur bei Positionswechsel relevant)
  const futureOpportunity = isMoving
    ? getOpportunityAt(cell, combatant, getFreshBudget(remainingBudget), state)
    : 0;

  return remainingOpportunity * OPPORTUNITY_WEIGHT
       + futureOpportunity * FUTURE_DISCOUNT * OPPORTUNITY_WEIGHT;
}

/**
 * Erreichbare Cells für Non-Movement CombatEvents.
 * Aktuelle Cell + alle Cells erreichbar mit Movement-Budget.
 * Nutzt terrain-aware Pathfinding wenn terrainMap vorhanden.
 */
function getCellsForCombatEvent(
  currentCell: GridPosition,
  budget: TurnBudget,
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): GridPosition[] {
  if (budget.movementCells <= 0) return [currentCell];

  // Terrain-aware Pathfinding mit Map-Bounds wenn vorhanden
  return getReachableCells(currentCell, budget.movementCells, {
    terrainMap: state.terrainMap,
    combatant,
    state,
    bounds: state.mapBounds,
  });
}

/**
 * Enemies in CombatEvent-Range von einer Cell.
 * Prüft Line of Sight wenn terrainMap vorhanden.
 */
function getEnemiesInRangeFrom(
  cell: GridPosition,
  action: CombatEvent,
  enemies: Combatant[],
  allCombatEvents: CombatEvent[],
  state: CombatantSimulationStateWithLayers
): Combatant[] {
  const maxRange = getCombatEventMaxRangeCells(action, allCombatEvents);

  return enemies.filter(enemy => {
    const enemyPos = getPosition(enemy);

    // LoS-Check (wenn terrainMap vorhanden)
    if (state.terrainMap && !hasLineOfSight(cell, enemyPos, maxRange, state.terrainMap)) {
      return false;
    }

    const distance = getDistance(cell, enemyPos);
    return distance <= maxRange;
  });
}

/**
 * Virtueller Combatant an einer anderen Cell.
 */
function withPosition(
  combatant: CombatantWithLayers,
  cell: GridPosition
): CombatantWithLayers {
  return {
    ...combatant,
    combatState: { ...combatant.combatState, position: cell },
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert alle CombatEvent/Target/Cell Kombinationen mit Unified Scoring.
 *
 * Komponenten-basierte Evaluation: Jede CombatEvent wird anhand ihrer individuellen
 * Eigenschaften evaluiert - keine künstlichen Kategorien.
 *
 * Komponenten-Fragen:
 * - Braucht Budget? → hasTimingBudget()
 * - Braucht targetCell? → hasToTargetMovementCost()
 * - Braucht enemy target? → action.damage != null
 *
 * Unified Score = actionScore + positionThreat + remainingOpportunity
 */
export function buildPossibleCombatEvents(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  threatMap: Map<string, ThreatMapEntry>,
  options?: { skipScoring?: boolean }
): ScoredCombatEvent[] {
  const skipScoring = options?.skipScoring ?? false;
  const candidates: ScoredCombatEvent[] = [];
  const currentCell = getPosition(combatant);

  // Alle verfügbaren CombatEvents
  const allCombatEvents = getAvailableCombatEventsWithLayers(combatant, {});

  // Enemies für Target-Suche (nur LEBENDE Combatants)
  const enemies = getAliveCombatants(state).filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );

  // =========================================================================
  // Approach-Bonus Berechnung (Melee vs Ranged DPR) - nur wenn Scoring aktiv
  // =========================================================================
  let hasApproachAdvantage = false;
  let dprRatio = { meleeDPR: 0, rangedDPR: 0, ratio: 0 };
  if (!skipScoring) {
    const avgEnemyAC = enemies.length > 0
      ? enemies.reduce((sum, e) => sum + getAC(e), 0) / enemies.length
      : 15;
    dprRatio = calculateMeleeRangedDPRRatio(combatant, avgEnemyAC);
    hasApproachAdvantage = dprRatio.ratio > APPROACH_BONUS_THRESHOLD;
  }

  // =========================================================================
  // Current Position Threat (für Delta-basiertes Movement-Scoring)
  // =========================================================================
  const currentCellKey = positionToKey(currentCell);
  const currentThreat = threatMap.get(currentCellKey)?.net ?? 0;

  // Helper: Berechnet Approach-Bonus für eine Cell
  const calculateApproachBonus = (cell: GridPosition): number => {
    if (!hasApproachAdvantage || enemies.length === 0) return 0;

    // Finde nächsten Gegner und berechne Distanz-Änderung
    let minCurrentDist = Infinity;
    let minNewDist = Infinity;

    for (const enemy of enemies) {
      const enemyPos = getPosition(enemy);
      const currentDist = getDistance(currentCell, enemyPos);
      const newDist = getDistance(cell, enemyPos);

      if (newDist < minNewDist) {
        minNewDist = newDist;
        minCurrentDist = currentDist;
      }
    }

    // Nur Bonus wenn wir näher kommen
    if (minNewDist >= minCurrentDist) return 0;

    const dprGain = dprRatio.meleeDPR - dprRatio.rangedDPR;
    const cellsClosed = minCurrentDist - minNewDist;
    const progress = cellsClosed / Math.max(1, minCurrentDist);

    return dprGain * APPROACH_BONUS_MULTIPLIER * progress;
  };

  // =========================================================================
  // Komponenten-basierte Evaluation: Für jede CombatEvent
  // =========================================================================
  for (const action of allCombatEvents) {
    // 1. Budget-Check
    if (!hasTimingBudget(action, budget)) continue;

    // 2. Komponenten bestimmen
    const needsTargetCell = hasToTargetMovementCost(action);
    const needsEnemyTarget = action.damage != null;
    // const needsAllyTarget = action.healing != null;  // HACK: siehe Header

    // 3. Kandidaten generieren basierend auf Komponenten
    if (needsTargetCell) {
      // =====================================================================
      // Movement-Komponente vorhanden (Move, Dash, Misty Step, Thunder Step)
      // =====================================================================
      const range = getMovementRange(action, budget, combatant);
      const reachable = getReachableCells(currentCell, range, {
        terrainMap: state.terrainMap,
        combatant,
        state,
        bounds: state.mapBounds,
      });

      for (const cell of reachable) {
        const distanceToCell = getDistance(currentCell, cell);
        if (distanceToCell === 0) continue;  // Skip current cell

        const virtualCombatant = withPosition(combatant, cell);
        const cellKey = positionToKey(cell);
        const positionThreat = threatMap.get(cellKey)?.net ?? 0;
        const remainingBudget = subtractCombatEventCost(budget, action);

        if (needsEnemyTarget) {
          // Movement + Damage (Thunder Step)
          const enemiesInRange = getEnemiesInRangeFrom(cell, action, enemies, combatant._layeredCombatEvents ?? [], state);

          for (const enemy of enemiesInRange) {
            if (skipScoring) {
              // Nur Kandidaten generieren, kein Scoring
              candidates.push({
                type: 'action',
                action,
                target: enemy,
                fromPosition: currentCell,
                targetCell: cell,
                score: 0,
              });
            } else {
              const distance = getDistance(cell, getPosition(enemy));
              const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);

              if (result && result.score > 0) {
                const remainingOpportunity = getOpportunityAt(cell, virtualCombatant, remainingBudget, state);
                const approachBonus = calculateApproachBonus(cell);
                const score = result.score
                  + ACTION_INTRINSIC_BONUS
                  + positionThreat * THREAT_WEIGHT
                  + remainingOpportunity * OPPORTUNITY_WEIGHT
                  + approachBonus;

                candidates.push({
                  type: 'action',
                  action,
                  target: enemy,
                  fromPosition: currentCell,
                  targetCell: cell,
                  score,
                });
              }
            }
          }
        } else {
          // Reines Movement (Move, Dash, Misty Step)
          if (skipScoring) {
            // Alle erreichbaren Zellen als Kandidaten
            candidates.push({
              type: 'action',
              action,
              fromPosition: currentCell,
              targetCell: cell,
              score: 0,
            });
          } else {
            // Delta-basiert: Score = Verbesserung gegenüber aktueller Position
            // WICHTIG: Beide mit isMoving=false für faire Vergleichbarkeit!
            // (futureOpportunity würde beide Richtungen gleich boosten → Oszillation)
            const currentOpportunityAfterMove = getOpportunityAt(
              currentCell, combatant, remainingBudget, state
            );
            const currentValueAfterMove = currentThreat * THREAT_WEIGHT
              + currentOpportunityAfterMove * OPPORTUNITY_WEIGHT;

            const targetOpportunity = getOpportunityAt(
              cell, virtualCombatant, remainingBudget, state
            );
            const approachBonus = calculateApproachBonus(cell);
            const targetValue = positionThreat * THREAT_WEIGHT
              + targetOpportunity * OPPORTUNITY_WEIGHT;
            const improvement = targetValue - currentValueAfterMove;
            const score = improvement + approachBonus;

            // Movement nur wenn Verbesserung ODER approach-Vorteil
            if (score > 0 || approachBonus > 0) {
              candidates.push({
                type: 'action',
                action,
                fromPosition: currentCell,
                targetCell: cell,
                score: Math.max(0.1, score),  // Mindest-Score für Approach-Kandidaten
              });
            }
          }
        }
      }
    } else if (needsEnemyTarget) {
      // =====================================================================
      // Reine Attack-CombatEvent (Longsword, Fireball, etc.)
      // =====================================================================
      const cellsForCombatEvent = getCellsForCombatEvent(currentCell, budget, combatant, state);

      for (const cell of cellsForCombatEvent) {
        const enemiesInRange = getEnemiesInRangeFrom(cell, action, enemies, combatant._layeredCombatEvents ?? [], state);

        for (const enemy of enemiesInRange) {
          if (skipScoring) {
            // Nur Kandidaten generieren, kein Scoring
            candidates.push({
              type: 'action',
              action,
              target: enemy,
              fromPosition: cell,
              score: 0,
            });
          } else {
            const isMoving = getDistance(currentCell, cell) > 0;
            const virtualCombatant = withPosition(combatant, cell);
            const cellKey = positionToKey(cell);
            const positionThreat = threatMap.get(cellKey)?.net ?? 0;
            const remainingBudget = subtractCombatEventCost(budget, action);

            const opportunityScore = calculatePositionOpportunity(
              cell, virtualCombatant, remainingBudget, isMoving, state
            );

            const distance = getDistance(cell, getPosition(enemy));
            const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);

            if (result && result.score > 0) {
              const approachBonus = isMoving ? calculateApproachBonus(cell) : 0;
              const score = result.score
                + ACTION_INTRINSIC_BONUS
                + positionThreat * THREAT_WEIGHT
                + opportunityScore
                + approachBonus;

              candidates.push({
                type: 'action',
                action,
                target: enemy,
                fromPosition: cell,
                score,
              });
            }
          }
        }
      }
    } else {
      // =====================================================================
      // Self-buff, Dodge, Help, Escape, etc. (keine Targets)
      // =====================================================================
      if (skipScoring) {
        // Nur Kandidat generieren
        candidates.push({
          type: 'action',
          action,
          fromPosition: currentCell,
          score: 0,
        });
      } else {
        const cellKey = positionToKey(currentCell);
        const positionThreat = threatMap.get(cellKey)?.net ?? 0;
        const remainingBudget = subtractCombatEventCost(budget, action);
        const remainingOpportunity = getOpportunityAt(currentCell, combatant, remainingBudget, state);

        // Escape CombatEvents: Use calculatePairScore for proper escape scoring
        if (action._escapeCondition) {
          // Escape targets self, so use combatant as both attacker and target
          const escapeScore = calculatePairScore(combatant, action, combatant, 0, state);
          if (escapeScore && escapeScore.score > 0) {
            // Add position value to escape score
            const score = escapeScore.score
              + positionThreat * THREAT_WEIGHT
              + remainingOpportunity * OPPORTUNITY_WEIGHT;

            candidates.push({
              type: 'action',
              action,
              fromPosition: currentCell,
              score,
            });
          }
        } else {
          // Standard Self-CombatEvents: nur Opportunity-Wert
          const score = positionThreat * THREAT_WEIGHT + remainingOpportunity * OPPORTUNITY_WEIGHT;

          if (score > 0) {
            candidates.push({
              type: 'action',
              action,
              fromPosition: currentCell,
              score,
            });
          }
        }
      }
    }
  }

  return candidates;
}

// ============================================================================
// ALIASES FOR MIGRATION
// ============================================================================

/** @deprecated Use ScoredCombatEvent instead */
export type ScoredAction = ScoredCombatEvent;

/** @deprecated Use toTurnCombatEvent instead */
export const toTurnAction = toTurnCombatEvent;

/** @deprecated Use buildPossibleCombatEvents instead */
export const buildPossibleActions = buildPossibleCombatEvents;

/** @deprecated Use subtractCombatEventCost instead */
export const subtractActionCost = subtractCombatEventCost;
