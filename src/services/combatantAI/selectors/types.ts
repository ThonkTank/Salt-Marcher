// Ziel: ActionSelector Interface und Konfiguration für austauschbare AI-Algorithmen
// Siehe: docs/services/combatantAI/combatantAI.md

import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  TurnAction,
} from '../../../types/combat';

/**
 * Konfiguration für Selector-Algorithmen.
 * Alle Felder optional - Selector verwendet sinnvolle Defaults.
 */
export interface SelectorConfig {
  /** Zeitlimit in ms (für Anytime-Algorithmen wie MCTS) */
  timeLimit?: number;
  /** Maximale Suchtiefe (für Minimax/Expectimax) */
  maxDepth?: number;
  /** Beam-Breite für Pruning */
  beamWidth?: number;
  /** Gewichtung Position vs Action (0-1, höher = mehr Position-Fokus) */
  threatWeight?: number;
  /** Debug-Ausgaben aktivieren */
  debug?: boolean;
}

/**
 * Statistiken eines Selector-Durchlaufs.
 * Optional von Selektoren bereitgestellt für Performance-Analyse.
 */
export interface SelectorStats {
  /** Anzahl evaluierter Knoten/Aktionen */
  nodesEvaluated: number;
  /** Vergangene Zeit in ms */
  elapsedMs: number;
  /** Maximale erreichte Tiefe (falls zutreffend) */
  maxDepthReached?: number;
  /** Algorithmus-spezifische Metriken */
  custom?: Record<string, number>;
}

/**
 * Interface für austauschbare Action-Selection Algorithmen.
 *
 * Jeder Selector implementiert dieselbe Schnittstelle, aber mit
 * unterschiedlicher interner Logik (Greedy, Random, MCTS, etc.)
 */
export interface ActionSelector {
  /** Eindeutiger Name des Selectors (z.B. "greedy", "random", "mcts") */
  readonly name: string;

  /**
   * Wählt die nächste Aktion für einen Combatant.
   *
   * @param combatant - Der agierende Combatant (mit Layer-Daten)
   * @param state - Aktueller Simulationsstate (alle Combatants mit Layers)
   * @param budget - Verbleibendes Turn-Budget (Movement, Action, etc.)
   * @param config - Optionale Algorithmus-Konfiguration
   * @returns Gewählte Aktion oder Pass
   */
  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction;

  /**
   * Liefert Statistiken des letzten selectNextAction Aufrufs.
   * Optional - nicht alle Selektoren müssen Statistiken tracken.
   */
  getStats?(): SelectorStats;
}

// Alias for migration
export type CombatEventSelector = ActionSelector;
