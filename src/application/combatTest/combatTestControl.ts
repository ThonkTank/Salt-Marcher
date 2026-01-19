// Ziel: Svelte Store und UI-Event-Handling fuer Combat Test
// Siehe: docs/architecture/Orchestration.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Diese Datei wird aktuell nicht verwendet.
// ============================================================================
//
// Der combatTestControl orchestriert:
// - combatTestStore (Svelte Store fuer UI)
// - Ruft combatWorkflow direkt auf
// - Verwaltet combatTestState (UI-spezifisch)
// - Berechnet ActionHighlight (UI-spezifisch)

import { writable, type Writable } from 'svelte/store';
import { setVault, vault } from '@/infrastructure/vault/vaultInstance';
import { PresetVaultAdapter } from '@/infrastructure/vault/PresetVaultAdapter';
import type { TurnAction, CombatStateWithLayers } from '@/types/combat';
import {
  getCombatTestState,
  updateCombatTestState,
  resetCombatTestState,
  type CombatTestState,
  type ActionHighlight,
} from '@/infrastructure/state/combatTestState';
import {
  loadScenario as loadScenarioCore,
  requestAISuggestion,
  executeAISuggestion,
  skipTurn as skipTurnCore,
  getAvailableScenarios,
} from '@/workflows/combatWorkflow';

// ============================================================================
// TYPES
// ============================================================================

export interface CombatTestUIState extends CombatTestState {
  availableScenarios: Array<{ id: string; name: string }>;
}

// ============================================================================
// STORE
// ============================================================================

const initialState: CombatTestUIState = {
  combat: null,
  suggestedAction: null,
  actionHighlight: null,
  selectedScenarioId: null,
  error: null,
  availableScenarios: [],
};

export const combatTestStore: Writable<CombatTestUIState> = writable(initialState);

// ============================================================================
// STORE SYNC
// ============================================================================

/**
 * Synct Svelte Store mit Infrastructure State.
 * Wird nach jedem State-Update aufgerufen.
 */
function syncStore(): void {
  const state = getCombatTestState();
  combatTestStore.update(s => ({
    ...s,
    ...state,
  }));
}

// ============================================================================
// HELPERS (UI-spezifisch)
// ============================================================================

/**
 * Berechnet ActionHighlight aus TurnAction (UI-spezifisch).
 */
function computeActionHighlight(
  suggestion: TurnAction | null,
  combat: CombatStateWithLayers
): ActionHighlight | null {
  if (!suggestion || suggestion.type !== 'action') return null;

  const currentId = combat.turnOrder[combat.currentTurnIndex];
  const current = combat.combatants.find(c => c.id === currentId);
  return {
    targetPosition:
      suggestion.target?.combatState.position ??
      current?.combatState.position ?? { x: 0, y: 0, z: 0 },
    actionName: suggestion.action.name,
    targetName: suggestion.target?.name ?? null,
  };
}

/**
 * Fordert AI-Vorschlag an und aktualisiert State.
 */
function requestNextAction(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  const suggestion = requestAISuggestion(state.combat);
  const actionHighlight = computeActionHighlight(suggestion, state.combat);

  updateCombatTestState(s => ({ ...s, suggestedAction: suggestion, actionHighlight }));
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Initialisiert den Combat Test Control.
 * Laedt verfuegbare Szenarien in den Store.
 */
export function initCombatTestControl(): void {
  // Initialize vault if not already done
  if (!vault) {
    setVault(new PresetVaultAdapter());
  }

  resetCombatTestState();
  combatTestStore.set({
    ...getCombatTestState(),
    availableScenarios: getAvailableScenarios(),
  });
}

/**
 * Oeffnet ein Szenario und laedt den Combat-State.
 * @param scenarioId ID des Szenarios
 */
export function openScenario(scenarioId: string): void {
  if (!scenarioId) {
    updateCombatTestState(() => ({
      combat: null,
      suggestedAction: null,
      actionHighlight: null,
      selectedScenarioId: null,
      error: null,
    }));
    syncStore();
    return;
  }

  try {
    const combat = loadScenarioCore(scenarioId);
    if (!combat) throw new Error(`Preset not found: ${scenarioId}`);

    updateCombatTestState(() => ({
      combat,
      suggestedAction: null,
      actionHighlight: null,
      selectedScenarioId: scenarioId,
      error: null,
    }));

    requestNextAction();
  } catch (e) {
    updateCombatTestState(s => ({
      ...s,
      combat: null,
      error: e instanceof Error ? e.message : String(e),
      selectedScenarioId: scenarioId,
    }));
  }
  syncStore();
}

/**
 * Akzeptiert den AI-Vorschlag und fuehrt die Aktion aus.
 */
export function acceptSuggestedAction(): void {
  const state = getCombatTestState();
  if (!state.combat || !state.suggestedAction) return;

  executeAISuggestion(state.suggestedAction, state.combat);
  updateCombatTestState(s => ({ ...s, suggestedAction: null, actionHighlight: null }));
  requestNextAction();
  syncStore();
}

/**
 * Ueberspringt den aktuellen Turn.
 */
export function skipTurn(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  skipTurnCore(state.combat);
  updateCombatTestState(s => ({ ...s, suggestedAction: null, actionHighlight: null }));
  requestNextAction();
  syncStore();
}

/**
 * Setzt den Combat Test zurueck.
 */
export function resetCombatTest(): void {
  resetCombatTestState();
  syncStore();
}
