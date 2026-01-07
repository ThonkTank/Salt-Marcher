// Ziel: Factored Action Spaces Selector - Dekomposition in Position × Action × BonusAction
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// 1. Positionen ranken (ThreatMap + Enemy-Proximity)
// 2. Für Top-K Positionen: Actions ranken (DPR-Score)
// 3. Beste Kombination wählen
//
// Komplexität: O(P + K×A) statt O(P×A) für K << P

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type { Action } from '@/types/entities';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
  GridPosition,
  Combatant,
  ThreatMapEntry,
} from '@/types/combat';
import { buildThreatMap } from '../layers';
import { getRelevantCells, positionToKey, positionsEqual } from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isHostile,
} from '../helpers/combatHelpers';
import { getGroupId, getPosition } from '../../combatTracking';
import { calculatePairScore } from '../core/actionScoring';
import {
  getAvailableActionsWithLayers,
  hasGrantMovementEffect,
  getThreatWeight,
} from '../core/actionEnumeration';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Top-K Positionen für Beam Search */
const POSITION_BEAM_WIDTH = 5;

/** Top-K Actions pro Position */
const ACTION_BEAM_WIDTH = 3;

// ============================================================================
// TYPES
// ============================================================================

interface RankedPosition {
  cell: GridPosition;
  threatScore: number;        // Negativ = gefährlich, positiv = sicher
  proximityScore: number;     // Nähe zu Enemies (für Melee)
  combinedScore: number;
}

interface RankedAction {
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  score: number;
}

// ============================================================================
// STATS TRACKING
// ============================================================================

