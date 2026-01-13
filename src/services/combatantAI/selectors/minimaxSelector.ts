// Ziel: Minimax Lookahead Selector - Multi-Runden Vorausschau mit Netto-Schaden Evaluation
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// 1. Minimax-Suche über komplette Runden (alle Combatants)
// 2. Evaluation: netDamage = enemyHpLost - allyHpLost
// 3. Gegner-Turns mit Greedy simuliert (vereinfacht)
// 4. Iterative Deepening für Anytime-Verhalten
// 5. Top-K Pruning für tiefere Suche
//
// Vorteile:
// - Plant mehrere Runden voraus (nicht nur eigenen Turn)
// - Berücksichtigt Gegner-Reaktionen
// - Wählt Aktionen die langfristig mehr Schaden austeilen als erleiden

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
import { positionsEqual, getExpectedValue, calculateDeathProbability } from '@/utils';
import { getDistance, getReachableCells } from '../helpers/combatHelpers';
import {
  getPosition,
  getHP,
  getSpeed,
  getAliveCombatants,
  createTurnBudget,
} from '../../combatTracking';
import {
  consumeBudget,
  isBudgetExhausted,
  cloneState,
  projectState,
} from '../core/stateProjection';
import { greedySelector } from './greedySelector';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default max rounds to look ahead */
const DEFAULT_MAX_ROUNDS = 4;

/** Default time limit in ms */
const DEFAULT_TIME_LIMIT = 100;

/** Default top-K candidates to expand at deeper levels */
const DEFAULT_TOP_K = 10;

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

interface MinimaxResult {
  score: number;
  action?: ActionChainEntry;
}

interface RoundState {
  state: CombatantSimulationStateWithLayers;
  currentCombatantIndex: number;
  roundNumber: number;
}

// ============================================================================
// STATS TRACKING
// ============================================================================

let lastStats: SelectorStats = {
  nodesEvaluated: 0,
  elapsedMs: 0,
  maxDepthReached: 0,
  custom: { rounds: 0, pruned: 0, topKApplied: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[minimaxSelector]', ...args);
  }
};

// ============================================================================
// ALLIANCE HELPERS
// ============================================================================

/**
 * Checks if a combatant is allied to the given groupId.
 */
function isAllied(
  groupId: string,
  otherGroupId: string,
  alliances: Record<string, string[]>
): boolean {
  if (groupId === otherGroupId) return true;
  const allies = alliances[groupId] ?? [];
  return allies.includes(otherGroupId);
}

/**
 * Checks if a combatant is hostile to the given groupId.
 */
function isHostile(
  groupId: string,
  otherGroupId: string,
  alliances: Record<string, string[]>
): boolean {
  return !isAllied(groupId, otherGroupId, alliances);
}

// ============================================================================
// EVALUATION FUNCTION
// ============================================================================

/**
 * Evaluates net damage: enemy HP lost - ally HP lost.
 * Positive = good for us (dealt more damage than received).
 */
function evaluateNetDamage(
  initialState: CombatantSimulationStateWithLayers,
  finalState: CombatantSimulationStateWithLayers,
  perspectiveGroupId: string
): number {
  const alliances = initialState.alliances;

  let allyHpLost = 0;
  let enemyHpLost = 0;

  for (const initial of initialState.combatants) {
    const final = finalState.combatants.find(c => c.id === initial.id);
    if (!final) continue;

    const initialHp = getExpectedValue(getHP(initial));
    const finalHp = getExpectedValue(getHP(final));
    const hpLost = initialHp - finalHp;

    if (isAllied(perspectiveGroupId, initial.combatState.groupId, alliances)) {
      allyHpLost += hpLost;
    } else {
      enemyHpLost += hpLost;
    }
  }

  // Positive = good (more enemy damage than ally damage)
  return enemyHpLost - allyHpLost;
}

/**
 * Checks if combat is over (one side eliminated).
 */
