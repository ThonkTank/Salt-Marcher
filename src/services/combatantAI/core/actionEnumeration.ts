// Ziel: Action-Enumeration für Combat-AI
// Siehe: docs/services/combatantAI/buildPossibleActions.md
//
// Funktionen:
// - buildPossibleActions(): Generiert alle Action/Target/Position Kombinationen
// - getThreatWeight(): Personality-basierter Threat-Weight (aktuell: fixed 0.5)
// - hasGrantMovementEffect(): Prüft ob Action Movement gewährt
// - getAvailableActionsWithLayers(): Verfügbare Actions für CombatantWithLayers
//
// Re-exports:
// - getCandidates, getEnemies, getAllies aus actionSelection

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Threat-Weight hardcoded auf 0.5
// - getThreatWeight() gibt festen Wert zurück statt personality-basierten
// - Korrekt wäre: PERSONALITY_THREAT_WEIGHTS Lookup
//
// [HACK]: generateCandidates() generiert nur Enemy-Targets
// - Healing/Buff Actions gegen Allies werden nicht generiert
// - Combatants attackieren immer, heilen nie Allies
// - Korrekt wäre: getCandidates() für Healing/Buff mit Ally-Targeting
//
// [HACK]: Reachable Cells ignorieren Difficult Terrain
// - getRelevantCells() × getDistance() berechnen nur Euclidean Distance
// - Difficult Terrain verdoppelt Movement-Kosten nicht
// - Korrekt wäre: TerrainCost-Map integrieren

import type { Action } from '@/types/entities';
import type {
  GridPosition,
  TurnBudget,
  ThreatMapEntry,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
} from '@/types/combat';
import {
  positionToKey,
  getRelevantCells,
  positionsEqual,
} from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isHostile,
} from '../helpers/combatHelpers';
import {
  getGroupId,
  getPosition,
  getAliveCombatants,
} from '../../combatTracking';
import { calculatePairScore } from './actionScoring';
import { isActionUsable } from '../helpers/actionAvailability';
import { standardActions } from '../../../../presets/actions';

// ============================================================================
// RE-EXPORTS (Target Helpers)
// ============================================================================

export { getCandidates, getEnemies, getAllies } from '../helpers/actionSelection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action-Kandidat mit Score für Unified Action Selection.
 * Nur 'action' Typ - 'pass' wird separat behandelt.
 */
export type ScoredAction = {
  type: 'action';
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Gewichtung für Threat-Delta im Score (konfigurierbar). HACK: siehe Header */
const THREAT_WEIGHT = 0.5;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Personality-basierter Threat-Weight.
 * HACK: Aktuell fixed 0.5, später personality-basiert. siehe Header
 */
export function getThreatWeight(_combatant: Combatant): number {
  // FUTURE: Personality-basiert
  // const personality = combatant.personality ?? 'neutral';
  // return PERSONALITY_THREAT_WEIGHTS[personality] ?? 0.5;
  return THREAT_WEIGHT;
}

/**
 * Prüft ob eine Action Movement gewährt (Dash-ähnlich).
 * Effect-basierte Erkennung statt hardcodierter ActionType-Prüfung.
 */
export function hasGrantMovementEffect(action: Action): boolean {
  return action.effects?.some(e => e.grantMovement != null) ?? false;
}

/**
 * Version for CombatantWithLayers that uses _layeredActions.
 * Combines layered actions with standard actions and filters by availability.
 * Supports priorActions context for requirements checking (TWF, Flurry, etc.)
 */
export function getAvailableActionsWithLayers(
  combatant: CombatantWithLayers,
  context: { priorActions?: Action[] } = {}
): Action[] {
  const allActions = [...combatant._layeredActions, ...standardActions];
  return allActions.filter(a => isActionUsable(a, combatant, context));
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert alle Action/Target/Position Kombinationen.
 * Position ist Teil jeder Kombination - kein separates Movement mehr.
 *
 * Für jede erreichbare Position:
 *   Für jede verfügbare Action:
 *     Für jeden gültigen Target:
 *       → Kandidat mit Score
 *
 * Score = actionScore + threatDelta * THREAT_WEIGHT
 * (threatDelta = currentThreat - targetThreat, positiv = Verbesserung)
 */
export function buildPossibleActions(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  threatMap: Map<string, ThreatMapEntry>,
  currentThreat: number
): ScoredAction[] {
  const candidates: ScoredAction[] = [];
  const currentCell = getPosition(combatant);

  // Alle erreichbaren Positionen (inkl. aktueller)
  const reachableCells = [
    currentCell,
    ...getRelevantCells(currentCell, budget.movementCells)
      .filter(cell => !positionsEqual(cell, currentCell))
      .filter(cell => getDistance(currentCell, cell) <= budget.movementCells),
  ];

  // Enemies für Target-Suche (nur LEBENDE Combatants via getAliveCombatants)
  const enemies = getAliveCombatants(state).filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );

  // Alle verfügbaren Actions
  const allAvailableActions = getAvailableActionsWithLayers(combatant, {});

  // Für jede Position: generiere Action/Target Kombinationen
  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);

    // Threat-Delta berechnen (positiv = Verbesserung)
    const targetEntry = threatMap.get(cellKey);
    const targetThreat = targetEntry?.net ?? 0;
    const threatDelta = currentThreat - targetThreat;

    // Virtueller Combatant an dieser Position
    const virtualCombatant: CombatantWithLayers = {
      ...combatant,
      combatState: { ...combatant.combatState, position: cell },
    };

    // Standard-Actions (wenn hasAction)
    if (budget.hasAction) {
      const stdActions = allAvailableActions
        .filter(a => a.timing.type !== 'bonus');

      for (const action of stdActions) {
        // Dash-Action: kein Target, nur Utility-Score
        if (hasGrantMovementEffect(action) && !budget.hasDashed) {
          candidates.push({
            type: 'action',
            action,
            fromPosition: cell,
            score: 0.1 + threatDelta * THREAT_WEIGHT,  // Minimaler Score + Position-Bonus
          });
          continue;
        }

        // Damage-Actions: brauchen Target
        if (action.damage) {
          const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);

          for (const enemy of enemies) {
            const distance = getDistance(cell, getPosition(enemy));
            if (distance > maxRange) continue;

            const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
            if (result && result.score > 0) {
              // Kombinierter Score: Action-Wert + Threat-Delta
              const combinedScore = result.score + threatDelta * THREAT_WEIGHT;
              candidates.push({
                type: 'action',
                action,
                target: enemy,
                fromPosition: cell,
                score: combinedScore,
              });
            }
          }
        }
      }
    }

    // Bonus-Actions (wenn hasBonusAction)
    if (budget.hasBonusAction) {
      const bonusActions = allAvailableActions.filter(a => a.timing.type === 'bonus');

      for (const action of bonusActions) {
        // Dash als Bonus
        if (hasGrantMovementEffect(action) && !budget.hasDashed) {
          candidates.push({
            type: 'action',
            action,
            fromPosition: cell,
            score: 0.1 + threatDelta * THREAT_WEIGHT,
          });
          continue;
        }

        // Damage Bonus-Actions
        if (action.damage) {
          const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);

          for (const enemy of enemies) {
            const distance = getDistance(cell, getPosition(enemy));
            if (distance > maxRange) continue;

            const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
            if (result && result.score > 0) {
              const combinedScore = result.score + threatDelta * THREAT_WEIGHT;
              candidates.push({
                type: 'action',
                action,
                target: enemy,
                fromPosition: cell,
                score: combinedScore,
              });
            }
          }
        }
      }
    }
  }

  return candidates;
}
