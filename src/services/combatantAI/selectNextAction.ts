// Ziel: Thin wrapper für Combat-AI Action-Selection
// Siehe: docs/services/combatantAI/planNextAction.md

import type {
  TurnBudget,
  TurnAction,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
} from '@/types/combat';
import { getDefaultSelector } from './selectors';

/**
 * Wählt die nächste beste Aktion für einen Combatant.
 *
 * Delegiert an den Default-Selector (greedy).
 *
 * @param combatant Der aktive Combatant (mit Layer-Daten)
 * @param state Combat State (read-only)
 * @param budget Verbleibendes Turn-Budget (read-only)
 * @returns Die nächste auszuführende Aktion
 */
export function selectNextAction(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): TurnAction {
  return getDefaultSelector().selectNextAction(combatant, state, budget);
}