function isCombatOver(state: CombatantSimulationStateWithLayers): boolean {
  const alive = getAliveCombatants(state);

  // Check if party side has alive members
  const partyAlive = alive.some(
    c =>
      c.combatState.groupId === 'party' ||
      (state.alliances['party'] ?? []).includes(c.combatState.groupId)
  );

  // Check if enemy side has alive members
  const enemiesAlive = alive.some(
    c =>
      c.combatState.groupId !== 'party' &&
      !(state.alliances['party'] ?? []).includes(c.combatState.groupId)
  );

  return !partyAlive || !enemiesAlive;
}

// ============================================================================
// CANDIDATE GENERATION
// ============================================================================

/**
 * Generates candidates for current state and budget.
 */
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

/**
 * Selects top-K candidates by score.
 */
function selectTopK(candidates: ScoredAction[], k: number): ScoredAction[] {
  if (candidates.length <= k) return candidates;

  return [...candidates].sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Orders candidates with previous best first (move ordering).
 */
function orderByPreviousBest(
  candidates: ScoredAction[],
  previousBest?: ActionChainEntry
): ScoredAction[] {
  if (!previousBest) {
    return [...candidates].sort((a, b) => b.score - a.score);
  }

  const matchesBest = (c: ScoredAction) =>
    c.action.id === previousBest.action.id &&
    c.target?.id === previousBest.target?.id &&
    positionsEqual(c.fromPosition, previousBest.fromPosition);

  const matching = candidates.filter(matchesBest);
  const rest = candidates.filter(c => !matchesBest(c)).sort((a, b) => b.score - a.score);

  return [...matching, ...rest];
}

// ============================================================================
// BUDGET HELPERS
// ============================================================================

/**
 * Gets budget consumption for an action.
 */
function getBudgetConsumption(action: Action): {
  action?: boolean;
  bonusAction?: boolean;
} {
  const isBonusAction = action.timing.type === 'bonus';
  return isBonusAction ? { bonusAction: true } : { action: true };
}

// ============================================================================
// STATE SIMULATION
// ============================================================================

/**
 * Applies an action to state (position update only for simulation).
 * Note: Damage is estimated via score, not actually applied to HP.
 */
function applyActionToState(
  state: CombatantSimulationStateWithLayers,
  combatantId: string,
  action: ActionChainEntry
): CombatantSimulationStateWithLayers {
  return projectState(state, combatantId, {
    position: action.fromPosition,
  });
}

/**
 * Simulates a full turn for a combatant using greedy selector.
 * Returns new state after turn completed.
 */
/** Max actions per turn for simulation safety (prevents infinite loops) */
const MAX_ACTIONS_PER_TURN = 10;

function simulateGreedyTurn(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): { state: CombatantSimulationStateWithLayers; totalDamage: number } {
  let currentState = cloneState(state);
  let budget = createTurnBudget(combatant, state);
  let totalDamage = 0;
  let actionCount = 0;

  // Simulate actions until budget exhausted
  while (!isBudgetExhausted(budget)) {
    // Safety check: prevent infinite loops
    if (actionCount >= MAX_ACTIONS_PER_TURN) {
      debug('simulateGreedyTurn: max actions reached, breaking');
      break;
    }

    const currentCombatant = currentState.combatants.find(
      c => c.id === combatant.id
    ) as CombatantWithLayers | undefined;
    if (!currentCombatant) break;

    const action = greedySelector.selectNextAction(currentCombatant, currentState, budget);
    if (action.type === 'pass') break;

    // Apply position change
    currentState = applyActionToState(currentState, combatant.id, {
      action: action.action,
      target: action.target,
      fromPosition: action.position,
      score: 0,  // Score is internal, not tracked per turn
    });

    // Consume budget
    const consumption = getBudgetConsumption(action.action);
    const movementUsed = getDistance(getPosition(currentCombatant), action.position);
    budget = consumeBudget(budget, {
      ...consumption,
      movementCells: movementUsed,
    });

    actionCount++;
  }

  return { state: currentState, totalDamage };
}

// ============================================================================
// MINIMAX SEARCH
// ============================================================================

// Tracking variables
let nodesEvaluated = 0;
let pruned = 0;
let topKApplied = 0;
let startTime = 0;
let timeLimitMs = DEFAULT_TIME_LIMIT;

/**
 * Minimax search with alpha-beta pruning.
 *
 * @param state Current game state
 * @param depth Remaining depth (in half-moves: our turn = 1, their turn = 1)
 * @param alpha Best score for maximizer
 * @param beta Best score for minimizer
 * @param isMaximizing True if it's our turn (maximize score)
 * @param initialState State at start of search (for evaluation)
 * @param perspectiveGroupId GroupId of the original combatant
 * @param activeCombatant Current combatant to act
 * @param topK Top-K pruning parameter
 * @param previousBest Previous best action for move ordering
 */
function minimax(
  state: CombatantSimulationStateWithLayers,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  initialState: CombatantSimulationStateWithLayers,
  perspectiveGroupId: string,
  activeCombatant: CombatantWithLayers,
  topK: number,
  previousBest?: ActionChainEntry
): MinimaxResult {
  // Time check
  if (performance.now() - startTime >= timeLimitMs) {
    return { score: evaluateNetDamage(initialState, state, perspectiveGroupId) };
  }

  // Terminal: depth reached or combat over
  if (depth === 0 || isCombatOver(state)) {
    return { score: evaluateNetDamage(initialState, state, perspectiveGroupId) };
  }

  if (isMaximizing) {
    // OUR TURN: Maximize net damage
    const budget = createTurnBudget(activeCombatant, state);
    let candidates = generateCandidates(activeCombatant, state, budget);
    nodesEvaluated += candidates.length;

    // No candidates → pass turn
    if (candidates.length === 0) {
      // Simulate opponent turns and evaluate
      const afterOpponents = simulateAllOpponentTurns(
        state,
        perspectiveGroupId
      );
      return minimax(
        afterOpponents,
        depth - 1,
        alpha,
        beta,
        true, // Back to our turn after opponents
        initialState,
        perspectiveGroupId,
        activeCombatant,
        topK
      );
    }

    // Apply Top-K at deeper levels
    if (depth < DEFAULT_MAX_ROUNDS * 2 - 1) {
      const beforeCount = candidates.length;
      candidates = selectTopK(candidates, topK);
      if (candidates.length < beforeCount) topKApplied++;
    }

    // Move ordering
    candidates = orderByPreviousBest(candidates, previousBest);

    let bestScore = -Infinity;
    let bestAction: ActionChainEntry | undefined;

    for (const candidate of candidates) {
      if (candidate.score <= 0) continue;

      const entry: ActionChainEntry = {
        action: candidate.action,
        target: candidate.target,
        fromPosition: candidate.fromPosition,
        targetCell: candidate.targetCell,
        score: candidate.score,
      };

      // Apply action
      const newState = applyActionToState(state, activeCombatant.id, entry);

      // After our action, simulate all opponent turns
      const afterOpponents = simulateAllOpponentTurns(newState, perspectiveGroupId);

      // Recurse (next depth is our next turn after opponents acted)
      const result = minimax(
        afterOpponents,
        depth - 1,
        alpha,
        beta,
        true, // Still maximizing (our perspective)
        initialState,
        perspectiveGroupId,
        activeCombatant,
        topK
      );

      // Add immediate score to future score
      const totalScore = candidate.score + result.score;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAction = entry;
      }

      // Alpha-beta pruning
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) {
        pruned++;
        break;
      }
    }

    if (bestScore === -Infinity) {
      return { score: evaluateNetDamage(initialState, state, perspectiveGroupId) };
    }

    return { score: bestScore, action: bestAction };
  } else {
    // OPPONENT TURN: This path shouldn't be reached with current design
    // (opponents are simulated via simulateAllOpponentTurns)
    return { score: evaluateNetDamage(initialState, state, perspectiveGroupId) };
  }
}

