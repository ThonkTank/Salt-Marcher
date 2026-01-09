// Ziel: UCB1 Selector - Flat Monte Carlo mit Upper Confidence Bound
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Algorithmus:
// Multi-Armed Bandit Ansatz ohne Tree-Aufbau:
// 1. Enumerate alle Kandidaten-Aktionen
// 2. Iterativ: Wähle Aktion nach UCB1 Formel
// 3. Simuliere Ergebnis (vereinfacht: nutze Score + Rauschen)
// 4. Update Statistiken für gewählte Aktion
// 5. Wähle Aktion mit höchstem durchschnittlichem Reward
//
// UCB1 Formel: Q(a) + c * sqrt(ln(N) / n(a))
// - Q(a) = Durchschnittlicher Reward für Aktion a
// - N = Gesamtzahl der Iterationen
// - n(a) = Anzahl der Auswahlen von Aktion a
// - c = Exploration-Konstante (typisch sqrt(2))
//
// Vorteile:
// - Einfach zu implementieren
// - Balanciert Exploration vs Exploitation automatisch
// - Robust gegen Rauschen im Scoring

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
} from '@/types/combat';
import { buildThreatMap } from '../layers';
import { buildPossibleActions, type ScoredAction } from '../core/actionEnumeration';
import { positionToKey } from '@/utils';
import { getReachableCells } from '../helpers/combatHelpers';
import { getPosition } from '../../combatTracking';
import { isBudgetExhausted } from '../core/stateProjection';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default number of iterations */
const DEFAULT_ITERATIONS = 100;

/** Default time limit in ms */
const DEFAULT_TIME_LIMIT = 30;

/** Exploration constant (sqrt(2) is theoretically optimal) */
const EXPLORATION_CONSTANT = Math.sqrt(2);

/** Noise factor for simulated rewards (as fraction of score) */
const NOISE_FACTOR = 0.2;

// ============================================================================
// TYPES
// ============================================================================

interface ArmStats {
  /** Number of times this arm was pulled */
  pulls: number;
  /** Sum of rewards */
  totalReward: number;
  /** Average reward (Q value) */
  avgReward: number;
}

// ============================================================================
// STATS TRACKING
// ============================================================================

let lastStats: SelectorStats = {
  nodesEvaluated: 0,
  elapsedMs: 0,
  custom: { iterations: 0, bestPulls: 0, explorationPct: 0 },
};

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[ucbSelector]', ...args);
  }
};

// ============================================================================
// UCB1 FUNCTIONS
// ============================================================================

/**
 * Calculates UCB1 value for an arm.
 * UCB1 = Q(a) + c * sqrt(ln(N) / n(a))
 */
function calculateUCB1(stats: ArmStats, totalPulls: number): number {
  if (stats.pulls === 0) {
    return Infinity; // Unpulled arms have infinite UCB (must explore)
  }
  const exploitation = stats.avgReward;
  const exploration = EXPLORATION_CONSTANT * Math.sqrt(Math.log(totalPulls) / stats.pulls);
  return exploitation + exploration;
}

/**
 * Selects arm with highest UCB1 value.
 */
function selectArmUCB1(armStats: ArmStats[], totalPulls: number): number {
  let bestArm = 0;
  let bestUCB = -Infinity;

  for (let i = 0; i < armStats.length; i++) {
    const ucb = calculateUCB1(armStats[i], totalPulls);
    if (ucb > bestUCB) {
      bestUCB = ucb;
      bestArm = i;
    }
  }

  return bestArm;
}

/**
 * Simulates a reward for an action (score + noise).
 */
function simulateReward(baseScore: number): number {
  // Add Gaussian-like noise using Box-Muller approximation
  const u1 = Math.random();
  const u2 = Math.random();
  const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return baseScore + noise * baseScore * NOISE_FACTOR;
}

/**
 * Updates arm statistics with new reward.
 */
function updateArmStats(stats: ArmStats, reward: number): void {
  stats.pulls++;
  stats.totalReward += reward;
  stats.avgReward = stats.totalReward / stats.pulls;
}

// ============================================================================
// UCB SELECTOR
// ============================================================================

