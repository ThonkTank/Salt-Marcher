// Ziel: Pruning-Heuristiken für Combat-AI Kandidaten-Elimination
// Siehe: docs/services/combatantAI/planNextAction.md
//
// Hauptfunktionen:
// - computeGlobalBestByType(): Berechnet beste Scores pro ActionSlot
// - estimateMaxFollowUpGain(): Schätzt maximalen Gewinn für verbleibendes Budget

import type {
  GlobalBestByType,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
} from '@/types/combat';
import {
  getExpectedValue,
  feetToCell,
  positionToKey,
} from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isHostile,
} from './combatHelpers';
import {
  getGroupId,
  getPosition,
} from '../../combatTracking';
import { calculatePairScore } from '../core/actionScoring';
import { getFullResolution } from '../layers';
import { getAvailableActionsForCombatant } from './actionAvailability';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[pruningHelpers]', ...args);
  }
};

// ============================================================================
// GLOBAL BEST COMPUTATION
// ============================================================================

/**
 * Berechnet globale Best-Scores pro ActionSlot fuer Pruning-Schaetzung.
 * Ermoeglicht aggressive Elimination: Wenn cumulativeValue + maxGain < bestValue * threshold,
 * kann der Kandidat nicht mehr gewinnen und wird eliminiert.
 * Note: Bonus-Action Requirements werden ignoriert (optimistischer Estimate).
 *
 * @param combatant Eigener Combatant (mit Layer-Daten)
 * @param state CombatantSimulationStateWithLayers (mit Layer-Daten)
 * @param escapeDangerMap Map mit Escape-Danger pro Cell
 * @returns GlobalBestByType mit besten Scores pro Slot
 */
export function computeGlobalBestByType(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  escapeDangerMap: Map<string, number>
): GlobalBestByType {
  let bestAction = 0;
  let bestBonusAction = 0;
  let bestMovement = 0;

  // 1. Beste Action-Scores via Layer-System ermitteln
  // Iteriere über alle Damage-Actions und berechne den besten Score gegen alle Enemies
  const enemies = state.combatants.filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );

  for (const action of combatant._layeredActions) {
    if (!action.damage) continue;

    const rangeCells = action._layer?.rangeCells ?? feetToCell(action.range?.long ?? action.range?.normal ?? 5);

    for (const enemy of enemies) {
      const distance = getDistance(getPosition(combatant), getPosition(enemy));

      // Pruning-Heuristik: Nehme an, dass wir optimal positioniert werden können
      // (Movement Budget bereits separat berücksichtigt)
      if (distance <= rangeCells) {
        const resolved = getFullResolution(action, combatant, enemy, state);
        const score = getExpectedValue(resolved.effectiveDamagePMF);
        if (score > bestAction) {
          bestAction = score;
        }
      }
    }
  }

  // 2. Beste Bonus-Action-Scores ermitteln
  // Bonus Actions koennen Requirements haben - wir nehmen konservativ den besten
  // Score unter der Annahme dass Requirements erfuellt werden
  const bonusActions = getAvailableActionsForCombatant(combatant)
    .filter(a => a.timing.type === 'bonus');

  for (const action of bonusActions) {
    // Fuer jede Bonus-Action: Finde besten Score gegen alle Enemies
    const enemies = state.combatants.filter(c =>
      isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
    );

    for (const enemy of enemies) {
      const distance = getDistance(getPosition(combatant), getPosition(enemy));
      const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);
      if (distance <= maxRange) {
        const result = calculatePairScore(combatant, action, enemy, distance, state);
        if (result && result.score > bestBonusAction) {
          bestBonusAction = result.score;
        }
      }
    }
  }

  // 3. Beste Movement-Score (Danger-Reduktion)
  // Die beste Position ist die mit der niedrigsten Escape-Danger
  // Movement-Value = aktuelle Danger - beste erreichbare Danger
  const currentDanger = escapeDangerMap.get(positionToKey(getPosition(combatant))) ?? 0;
  let minDanger = currentDanger;
  for (const danger of escapeDangerMap.values()) {
    if (danger < minDanger) {
      minDanger = danger;
    }
  }
  bestMovement = Math.max(0, currentDanger - minDanger);

  debug('computeGlobalBestByType:', {
    bestAction,
    bestBonusAction,
    bestMovement,
  });

  return {
    action: bestAction,
    bonusAction: bestBonusAction,
    movement: bestMovement,
  };
}

/**
 * Schaetzt den maximalen Gewinn der mit verbleibendem Budget noch moeglich ist.
 * Fuer aggressives Pruning: Wenn current + maxGain < best * threshold → eliminieren.
 */
export function estimateMaxFollowUpGain(
  budget: TurnBudget,
  globalBest: GlobalBestByType
): number {
  let maxGain = 0;
  if (budget.hasAction) maxGain += globalBest.action;
  if (budget.hasBonusAction) maxGain += globalBest.bonusAction;
  if (budget.movementCells > 0) maxGain += globalBest.movement;
  return maxGain;
}