/**
 * Simulates all opponent turns using greedy selector.
 * Returns state after all opponents have acted.
 */
function simulateAllOpponentTurns(
  state: CombatantSimulationStateWithLayers,
  perspectiveGroupId: string
): CombatantSimulationStateWithLayers {
  let currentState = cloneState(state);
  const alliances = state.alliances;

  // Get all alive hostile combatants
  const enemies = getAliveCombatants(currentState).filter(c =>
    isHostile(perspectiveGroupId, c.combatState.groupId, alliances)
  ) as CombatantWithLayers[];

  // Each enemy takes their turn
  for (const enemy of enemies) {
    const result = simulateGreedyTurn(enemy, currentState);
    currentState = result.state;
  }

  return currentState;
}

// ============================================================================
// ITERATIVE DEEPENING
// ============================================================================

/**
 * Iterative deepening wrapper.
 * Increases depth until time limit reached.
 */
function iterativeDeepening(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  maxRounds: number,
  timeLimit: number,
  topK: number
): MinimaxResult {
  startTime = performance.now();
  timeLimitMs = timeLimit;

  let bestResult: MinimaxResult = { score: 0 };
  let depth = 1;
  let completedRounds = 0;

  nodesEvaluated = 0;
  pruned = 0;
  topKApplied = 0;

  const perspectiveGroupId = combatant.combatState.groupId;
  const initialState = cloneState(state);

  // Each "round" = our turn + opponent turns = 1 depth unit
  while (depth <= maxRounds) {
    if (performance.now() - startTime >= timeLimit) {
      debug('time limit reached at depth', depth - 1);
      break;
    }

    const result = minimax(
      state,
      depth,
      -Infinity,
      Infinity,
      true,
      initialState,
      perspectiveGroupId,
      combatant,
      topK,
      bestResult.action
    );

    completedRounds = depth;

    if (result.action && result.score > bestResult.score) {
      bestResult = result;
      debug('improved at depth', {
        depth,
        score: result.score,
        action: result.action?.action.name,
      });
    }

    depth++;
  }

  // Update stats
  lastStats = {
    nodesEvaluated,
    elapsedMs: performance.now() - startTime,
    maxDepthReached: completedRounds,
    custom: { rounds: completedRounds, pruned, topKApplied },
  };

  return bestResult;
}

