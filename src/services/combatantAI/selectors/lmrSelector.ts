// Ziel: Late Move Reduction Selector - Reduzierte Suchtiefe für späte Moves
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// Basiert auf iterative deepening, aber:
// 1. Erste N Moves (gut gerankt) werden mit voller Tiefe gesucht
// 2. Spätere Moves (schlechter gerankt) werden mit reduzierter Tiefe gesucht
// 3. Wenn reduzierte Suche unerwartet gut ist, re-search mit voller Tiefe
//
// Vorteile:
// - Reduziert Branching-Faktor um 30-50%
// - Behält Qualität bei gut gerankten Moves
// - Etablierte Technik aus Schachprogrammierung

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type { Action } from '@/types/entities';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
  GridPosition,
  Combatant,
} from '@/types/combat';
import { buildThreatMap } from '../layers';
import { buildPossibleActions, toTurnAction, type ScoredAction } from '../core/actionEnumeration';
import { positionToKey, positionsEqual } from '@/utils';
import { getDistance, getReachableCells } from '../helpers/combatHelpers';
import { getPosition } from '../../combatTracking';
import {
  consumeBudget,
  isBudgetExhausted,
  projectState,
} from '../core/stateProjection';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIME_LIMIT = 50;
const DEFAULT_MAX_DEPTH = 3;

/** Number of moves to search at full depth before reducing */
const FULL_DEPTH_MOVES = 4;

/** Depth reduction for late moves */
const REDUCTION_AMOUNT = 1;

/** Threshold to trigger re-search (if reduced search beats current best by this margin) */
const RESEARCH_THRESHOLD = 0.8;

// ============================================================================
// TYPES
// ============================================================================

interface ActionChainEntry {
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
}

interface SearchResult {
  chain: ActionChainEntry[];
  score: number;
}

// ============================================================================
// STATS TRACKING
// ============================================================================

let lastStats: SelectorStats = {
  nodesEvaluated: 0,
  elapsedMs: 0,
  maxDepthReached: 0,
  custom: { iterations: 0, reductions: 0, researches: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[lmrSelector]', ...args);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateCandidates(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): ScoredAction[] {
  const currentCell = getPosition(combatant);
  const reachableCells = getReachableCells(currentCell, budget.movementCells, {
    terrainMap: state.terrainMap,
    combatant,
    state,
    bounds: state.mapBounds,
  });
  const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);

  return buildPossibleActions(combatant, state, budget, threatMap);
}

function orderByPreviousBest(
  candidates: ScoredAction[],
  previousBest: ActionChainEntry[]
): ScoredAction[] {
  if (previousBest.length === 0) {
    return [...candidates].sort((a, b) => b.score - a.score);
  }

  const hint = previousBest[0];
  const matchesHint = (c: ScoredAction) =>
    c.action.id === hint.action.id &&
    c.target?.id === hint.target?.id &&
    positionsEqual(c.fromPosition, hint.fromPosition);

  const matching = candidates.filter(matchesHint);
  const rest = candidates.filter(c => !matchesHint(c)).sort((a, b) => b.score - a.score);

  return [...matching, ...rest];
}

function applyActionToState(
  state: CombatantSimulationStateWithLayers,
  combatantId: string,
  action: ActionChainEntry
): CombatantSimulationStateWithLayers {
  return projectState(state, combatantId, {
    position: action.fromPosition,
  });
}

function getBudgetConsumption(action: Action): {
  action?: boolean;
  bonusAction?: boolean;
} {
  const isBonusAction = action.timing.type === 'bonus';
  return isBonusAction ? { bonusAction: true } : { action: true };
}

// ============================================================================
// LMR DEPTH-LIMITED SEARCH
// ============================================================================

let nodesEvaluated = 0;
let reductions = 0;
let researches = 0;

