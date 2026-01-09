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
import { positionToKey } from '@/utils';
import { getDistance, getReachableCells } from '../helpers/combatHelpers';
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

    // Alle erreichbaren Positionen für ThreatMap (mit Bounds-Enforcement)
    const reachableCells = getReachableCells(currentCell, budget.movementCells, {
      terrainMap: state.terrainMap,
      combatant,
      state,
      bounds: state.mapBounds,
    });

    // ThreatMap einmal pro Turn berechnen
    const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);

    // Generiere alle Action/Target/Position Kombinationen
    const candidates = buildPossibleActions(combatant, state, budget, threatMap);
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

    // TurnAction mit Score zurückgeben
    return {
      type: 'action',
      action: bestCandidate.action,
      target: bestCandidate.target,
      fromPosition: bestCandidate.fromPosition,
      targetCell: bestCandidate.targetCell,
      score: bestCandidate.score,
    };
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