// ============================================================================
// MINIMAX SELECTOR
// ============================================================================

/**
 * Minimax Lookahead Selector.
 *
 * Uses Minimax search with:
 * - Multi-round lookahead (simulates opponent turns)
 * - Net damage evaluation (enemy HP lost - ally HP lost)
 * - Greedy opponent model (fast simulation)
 * - Iterative deepening (anytime behavior)
 * - Top-K pruning (scalable to deep search)
 * - Alpha-beta pruning (efficient search)
 *
 * Config options:
 * - maxRounds: Max rounds to look ahead (default: 4)
 * - timeLimit: Time budget in ms (default: 100)
 * - topK: Top-K candidates at deeper levels (default: 10)
 */
export const minimaxSelector: ActionSelector = {
  name: 'minimax',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const maxRounds = config?.maxDepth ?? DEFAULT_MAX_ROUNDS;
    const timeLimit = config?.timeLimit ?? DEFAULT_TIME_LIMIT;
    const topK = config?.beamWidth ?? DEFAULT_TOP_K; // Reuse beamWidth for topK

    // Budget exhausted → Pass
    if (isBudgetExhausted(budget)) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: 0,
        maxDepthReached: 0,
        custom: { rounds: 0, pruned: 0, topKApplied: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    // Run iterative deepening minimax
    const result = iterativeDeepening(combatant, state, maxRounds, timeLimit, topK);

    // No action found → Pass
    if (!result.action) {
      debug('no action found, returning pass');
      return { type: 'pass' };
    }

    debug('selected:', {
      combatantId: combatant.id,
      action: result.action.action.name,
      target: result.action.target?.name,
      fromPosition: result.action.fromPosition,
      netScore: result.score,
      stats: lastStats,
    });

    return toTurnAction(result.action);
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
