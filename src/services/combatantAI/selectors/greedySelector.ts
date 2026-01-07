// Ziel: Greedy ActionSelector - wählt Aktion mit höchstem Score
// Siehe: docs/services/combatantAI/findBestMove.md

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
} from '@/types/combat';
import { buildPossibleActions } from '../core';
import { buildThreatMap } from '../layers';
import { getRelevantCells, positionToKey, positionsEqual } from '@/utils';
import { getDistance } from '../helpers/combatHelpers';
import { getPosition } from '../../combatTracking';

// ============================================================================
// STATS TRACKING
// ============================================================================

let lastStats: SelectorStats = { nodesEvaluated: 0, elapsedMs: 0 };

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[greedySelector]', ...args);
  }
};

// ============================================================================
// GREEDY SELECTOR
// ============================================================================

/**
 * Greedy Selector - Baseline für Combat-AI.
 * Evaluiert alle Action/Target/Position-Kombinationen und wählt die mit dem höchsten Score.
 *
 * Algorithmus:
 * 1. Budget-Check → Pass wenn erschöpft
 * 2. ThreatMap berechnen für erreichbare Zellen
 * 3. Kandidaten generieren (alle Action/Target/Position Kombinationen)
 * 4. Beste Aktion wählen (höchster Score)
 * 5. Pass wenn beste Score ≤ 0
 */
export const greedySelector: ActionSelector = {
  name: 'greedy',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    _config?: SelectorConfig
  ): TurnAction {
    const startTime = performance.now();
    let nodesEvaluated = 0;

    // Wenn kein Budget mehr verfügbar → Pass
    if (!budget.hasAction && !budget.hasBonusAction && budget.movementCells <= 0) {
      lastStats = { nodesEvaluated: 0, elapsedMs: performance.now() - startTime };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    const currentCell = getPosition(combatant);

    // Alle erreichbaren Positionen für ThreatMap
    const reachableCells = [
      currentCell,
      ...getRelevantCells(currentCell, budget.movementCells)
        .filter(cell => !positionsEqual(cell, currentCell))
        .filter(cell => getDistance(currentCell, cell) <= budget.movementCells),
    ];

    // ThreatMap einmal pro Turn berechnen
    const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);

    // Current Threat (für Delta-Berechnung)
    const currentEntry = threatMap.get(positionToKey(currentCell));
    const currentThreat = currentEntry?.net ?? 0;

    // Generiere alle Action/Target/Position Kombinationen
    const candidates = buildPossibleActions(combatant, state, budget, threatMap, currentThreat);
    nodesEvaluated = candidates.length;

    // Keine Aktionen verfügbar → Pass
    if (candidates.length === 0) {
      lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };
      debug('no candidates available, returning pass');
      return { type: 'pass' };
    }

    // Finde beste Aktion (Greedy: höchster Score)
    let bestCandidate = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].score > bestCandidate.score) {
        bestCandidate = candidates[i];
      }
    }

    // Wenn beste Aktion keinen positiven Wert hat → Pass
    if (bestCandidate.score <= 0) {
      lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };
      debug('best candidate has no value, returning pass');
      return { type: 'pass' };
    }

    lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };

    debug('selected:', {
      combatantId: combatant.id,
      action: bestCandidate.action.name,
      target: bestCandidate.target?.name,
      fromPosition: bestCandidate.fromPosition,
      score: bestCandidate.score,
      nodesEvaluated,
      elapsedMs: lastStats.elapsedMs.toFixed(2),
    });

    // Entferne Score-Property für return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { score, ...action } = bestCandidate;
    return action as TurnAction;
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
