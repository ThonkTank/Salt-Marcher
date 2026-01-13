// Ziel: State-Container fuer Combat Test ohne Framework-Dependencies
// Siehe: docs/architecture/Infrastructure.md

import type { CombatStateWithLayers, TurnAction, GridPosition } from '@/types/combat';

export interface ActionHighlight {
  targetPosition: GridPosition;
  actionName: string;
  targetName: string | null;
}

export interface CombatTestState {
  combat: CombatStateWithLayers | null;
  suggestedAction: TurnAction | null;
  actionHighlight: ActionHighlight | null;
  selectedScenarioId: string | null;
  error: string | null;
}

let state: CombatTestState = {
  combat: null,
  suggestedAction: null,
  actionHighlight: null,
  selectedScenarioId: null,
  error: null,
};

export function getCombatTestState(): CombatTestState {
  return state;
}

export function updateCombatTestState(
  updater: (s: CombatTestState) => CombatTestState
): void {
  state = updater(state);
}

export function resetCombatTestState(): void {
  state = {
    combat: null,
    suggestedAction: null,
    actionHighlight: null,
    selectedScenarioId: null,
    error: null,
  };
}
