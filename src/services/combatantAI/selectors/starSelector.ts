// Ziel: Star1 Selector - Alpha-Beta mit Chance Nodes (Expectimax-Optimierung)
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// Star1/Star2 (Ballard 1983) optimiert Expectimax durch Probing:
// 1. An Chance-Knoten: Probe mit optimistischem/pessimistischem Bound
// 2. Wenn Probe außerhalb [alpha, beta]: Cutoff möglich
// 3. Sonst: Vollständige Expansion nötig
//
// Für D&D vereinfacht (kein Gegner-Turn modelliert):
// - Chance Nodes = Würfelergebnisse (Hit/Miss)
// - Wir samplen Outcomes statt alle zu expandieren
// - Weighted Average basierend auf Hit-Chance
//
// Vorteile:
// - Exponentiell besser als naive Expectimax
// - Modelliert Unsicherheit explizit
// - Cutoffs an Chance Nodes möglich

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
import { positionToKey, positionsEqual, getExpectedValue, diceExpressionToPMF, addConstant } from '@/utils';
import { getDistance, getReachableCells, calculateHitChance } from '../helpers/combatHelpers';
import { getPosition, getAC } from '../../combatTracking';
import {
  consumeBudget,
  isBudgetExhausted,
  projectState,
} from '../core/stateProjection';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIME_LIMIT = 50;
const DEFAULT_MAX_DEPTH = 2; // Shallower due to chance nodes

/** Number of samples for chance node evaluation */
const CHANCE_SAMPLES = 3;

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
  custom: { iterations: 0, chanceCutoffs: 0, fullExpansions: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[starSelector]', ...args);
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
// CHANCE NODE EVALUATION
// ============================================================================

let chanceCutoffs = 0;
let fullExpansions = 0;

/**
 * Evaluates a chance node (action with uncertain outcome).
 * Uses Star1-style probing: check if bounds allow cutoff.
 *
 * For D&D:
 * - Attack actions have hit/miss outcomes
 * - Hit probability based on attack bonus vs AC
 * - Damage varies based on dice roll
 */
function evaluateChanceNode(
  candidate: ScoredAction,
  alpha: number,
  beta: number
): { score: number; cutoff: boolean } {
  const action = candidate.action;
  const target = candidate.target;

  // Non-attack actions: deterministic score
  if (!action.attack || !target) {
    return { score: candidate.score, cutoff: false };
  }

  // Calculate hit probability
  const hitChance = calculateHitChance(action.attack.bonus, getAC(target));
  const missChance = 1 - hitChance;

  // Calculate damage outcomes
  let hitDamage = 0;
  if (action.damage) {
    const damagePMF = addConstant(
      diceExpressionToPMF(action.damage.dice),
      action.damage.modifier
    );
    hitDamage = getExpectedValue(damagePMF);
  }

  // Expected value = hitChance * hitDamage + missChance * 0
  const expectedScore = hitChance * hitDamage;

  // Star1 probing:
  // Optimistic bound: assume always hit (upper bound)
  const optimistic = hitDamage;
  // Pessimistic bound: assume always miss (lower bound)
  const pessimistic = 0;

  // Check for cutoffs
  if (optimistic <= alpha) {
    // Even best case can't beat alpha - cutoff
    chanceCutoffs++;
    return { score: pessimistic, cutoff: true };
  }

  if (pessimistic >= beta) {
    // Even worst case beats beta - cutoff
    chanceCutoffs++;
    return { score: optimistic, cutoff: true };
  }

  // Need full evaluation
  fullExpansions++;
  return { score: expectedScore, cutoff: false };
}

// ============================================================================
// STAR1 ALPHA-BETA SEARCH
// ============================================================================

let nodesEvaluated = 0;

function starSearch(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  depth: number,
  alpha: number,
  beta: number,
  previousBest: ActionChainEntry[]
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
  let currentAlpha = alpha;

  for (const candidate of ordered) {
    if (candidate.score <= 0) continue;

    // Evaluate chance node with current bounds
    const chanceResult = evaluateChanceNode(candidate, currentAlpha, beta);

    // If cutoff at chance node, skip
    if (chanceResult.cutoff) {
      continue;
    }

    const entry: ActionChainEntry = {
      action: candidate.action,
      target: candidate.target,
      fromPosition: candidate.fromPosition,
      targetCell: candidate.targetCell,
      score: chanceResult.score,
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

    // Recurse with updated bounds
    const subResult = starSearch(
      newCombatant,
      newState,
      newBudget,
      depth - 1,
      currentAlpha - chanceResult.score,
      beta - chanceResult.score,
      previousBest.slice(1)
    );

    const totalScore = chanceResult.score + subResult.score;

    if (totalScore > best.score) {
      best = {
        chain: [entry, ...subResult.chain],
        score: totalScore,
      };

      // Update alpha
      if (totalScore > currentAlpha) {
        currentAlpha = totalScore;
      }

      // Beta cutoff
      if (totalScore >= beta) {
        break;
      }
    }
  }

  if (best.score === -Infinity) {
    return { chain: [], score: 0 };
  }

  return best;
}

// ============================================================================
// ITERATIVE DEEPENING
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
  chanceCutoffs = 0;
  fullExpansions = 0;

  while (depth <= maxDepth) {
    if (performance.now() - startTime >= timeLimit) {
      debug('time limit reached', { iterations, depth: depth - 1 });
      break;
    }

    const result = starSearch(
      combatant,
      state,
      budget,
      depth,
      -Infinity,
      Infinity,
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
    custom: { iterations, chanceCutoffs, fullExpansions },
  };

  return bestResult;
}

// ============================================================================
// STAR SELECTOR
// ============================================================================

/**
 * Star1 Alpha-Beta Selector.
 *
 * Implements Star1 algorithm (Ballard 1983) which optimizes Expectimax
 * by enabling alpha-beta style cutoffs at chance nodes.
 *
 * Key insight: If optimistic bound <= alpha or pessimistic bound >= beta,
 * we can prune the chance node without full evaluation.
 *
 * For D&D combat:
 * - Chance nodes model hit/miss uncertainty
 * - Probing uses hit probability bounds
 * - Exponentially better than naive Expectimax
 *
 * Limitations:
 * - Shallower depth than deterministic search (chance nodes add branching)
 * - Simplified model (no opponent turn modeling)
 */
export const starSelector: ActionSelector = {
  name: 'star',

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
        custom: { iterations: 0, chanceCutoffs: 0, fullExpansions: 0 },
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