let lastStats: SelectorStats = {
  nodesEvaluated: 0,
  elapsedMs: 0,
  custom: { positionsRanked: 0, actionsPerPosition: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[factoredSelector]', ...args);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Phase 1: Positionen ranken (unabhängig von konkreten Actions).
 *
 * Score = threatScore + proximityScore
 * - threatScore: -netThreat aus ThreatMap (negativ = gefährlich)
 * - proximityScore: Nähe zum nächsten Enemy (für Melee-Einheiten)
 */
function rankPositions(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  threatMap: Map<string, ThreatMapEntry>,
  enemies: Combatant[]
): RankedPosition[] {
  const threatWeight = getThreatWeight(combatant);

  return reachableCells.map(cell => {
    const key = positionToKey(cell);
    const entry = threatMap.get(key);
    const threatScore = -(entry?.net ?? 0) * threatWeight;

    // Proximity: Nähe zum nächsten Enemy (1 / distance, max 1.0 für adjacent)
    let minDistance = Infinity;
    for (const enemy of enemies) {
      const dist = getDistance(cell, getPosition(enemy));
      if (dist < minDistance) minDistance = dist;
    }
    const proximityScore = minDistance > 0 ? Math.min(1 / minDistance, 1) : 1;

    return {
      cell,
      threatScore,
      proximityScore,
      combinedScore: threatScore + proximityScore,
    };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
}

/**
 * Phase 2: Actions für eine Position ranken.
 *
 * Erstellt virtuelle Position und bewertet alle Actions mit DPR-Score.
 */
function rankActionsFromPosition(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  position: GridPosition,
  enemies: Combatant[],
  threatMap: Map<string, ThreatMapEntry>,
  currentThreat: number
): RankedAction[] {
  const results: RankedAction[] = [];
  const threatWeight = getThreatWeight(combatant);

  // Virtual combatant at position
  const virtualCombatant: CombatantWithLayers = {
    ...combatant,
    combatState: { ...combatant.combatState, position },
  };

  // Threat delta for this position
  const posKey = positionToKey(position);
  const targetEntry = threatMap.get(posKey);
  const targetThreat = targetEntry?.net ?? 0;
  const threatDelta = currentThreat - targetThreat;

  // Get available actions based on budget
  const allActions = getAvailableActionsWithLayers(virtualCombatant, {});

  // Filter by timing (Action vs Bonus Action)
  const relevantActions = allActions.filter(a => {
    if (a.timing.type === 'bonus') return budget.hasBonusAction;
    return budget.hasAction;
  });

  for (const action of relevantActions) {
    // Dash-like actions: utility score only
    if (hasGrantMovementEffect(action) && !budget.hasDashed) {
      results.push({
        action,
        fromPosition: position,
        score: 0.1 + threatDelta * threatWeight,
      });
      continue;
    }

    // Damage actions need targets
    if (action.damage) {
      const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);

      for (const enemy of enemies) {
        const distance = getDistance(position, getPosition(enemy));
        if (distance > maxRange) continue;

        const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
        if (result && result.score > 0) {
          const combinedScore = result.score + threatDelta * threatWeight;
          results.push({
            action,
            target: enemy,
            fromPosition: position,
            score: combinedScore,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ============================================================================
// FACTORED SELECTOR
// ============================================================================

/**
 * Factored Action Spaces Selector.
 *
 * Dekomposition: Position × Action
 * Statt O(P×A) alle Kombinationen zu evaluieren, wird in zwei Phasen gearbeitet:
 * 1. Positionen ranken O(P)
 * 2. Für Top-K Positionen Actions ranken O(K×A)
 * → Total: O(P + K×A) für K << P
 *
 * Vorteil: Schneller bei vielen Positionen
 * Nachteil: Kann optimale Kombination verpassen wenn Position-Score nicht korreliert
 */
export const factoredSelector: ActionSelector = {
  name: 'factored',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const startTime = performance.now();
    let positionsRanked = 0;
    let actionsEvaluated = 0;

    const beamWidth = config?.beamWidth ?? POSITION_BEAM_WIDTH;

    // Budget exhausted → Pass
    if (!budget.hasAction && !budget.hasBonusAction && budget.movementCells <= 0) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: performance.now() - startTime,
        custom: { positionsRanked: 0, actionsPerPosition: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    const currentCell = getPosition(combatant);

    // Reachable cells
    const reachableCells = [
      currentCell,
      ...getRelevantCells(currentCell, budget.movementCells)
        .filter(cell => !positionsEqual(cell, currentCell))
        .filter(cell => getDistance(currentCell, cell) <= budget.movementCells),
    ];

    // Enemies
    const enemies = state.combatants.filter(c =>
      isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
    );

    // Build ThreatMap
    const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);
    const currentEntry = threatMap.get(positionToKey(currentCell));
    const currentThreat = currentEntry?.net ?? 0;

    // Phase 1: Rank positions
    const rankedPositions = rankPositions(combatant, state, reachableCells, threatMap, enemies);
    positionsRanked = rankedPositions.length;

    // Take top-K positions
    const topPositions = rankedPositions.slice(0, beamWidth);

    debug('phase 1 - positions ranked:', {
      total: positionsRanked,
      topK: topPositions.length,
      top: topPositions.slice(0, 3).map(p => ({
        cell: p.cell,
        score: p.combinedScore.toFixed(2),
      })),
    });

    // Phase 2: Rank actions for top positions
    const allCandidates: RankedAction[] = [];

    for (const pos of topPositions) {
      const actions = rankActionsFromPosition(
        combatant,
        state,
        budget,
        pos.cell,
        enemies,
        threatMap,
        currentThreat
      );

      // Take top-K actions per position
      const topActions = actions.slice(0, ACTION_BEAM_WIDTH);
      actionsEvaluated += actions.length;
      allCandidates.push(...topActions);
    }

    // No candidates → Pass
    if (allCandidates.length === 0) {
      lastStats = {
        nodesEvaluated: actionsEvaluated,
        elapsedMs: performance.now() - startTime,
        custom: { positionsRanked, actionsPerPosition: actionsEvaluated / topPositions.length || 0 },
      };
      debug('no candidates available, returning pass');
      return { type: 'pass' };
    }

    // Phase 3: Select best overall
    allCandidates.sort((a, b) => b.score - a.score);
    const best = allCandidates[0];

    // No positive value → Pass
    if (best.score <= 0) {
      lastStats = {
        nodesEvaluated: actionsEvaluated,
        elapsedMs: performance.now() - startTime,
        custom: { positionsRanked, actionsPerPosition: actionsEvaluated / topPositions.length || 0 },
      };
      debug('best candidate has no value, returning pass');
      return { type: 'pass' };
    }

    lastStats = {
      nodesEvaluated: actionsEvaluated,
      elapsedMs: performance.now() - startTime,
      custom: {
        positionsRanked,
        actionsPerPosition: actionsEvaluated / topPositions.length || 0,
        candidatesAfterBeam: allCandidates.length,
      },
    };

    debug('selected:', {
      combatantId: combatant.id,
      action: best.action.name,
      target: best.target?.name,
      fromPosition: best.fromPosition,
      score: best.score,
      stats: lastStats,
    });

    // Return without score property
    return {
      type: 'action',
      action: best.action,
      target: best.target,
      fromPosition: best.fromPosition,
    };
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
