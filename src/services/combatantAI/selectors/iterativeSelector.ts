// Ziel: Iterative Deepening Selector - Anytime-Suche mit Move Ordering
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// 1. Tiefensuche mit zunehmender Tiefe (depth 1, 2, 3, ...)
// 2. Move Ordering: Beste Aktion aus vorheriger Iteration zuerst prüfen
// 3. Anytime: Kann jederzeit abbrechen mit aktuellem besten Ergebnis
//
// Vorteile:
// - Findet Dash→Attack Kombinationen (die Greedy verpasst)
// - Mehr Zeit = bessere Lösung
// - Nutzt vorherige Iterationen für Move Ordering

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
import { buildPossibleActions, type ScoredAction } from '../core/actionEnumeration';
import { getRelevantCells, positionToKey, positionsEqual } from '@/utils';
import { getDistance } from '../helpers/combatHelpers';
import { getPosition } from '../../combatTracking';
import {
  consumeBudget,
  isBudgetExhausted,
  projectState,
} from '../core/stateProjection';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default time limit in ms */
const DEFAULT_TIME_LIMIT = 50;

/** Default max depth (actions per turn to look ahead) */
const DEFAULT_MAX_DEPTH = 3;

// ============================================================================
// TYPES
// ============================================================================

interface ActionChainEntry {
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
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
  custom: { iterations: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[iterativeSelector]', ...args);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Orders candidates by previous best chain (Move Ordering).
 * Moves candidates that match the previous best to the front.
 */
function orderByPreviousBest(
  candidates: ScoredAction[],
  previousBest: ActionChainEntry[]
): ScoredAction[] {
  if (previousBest.length === 0) {
    // No previous best - sort by score descending
    return [...candidates].sort((a, b) => b.score - a.score);
  }

  const hint = previousBest[0];
  const matchesHint = (c: ScoredAction) =>
    c.action.id === hint.action.id &&
    c.target?.id === hint.target?.id &&
    positionsEqual(c.fromPosition, hint.fromPosition);

  // Partition: matching first, then rest sorted by score
  const matching = candidates.filter(matchesHint);
  const rest = candidates.filter(c => !matchesHint(c)).sort((a, b) => b.score - a.score);

  return [...matching, ...rest];
}

/**
 * Generates candidates for current state and budget.
 * Wrapper around buildPossibleActions that handles ThreatMap setup.
 */
function generateCandidates(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): ScoredAction[] {
  const currentCell = getPosition(combatant);

  // Reachable cells
  const reachableCells = [
    currentCell,
    ...getRelevantCells(currentCell, budget.movementCells)
      .filter(cell => !positionsEqual(cell, currentCell))
      .filter(cell => getDistance(currentCell, cell) <= budget.movementCells),
  ];

  // Build ThreatMap
  const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);
  const currentEntry = threatMap.get(positionToKey(currentCell));
  const currentThreat = currentEntry?.net ?? 0;

  return buildPossibleActions(combatant, state, budget, threatMap, currentThreat);
}

/**
 * Simulates applying an action to the state.
 * Returns new state with updated positions/HP.
 */
function applyActionToState(
  state: CombatantSimulationStateWithLayers,
  combatantId: string,
  action: ActionChainEntry
): CombatantSimulationStateWithLayers {
  // Project state with new position
  return projectState(state, combatantId, {
    position: action.fromPosition,
  });
}

/**
 * Calculates budget consumption for an action.
 */
function getBudgetConsumption(action: Action): {
  action?: boolean;
  bonusAction?: boolean;
  dash?: boolean;
} {
  const isBonusAction = action.timing.type === 'bonus';
  const isDash = action.effects?.some(e => e.grantMovement != null) ?? false;

  if (isDash) {
    return isBonusAction ? { bonusAction: true, dash: true } : { dash: true };
  }

  return isBonusAction ? { bonusAction: true } : { action: true };
}

// ============================================================================
// DEPTH-LIMITED SEARCH
// ============================================================================

let nodesEvaluated = 0;

/**
 * Recursive depth-limited search.
 * Explores action chains up to specified depth.
 *
 * @param combatant - Active combatant
 * @param state - Current simulation state
 * @param budget - Remaining turn budget
 * @param depth - Remaining depth to search
 * @param previousBest - Previous best chain for move ordering
 * @returns Best chain found and its total score
 */
function depthLimitedSearch(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  depth: number,
  previousBest: ActionChainEntry[]
): SearchResult {
  // Terminal: budget exhausted or depth reached
  if (isBudgetExhausted(budget) || depth === 0) {
    return { chain: [], score: 0 };
  }

  // Generate candidates
  const candidates = generateCandidates(combatant, state, budget);
  nodesEvaluated += candidates.length;

  // No candidates available
  if (candidates.length === 0) {
    return { chain: [], score: 0 };
  }

  // Move ordering
  const ordered = orderByPreviousBest(candidates, previousBest);

  let best: SearchResult = { chain: [], score: -Infinity };

  for (const candidate of ordered) {
    // Skip non-positive score actions
    if (candidate.score <= 0) continue;

    const entry: ActionChainEntry = {
      action: candidate.action,
      target: candidate.target,
      fromPosition: candidate.fromPosition,
      score: candidate.score,
    };

    // Simulate action
    const newState = applyActionToState(state, combatant.id, entry);

    // Update combatant position in new state
    const newCombatant = newState.combatants.find(c => c.id === combatant.id);
    if (!newCombatant) continue;

    // Consume budget
    const consumption = getBudgetConsumption(candidate.action);
    const movementUsed = getDistance(getPosition(combatant), candidate.fromPosition);
    const newBudget = consumeBudget(budget, {
      ...consumption,
      movementCells: movementUsed,
    });

    // Recurse
    const subResult = depthLimitedSearch(
      newCombatant,
      newState,
      newBudget,
      depth - 1,
      previousBest.slice(1)
    );

    // Total score = this action + future actions
    const totalScore = candidate.score + subResult.score;

    if (totalScore > best.score) {
      best = {
        chain: [entry, ...subResult.chain],
        score: totalScore,
      };
    }
  }

  // If no positive actions found, return empty chain
  if (best.score === -Infinity) {
    return { chain: [], score: 0 };
  }

  return best;
}

// ============================================================================
// ITERATIVE DEEPENING
// ============================================================================

/**
 * Main iterative deepening loop.
 * Increases depth each iteration until time limit reached.
 */
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