/**
 * UCB1 Multi-Armed Bandit Selector.
 *
 * Treats action selection as a multi-armed bandit problem:
 * - Each candidate action is an "arm"
 * - UCB1 formula balances exploration vs exploitation
 * - Simulates rewards with noise to estimate true action value
 *
 * Advantages:
 * - Robust against noisy scoring functions
 * - Automatic exploration/exploitation balance
 * - No tree building overhead
 * - Anytime property (more iterations = better estimate)
 *
 * Use when:
 * - Scoring has high variance
 * - Want stochastic behavior (non-deterministic)
 * - Simple single-action decision (no lookahead needed)
 */
export const ucbSelector: ActionSelector = {
  name: 'ucb',

  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction {
    const startTime = performance.now();
    const timeLimit = config?.timeLimit ?? DEFAULT_TIME_LIMIT;
    const maxIterations = DEFAULT_ITERATIONS;

    // Budget exhausted → Pass
    if (isBudgetExhausted(budget)) {
      lastStats = {
        nodesEvaluated: 0,
        elapsedMs: 0,
        custom: { iterations: 0, bestPulls: 0, explorationPct: 0 },
      };
      debug('no budget remaining, returning pass');
      return { type: 'pass' };
    }

    // Generate candidates (mit Bounds-Enforcement)
    const currentCell = getPosition(combatant);
    const reachableCells = getReachableCells(currentCell, budget.movementCells, {
      terrainMap: state.terrainMap,
      combatant,
      state,
      bounds: state.mapBounds,
    });
    const threatMap = buildThreatMap(combatant, state, reachableCells, currentCell);

    const candidates = buildPossibleActions(combatant, state, budget, threatMap);
    const nodesEvaluated = candidates.length;

    // Filter to positive-score candidates only
    const validCandidates = candidates.filter(c => c.score > 0);

    if (validCandidates.length === 0) {
      lastStats = {
        nodesEvaluated,
        elapsedMs: performance.now() - startTime,
        custom: { iterations: 0, bestPulls: 0, explorationPct: 0 },
      };
      debug('no valid candidates, returning pass');
      return { type: 'pass' };
    }

    // Initialize arm statistics
    const armStats: ArmStats[] = validCandidates.map(() => ({
      pulls: 0,
      totalReward: 0,
      avgReward: 0,
    }));

    // UCB1 iteration loop
    let iterations = 0;
    let explorationPulls = 0;

    while (iterations < maxIterations) {
      // Check time limit
      if (performance.now() - startTime >= timeLimit) {
        debug('time limit reached', { iterations });
        break;
      }

      // Select arm using UCB1
      const armIndex = selectArmUCB1(armStats, iterations + 1);

      // Track exploration (unpulled arms)
      if (armStats[armIndex].pulls === 0) {
        explorationPulls++;
      }

      // Simulate reward
      const baseScore = validCandidates[armIndex].score;
      const reward = simulateReward(baseScore);

      // Update statistics
      updateArmStats(armStats[armIndex], reward);

      iterations++;
    }

    // Select arm with highest average reward
    let bestArm = 0;
    let bestAvg = -Infinity;

    for (let i = 0; i < armStats.length; i++) {
      if (armStats[i].pulls > 0 && armStats[i].avgReward > bestAvg) {
        bestAvg = armStats[i].avgReward;
        bestArm = i;
      }
    }

    const selected = validCandidates[bestArm];

    lastStats = {
      nodesEvaluated,
      elapsedMs: performance.now() - startTime,
      custom: {
        iterations,
        bestPulls: armStats[bestArm].pulls,
        explorationPct: Math.round((explorationPulls / iterations) * 100),
        candidateCount: validCandidates.length,
      },
    };

    debug('selected:', {
      combatantId: combatant.id,
      action: selected.action.name,
      target: selected.target?.name,
      fromPosition: selected.fromPosition,
      avgReward: bestAvg,
      pulls: armStats[bestArm].pulls,
      stats: lastStats,
    });

    return {
      type: 'action',
      action: selected.action,
      target: selected.target,
      fromPosition: selected.fromPosition,
      targetCell: selected.targetCell,
      score: selected.score,
    };
  },

  getStats(): SelectorStats {
    return { ...lastStats };
  },
};
