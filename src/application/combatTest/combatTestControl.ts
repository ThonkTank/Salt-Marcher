// Ziel: Svelte Store und UI-Event-Handling fuer Combat Test
// Siehe: docs/architecture/Orchestration.md
//
// Der combatTestControl orchestriert:
// - combatTestStore (Svelte Store fuer UI)
// - Ruft Workflows auf
// - Synct Store mit Infrastructure State
// - KEINE Service-Calls, KEIN direkter State-Zugriff

import { writable, type Writable } from 'svelte/store';
import { setVault, vault } from '@/infrastructure/vault/vaultInstance';
import { PresetVaultAdapter } from '@/infrastructure/vault/PresetVaultAdapter';
import {
  getCombatTestState,
  resetCombatTestState,
  type CombatTestState,
} from '@/infrastructure/state/combatTestState';
import {
  loadScenario,
  executeCurrentAction,
  skipCurrentTurn,
  getAvailableScenarios,
} from '@/workflows/combatTestWorkflow';

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
 * Wird nach jedem Workflow-Aufruf aufgerufen.
 */
function syncStore(): void {
  const state = getCombatTestState();
  combatTestStore.update(s => ({
    ...s,
    ...state,
  }));
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
  loadScenario(scenarioId);
  syncStore();
}

/**
 * Akzeptiert den AI-Vorschlag und fuehrt die Aktion aus.
 */
export function acceptSuggestedAction(): void {
  executeCurrentAction();
  syncStore();
}

/**
 * Ueberspringt den aktuellen Turn.
 */
export function skipTurn(): void {
  skipCurrentTurn();
  syncStore();
}

/**
 * Setzt den Combat Test zurueck.
 */
export function resetCombatTest(): void {
  resetCombatTestState();
  syncStore();
}
