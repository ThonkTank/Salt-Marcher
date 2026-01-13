// Ziel: Random ActionSelector - wählt zufällige Aktion aus Kandidaten
// Siehe: docs/services/combatantAI/combatantAI.md

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
} from '@/types/combat';
import { buildPossibleActions, toTurnAction } from '../core';
import { buildThreatMap } from '../layers';
import { positionToKey, randomSelect } from '@/utils';
import { getReachableCells } from '../helpers/combatHelpers';
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
    console.log('[randomSelector]', ...args);
  }
};

// ============================================================================
// RANDOM SELECTOR
// ============================================================================

/**
 * Random Selector - Statistischer Baseline für Combat-AI.
 * Wählt zufällig aus allen Action/Target/Position-Kombinationen mit score > 0.
 *
 * Algorithmus:
 * 1. Budget-Check → Pass wenn erschöpft
 * 2. ThreatMap berechnen für erreichbare Zellen
 * 3. Kandidaten generieren (alle Action/Target/Position Kombinationen)
 * 4. Nur Kandidaten mit score > 0 filtern
 * 5. Zufällig aus validen Kandidaten wählen
 * 6. Pass wenn keine validen Kandidaten
 */
export const randomSelector: ActionSelector = {
  name: 'random',

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

    // Nur Kandidaten mit positivem Score
    const validCandidates = candidates.filter(c => c.score > 0);

    // Keine validen Aktionen verfügbar → Pass
    if (validCandidates.length === 0) {
      lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };
      debug('no valid candidates available, returning pass');
      return { type: 'pass' };
    }

    // Zufällig aus validen Kandidaten wählen
    const selected = randomSelect(validCandidates);

    // Sollte nie passieren bei validCandidates.length > 0, aber TypeScript braucht den Check
    if (!selected) {
      lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };
      debug('randomSelect returned null, returning pass');
      return { type: 'pass' };
    }

    lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };

    debug('selected:', {
      combatantId: combatant.id,
      action: selected.action.name,
      target: selected.target?.name,
      fromPosition: selected.fromPosition,
      score: selected.score,
      nodesEvaluated,
      validCandidates: validCandidates.length,
      elapsedMs: lastStats.elapsedMs.toFixed(2),
    });

    return toTurnAction(selected);
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
