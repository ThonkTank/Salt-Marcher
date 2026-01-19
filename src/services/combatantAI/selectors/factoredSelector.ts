// Ziel: Factored CombatEvent Spaces Selector - Dekomposition in Position × CombatEvent × BonusAction
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// 1. Positionen ranken (ThreatMap + Enemy-Proximity)
// 2. Für Top-K Positionen: Actions ranken (DPR-Score)
// 3. Beste Kombination wählen
//
// Komplexität: O(P + K×A) statt O(P×A) für K << P

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type { CombatEvent } from '@/types/entities/combatEvent';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
  GridPosition,
  Combatant,
  ThreatMapEntry,
} from '@/types/combat';
import { buildThreatMap, getOpportunityAt } from '../layers';
import { toTurnCombatEvent } from '../core/actionEnumeration';
import { positionToKey } from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  getReachableCells,
} from '../helpers/combatHelpers';
import { getEnemies } from '../helpers/actionSelection';
import { getPosition } from '../../combatTracking';
import { calculatePairScore } from '../core/actionScoring';
import {
  getAvailableCombatEventsWithLayers,
  hasGrantMovementEffect,
  getThreatWeight,
  subtractCombatEventCost,
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
  opportunityScore: number;   // CombatEvent-Potential an dieser Position
  combinedScore: number;
}

interface RankedAction {
  action: CombatEvent;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
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
 * Score = threatScore + opportunityScore
 * - threatScore: -netThreat aus ThreatMap (negativ = gefährlich)
 * - opportunityScore: CombatEvent-Potential mit verbleibendem Budget nach Movement
 */
function rankPositions(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  threatMap: Map<string, ThreatMapEntry>,
  budget: TurnBudget
): RankedPosition[] {
  const threatWeight = getThreatWeight(combatant);
  const currentCell = getPosition(combatant);

  return reachableCells.map(cell => {
    const key = positionToKey(cell);
    const entry = threatMap.get(key);
    const threatScore = -(entry?.net ?? 0) * threatWeight;

    // Remaining movement after reaching this cell
    const distanceToCell = getDistance(currentCell, cell);
    const remainingMovement = Math.max(0, budget.movementCells - distanceToCell);

    // Budget reflecting what we can still do from this position
    const positionBudget: TurnBudget = {
      hasAction: budget.hasAction,
      hasBonusAction: budget.hasBonusAction,
      hasReaction: budget.hasReaction,
      movementCells: remainingMovement,
      baseMovementCells: budget.baseMovementCells,
    };

    // Virtual combatant at this position for opportunity calculation
    const virtualCombatant: CombatantWithLayers = {
      ...combatant,
      combatState: { ...combatant.combatState, position: cell },
    };

    // Opportunity: CombatEvent-Potential an dieser Position mit verbleibendem Budget
    const opportunityScore = getOpportunityAt(cell, virtualCombatant, positionBudget, state);

    return {
      cell,
      threatScore,
      opportunityScore,
      combinedScore: threatScore + opportunityScore,
    };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
}

/**
 * Phase 2: Actions für eine Position ranken.
 *
 * Unified Scoring: actionScore + positionThreat + remainingOpportunity
 * - actionScore: DPR-basierter Wert der Aktion
 * - positionThreat: Wie gefährlich ist die Position? (absolut)
 * - remainingOpportunity: Was kann ich NOCH tun nach dieser Aktion?
 */
function rankActionsFromPosition(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  position: GridPosition,
  enemies: Combatant[],
  threatMap: Map<string, ThreatMapEntry>
): RankedAction[] {
  const results: RankedAction[] = [];
  const threatWeight = getThreatWeight(combatant);
  const opportunityWeight = 0.5; // Same as in actionEnumeration

  // Virtual combatant at position
  const virtualCombatant: CombatantWithLayers = {
    ...combatant,
    combatState: { ...combatant.combatState, position },
  };

  // Absolute threat at this position
  const posKey = positionToKey(position);
  const posEntry = threatMap.get(posKey);
  const positionThreat = posEntry?.net ?? 0;

  // Get available actions based on budget
  const allActions = getAvailableCombatEventsWithLayers(virtualCombatant, {});

  // Filter by timing (CombatEvent vs Bonus CombatEvent)
  const relevantActions = allActions.filter(a => {
    if (a.timing?.type === 'bonus') return budget.hasBonusAction;
    return budget.hasAction;
  });

  for (const action of relevantActions) {
    // Budget nach dieser Aktion
    const remainingBudget = subtractCombatEventCost(budget, action);

    // Opportunity mit verbleibendem Budget
    const remainingOpportunity = getOpportunityAt(position, virtualCombatant, remainingBudget, state);

    // Dash-like actions: no direct damage, only position value
    if (hasGrantMovementEffect(action)) {
      const score = positionThreat * threatWeight + remainingOpportunity * opportunityWeight;
      if (score > 0) {
        results.push({
          action,
          fromPosition: position,
          score,
        });
      }
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
          // Unified Score
          const score = result.score
            + positionThreat * threatWeight
            + remainingOpportunity * opportunityWeight;

          results.push({
            action,
            target: enemy,
            fromPosition: position,
            score,
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
 * Factored CombatEvent Spaces Selector.
 *
 * Dekomposition: Position × CombatEvent
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

    // Reachable cells (mit Bounds-Enforcement)
    const reachableCells = getReachableCells(currentCell, budget.movementCells, {
      terrainMap: state.terrainMap,
      combatant,
      state,
      bounds: state.mapBounds,
    });

    // Enemies (via zentralem getEnemies Helper)
    const enemies = getEnemies(combatant, state);

    // Build ThreatMap
    const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);

    // Phase 1: Rank positions
    const rankedPositions = rankPositions(combatant, state, reachableCells, threatMap, budget);
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
        threatMap
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

    return toTurnCombatEvent(best);
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