  while (depth <= maxDepth) {
    // Check time limit
    if (performance.now() - startTime >= timeLimit) {
      debug('time limit reached', { iterations, depth: depth - 1 });
      break;
    }

    // Run depth-limited search
    const result = depthLimitedSearch(
      combatant,
      state,
      budget,
      depth,
      bestResult.chain
    );

    iterations++;

    // Update best if improved
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

  // Update stats
  lastStats = {
    nodesEvaluated,
    elapsedMs: performance.now() - startTime,
    maxDepthReached: depth - 1,
    custom: { iterations },
  };

  return bestResult;
}

// ============================================================================
// ITERATIVE SELECTOR
// ============================================================================

/**
 * Iterative Deepening Selector.
 *
 * Uses iterative deepening with move ordering to find the best action chain.
 * Returns only the first action of the chain (action-by-action pattern).
 *
 * Vorteile:
 * - Anytime: Mehr Zeit = bessere Lösung
 * - Findet Dash→Attack Kombinationen (die Greedy verpasst)
 * - Move Ordering beschleunigt Konvergenz
 *
 * Konfiguration (via SelectorConfig):
 * - timeLimit: Maximale Rechenzeit in ms (default: 50)
 * - maxDepth: Maximale Suchtiefe (default: 3)
 */
export const iterativeSelector: ActionSelector = {
  name: 'iterative',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const timeLimit = config?.timeLimit ?? DEFAULT_TIME_LIMIT;
    const maxDepth = config?.maxDepth ?? DEFAULT_MAX_DEPTH;

    // Budget exhausted → Pass
    if (isBudgetExhausted(budget)) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: 0,
        maxDepthReached: 0,
        custom: { iterations: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    // Run iterative deepening
    const result = iterativeDeepening(combatant, state, budget, timeLimit, maxDepth);

    // No chain found → Pass
    if (result.chain.length === 0) {
      debug('no chain found, returning pass');
      return { type: 'pass' };
    }

    // Return first action of chain
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

    return {
      type: 'action',
      action: first.action,
      target: first.target,
      fromPosition: first.fromPosition,
    };
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
