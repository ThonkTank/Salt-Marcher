// Ziel: Evolved ActionSelector - NEAT Network als CombatEvent-Entscheider
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Factory-Funktion die ein trainiertes NEAT-Network in einen ActionSelector
// verwandelt. Das Network scored CombatEvent/Target Kombinationen statt der
// regelbasierten DPR-Heuristik.

import type { ActionSelector, SelectorConfig, SelectorStats } from './types';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
} from '@/types/combat';
import type { FeedForwardNetwork, NEATGenome } from '../evolution';
import {
  buildNetwork,
  forward,
  extractStateFeatures,
  extractActionFeatures,
  combineFeatures,
} from '../evolution';
import { buildPossibleCombatEvents, toTurnCombatEvent } from '../core';

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[evolvedSelector]', ...args);
  }
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard: Prüft ob Input ein NEATGenome ist.
 */
function isNEATGenome(brain: FeedForwardNetwork | NEATGenome): brain is NEATGenome {
  // NEATGenome hat 'nodes' als NodeGene[] mit 'type' property
  // FeedForwardNetwork hat 'nodes' als NetworkNode[] mit 'type' property
  // Unterscheidung: NEATGenome hat 'fitness' und 'generation' properties
  return 'fitness' in brain && 'generation' in brain;
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Factory: Erstellt ActionSelector aus NEAT Network.
 *
 * Das Network bewertet CombatEvent/Target Kombinationen und gibt die
 * beste Aktion zurück. Anders als der regelbasierte greedySelector
 * lernt das Network optimale Bewertungen durch Evolution.
 *
 * @param brain - Trainiertes FeedForwardNetwork oder NEATGenome
 * @param brainId - Optionale ID für den Selector-Namen (default: 'evolved')
 * @returns ActionSelector der das Network für Bewertungen nutzt
 *
 * @example
 * ```typescript
 * const genome = createMinimalGenome(86, 1, tracker);
 * const network = buildNetwork(genome);
 * const selector = createEvolvedSelector(network, 'gen-100');
 * const action = selector.selectNextAction(combatant, state, budget);
 * ```
 */
export function createEvolvedSelector(
  brain: FeedForwardNetwork | NEATGenome,
  brainId: string = 'evolved'
): ActionSelector {
  // Network aus Genome erstellen falls nötig
  const network: FeedForwardNetwork = isNEATGenome(brain)
    ? buildNetwork(brain)
    : brain;

  let lastStats: SelectorStats = { nodesEvaluated: 0, elapsedMs: 0 };

  return {
    name: `evolved-${brainId}`,

    selectNextAction(
      combatant: CombatantWithLayers,
      state: CombatantSimulationStateWithLayers,
      budget: TurnBudget,
      _config?: SelectorConfig
    ): TurnAction {
      const startTime = performance.now();
      let nodesEvaluated = 0;

      // 1. Budget exhausted → Pass
      if (!budget.hasAction && !budget.hasBonusAction && budget.movementCells <= 0) {
        lastStats = { nodesEvaluated: 0, elapsedMs: performance.now() - startTime };
        debug('no budget remaining, returning pass');
        return { type: 'pass' };
      }

      // 2. Generiere Kandidaten via buildPossibleCombatEvents (ohne Scoring - NN scored selbst)
      const candidates = buildPossibleCombatEvents(
        combatant, state, budget, new Map(), { skipScoring: true }
      );
      nodesEvaluated = candidates.length;

      if (candidates.length === 0) {
        lastStats = { nodesEvaluated, elapsedMs: performance.now() - startTime };
        debug('no candidates available, returning pass');
        return { type: 'pass' };
      }

      // 3. State Features (einmal pro Entscheidung)
      const stateFeatures = extractStateFeatures(combatant, state, budget);

      // 4. Für jeden Kandidaten: Score via Network
      let bestCandidate = candidates[0];
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        // CombatEvent Features für diesen Kandidaten
        const actionFeatures = extractActionFeatures(
          candidate.action,
          candidate.target,
          combatant,
          state
        );

        // Features kombinieren (86 Dimensionen)
        const features = combineFeatures(stateFeatures, actionFeatures);

        // Network forward pass
        const output = forward(network, features);
        const score = output[0]; // Network hat 1 Output-Node

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      lastStats = {
        nodesEvaluated,
        elapsedMs: performance.now() - startTime,
        custom: {
          bestScore,
        },
      };

      debug('selected:', {
        combatantId: combatant.id,
        action: bestCandidate.action.name,
        target: bestCandidate.target?.name,
        fromPosition: bestCandidate.fromPosition,
        networkScore: bestScore.toFixed(4),
        nodesEvaluated,
        elapsedMs: lastStats.elapsedMs.toFixed(2),
      });

      return toTurnCombatEvent(bestCandidate);
    },

    getStats(): SelectorStats {
      return { ...lastStats };
    },
  };
}