function lmrSearch(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  depth: number,
  previousBest: ActionChainEntry[],
  isReducedSearch: boolean = false
): SearchResult {
  if (isBudgetExhausted(budget) || depth === 0) {
    return { chain: [], score: 0 };
  }

  const candidates = generateCandidates(combatant, state, budget);
  nodesEvaluated += candidates.length;

  if (candidates.length === 0) {
    return { chain: [], score: 0 };
  }

  const ordered = orderByPreviousBest(candidates, previousBest);

  let best: SearchResult = { chain: [], score: -Infinity };
  let moveIndex = 0;

  for (const candidate of ordered) {
    if (candidate.score <= 0) continue;

    const entry: ActionChainEntry = {
      action: candidate.action,
      target: candidate.target,
      fromPosition: candidate.fromPosition,
      targetCell: candidate.targetCell,
      score: candidate.score,
    };

    const newState = applyActionToState(state, combatant.id, entry);
    const newCombatant = newState.combatants.find(c => c.id === combatant.id);
    if (!newCombatant) continue;

    const consumption = getBudgetConsumption(candidate.action);
    const movementUsed = getDistance(getPosition(combatant), candidate.fromPosition);
    const newBudget = consumeBudget(budget, {
      ...consumption,
      movementCells: movementUsed,
    });

    // LMR: Determine search depth for this move
    let searchDepth = depth - 1;
    const isLateMoveCandidate = moveIndex >= FULL_DEPTH_MOVES && depth > 1 && !isReducedSearch;

    if (isLateMoveCandidate) {
      // Reduce depth for late moves
      searchDepth = Math.max(0, depth - 1 - REDUCTION_AMOUNT);
      reductions++;
    }

    let subResult = lmrSearch(
      newCombatant,
      newState,
      newBudget,
      searchDepth,
      previousBest.slice(1),
      isLateMoveCandidate
    );

    let totalScore = candidate.score + subResult.score;

    // Re-search if reduced search found something promising
    if (isLateMoveCandidate && totalScore > best.score * RESEARCH_THRESHOLD) {
      // Full-depth re-search
      researches++;
      subResult = lmrSearch(
        newCombatant,
        newState,
        newBudget,
        depth - 1,
        previousBest.slice(1),
        false
      );
      totalScore = candidate.score + subResult.score;
    }

    if (totalScore > best.score) {
      best = {
        chain: [entry, ...subResult.chain],
        score: totalScore,
      };
    }

    moveIndex++;
  }

  if (best.score === -Infinity) {
    return { chain: [], score: 0 };
  }

  return best;
}

// ============================================================================
// ITERATIVE DEEPENING WITH LMR
// ============================================================================

function iterativeDeepening(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  timeLimit: number,
  maxDepth: number
): SearchResult {
  const startTime = performance.now();
  let bestResult: SearchResult = { chain: [], score: 0 };
  let depth = 1;
  let iterations = 0;

  nodesEvaluated = 0;
  reductions = 0;
  researches = 0;

  while (depth <= maxDepth) {
    if (performance.now() - startTime >= timeLimit) {
      debug('time limit reached', { iterations, depth: depth - 1 });
      break;
    }

    const result = lmrSearch(
      combatant,
      state,
      budget,
      depth,
      bestResult.chain
    );

    iterations++;

    if (result.score > bestResult.score) {
      bestResult = result;
      debug('improved at depth', {
        depth,
        score: result.score,
        chainLength: result.chain.length,
      });
    }

    depth++;
  }

  lastStats = {
    nodesEvaluated,
    elapsedMs: performance.now() - startTime,
    maxDepthReached: depth - 1,
    custom: { iterations, reductions, researches },
  };

  return bestResult;
}

// ============================================================================
// LMR SELECTOR
// ============================================================================

/**
 * Late Move Reduction Selector.
 *
 * Uses iterative deepening with late move reductions:
 * - First N moves (well-ranked) searched at full depth
 * - Later moves searched at reduced depth
 * - Re-search if reduced search finds something promising
 *
 * Expected 30-50% branching factor reduction while maintaining quality.
 * Standard technique from chess programming (Stockfish, etc.).
 */
export const lmrSelector: ActionSelector = {
  name: 'lmr',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const timeLimit = config?.timeLimit ?? DEFAULT_TIME_LIMIT;
    const maxDepth = config?.maxDepth ?? DEFAULT_MAX_DEPTH;

    if (isBudgetExhausted(budget)) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: 0,
        maxDepthReached: 0,
        custom: { iterations: 0, reductions: 0, researches: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    const result = iterativeDeepening(combatant, state, budget, timeLimit, maxDepth);

    if (result.chain.length === 0) {
      debug('no chain found, returning pass');
      return { type: 'pass' };
    }

    const first = result.chain[0];

    debug('selected:', {
      combatantId: combatant.id,
      action: first.action.name,
      target: first.target?.name,
      fromPosition: first.fromPosition,
      chainLength: result.chain.length,
      totalScore: result.score,
      stats: lastStats,
    });

    return toTurnAction(first);
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
