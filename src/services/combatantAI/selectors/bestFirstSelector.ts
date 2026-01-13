// Ziel: Best-First Search Selector - Priority Queue mit Budget-Limit
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// 1. Initialisiere Priority Queue mit Start-State
// 2. Expandiere besten Knoten (höchster Score)
// 3. Füge Nachfolger zur Queue hinzu
// 4. Wiederhole bis Budget erschöpft oder Queue leer
//
// Vorteile:
// - Natürliche Anytime-Eigenschaft (jederzeit abbrechbar)
// - Fokussiert auf vielversprechende Pfade zuerst
// - Effizienter als depth-first bei breiten Suchräumen

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
import { positionToKey } from '@/utils';
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

/** Default time limit in ms */
const DEFAULT_TIME_LIMIT = 50;

/** Default max nodes to evaluate */
const DEFAULT_MAX_NODES = 500;

// ============================================================================
// TYPES
// ============================================================================

interface SearchNode {
  /** Action chain leading to this node */
  chain: ActionChainEntry[];
  /** Cumulative score */
  score: number;
  /** State at this node */
  state: CombatantSimulationStateWithLayers;
  /** Remaining budget */
  budget: TurnBudget;
  /** Combatant at this node */
  combatant: CombatantWithLayers;
  /** Priority for queue (higher = better) */
  priority: number;
}

interface ActionChainEntry {
  action: Action;
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
  maxDepthReached: 0,
  custom: { queueSize: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[bestFirstSelector]', ...args);
  }
};

// ============================================================================
// PRIORITY QUEUE (Min-Heap, negated for max-priority)
// ============================================================================

class PriorityQueue<T> {
  private heap: { priority: number; item: T }[] = [];

  push(item: T, priority: number): void {
    this.heap.push({ priority, item });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0].item;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority >= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;
      if (left < n && this.heap[left].priority > this.heap[largest].priority) {
        largest = left;
      }
      if (right < n && this.heap[right].priority > this.heap[largest].priority) {
        largest = right;
      }
      if (largest === i) break;
      [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
      i = largest;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
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
 * Applies action to state, returns new state with updated position.
 */
function applyAction(
  state: CombatantSimulationStateWithLayers,
  combatantId: string,
  action: ActionChainEntry
): CombatantSimulationStateWithLayers {
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
} {
  const isBonusAction = action.timing.type === 'bonus';
  return isBonusAction ? { bonusAction: true } : { action: true };
}

// ============================================================================
// BEST-FIRST SELECTOR
// ============================================================================

/**
 * Best-First Search Selector.
 *
 * Uses a priority queue to explore the most promising action chains first.
 * Natural anytime property - can return best result found so far at any time.
 *
 * Advantages over iterative deepening:
 * - Focuses on best paths, not all paths to depth d
 * - More efficient node budget utilization
 * - Graceful degradation under time pressure
 */
export const bestFirstSelector: ActionSelector = {
  name: 'bestFirst',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const startTime = performance.now();
    const timeLimit = config?.timeLimit ?? DEFAULT_TIME_LIMIT;
    const maxNodes = DEFAULT_MAX_NODES;

    let nodesEvaluated = 0;
    let maxDepthReached = 0;

    // Budget exhausted → Pass
    if (isBudgetExhausted(budget)) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: 0,
        maxDepthReached: 0,
        custom: { queueSize: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    // Initialize priority queue with root node
    const queue = new PriorityQueue<SearchNode>();
    const rootNode: SearchNode = {
      chain: [],
      score: 0,
      state,
      budget,
      combatant,
      priority: 0,
    };
    queue.push(rootNode, 0);

    let bestChain: ActionChainEntry[] = [];
    let bestScore = 0;

    // Best-first search loop
    while (queue.size > 0 && nodesEvaluated < maxNodes) {
      // Check time limit
      if (performance.now() - startTime >= timeLimit) {
        debug('time limit reached', { nodesEvaluated, bestScore });
        break;
      }

      const node = queue.pop()!;
      const depth = node.chain.length;

      if (depth > maxDepthReached) {
        maxDepthReached = depth;
      }

      // Generate candidates from this node
      const candidates = generateCandidates(node.combatant, node.state, node.budget);
      nodesEvaluated += candidates.length;

      // Process each candidate
      for (const candidate of candidates) {
        if (candidate.score <= 0) continue;

        const entry: ActionChainEntry = {
          action: candidate.action,
          target: candidate.target,
          fromPosition: candidate.fromPosition,
          targetCell: candidate.targetCell,
          score: candidate.score,
        };

        const newChain = [...node.chain, entry];
        const newScore = node.score + candidate.score;

        // Update best if improved
        if (newScore > bestScore) {
          bestScore = newScore;
          bestChain = newChain;
          debug('new best', { depth: newChain.length, score: newScore });
        }

        // Create child node for further expansion
        const newState = applyAction(node.state, node.combatant.id, entry);
        const newCombatant = newState.combatants.find(c => c.id === node.combatant.id);
        if (!newCombatant) continue;

        const consumption = getBudgetConsumption(candidate.action);
        const movementUsed = getDistance(getPosition(node.combatant), candidate.fromPosition);
        const newBudget = consumeBudget(node.budget, {
          ...consumption,
          movementCells: movementUsed,
        });

        // Only expand if budget remains
        if (!isBudgetExhausted(newBudget)) {
          const childNode: SearchNode = {
            chain: newChain,
            score: newScore,
            state: newState,
            budget: newBudget,
            combatant: newCombatant,
            priority: newScore, // Use cumulative score as priority
          };
          queue.push(childNode, newScore);
        }
      }
    }

    lastStats = {
      nodesEvaluated,
      elapsedMs: performance.now() - startTime,
      maxDepthReached,
      custom: { queueSize: queue.size, bestChainLength: bestChain.length },
    };

    // No valid chain found → Pass
    if (bestChain.length === 0) {
      debug('no chain found, returning pass');
      return { type: 'pass' };
    }

    // Return first action of best chain
    const first = bestChain[0];

    debug('selected:', {
      combatantId: combatant.id,
      action: first.action.name,
      target: first.target?.name,
      fromPosition: first.fromPosition,
      chainLength: bestChain.length,
      totalScore: bestScore,
      stats: lastStats,
    });

    return toTurnAction(first);
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
