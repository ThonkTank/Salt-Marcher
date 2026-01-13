// Ziel: Orchestriert Combat Test - Szenario-Laden, AI-Vorschlaege, Action-Ausfuehrung
// Siehe: docs/architecture/Orchestration.md

import {
  getCombatTestState,
  updateCombatTestState,
  type ActionHighlight,
} from '@/infrastructure/state/combatTestState';
import { loadEncounterPreset } from '@/services/encounterLoader';
import { getEncounterPresetById, encounterPresets } from 'presets/encounters';
import { getMapConfigForScenario } from 'presets/combatMaps';
import { selectNextAction } from '@/services/combatantAI';
import { executeAction, advanceTurn, createTurnBudget } from '@/services/combatTracking';

/**
 * Laedt ein Szenario und initialisiert Combat.
 */
export function loadScenario(scenarioId: string): void {
  if (!scenarioId) {
    updateCombatTestState(() => ({
      combat: null,
      suggestedAction: null,
      actionHighlight: null,
      selectedScenarioId: null,
      error: null,
    }));
    return;
  }

  try {
    const preset = getEncounterPresetById(scenarioId);
    if (!preset) throw new Error(`Preset not found: ${scenarioId}`);

    const combat = loadEncounterPreset(
      preset,
      { level: 1, size: 0, members: [] },
      { mapConfigLoader: getMapConfigForScenario }
    );

    updateCombatTestState(() => ({
      combat,
      suggestedAction: null,
      actionHighlight: null,
      selectedScenarioId: scenarioId,
      error: null,
    }));

    // AI-Vorschlag fuer ersten Combatant
    requestNextAction();
  } catch (e) {
    updateCombatTestState(s => ({
      ...s,
      combat: null,
      error: e instanceof Error ? e.message : String(e),
      selectedScenarioId: scenarioId,
    }));
  }
}

/**
 * Fordert AI-Vorschlag fuer aktuellen Combatant an.
 */
export function requestNextAction(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  const currentId = state.combat.turnOrder[state.combat.currentTurnIndex];
  const current = state.combat.combatants.find(c => c.id === currentId);
  if (!current) {
    updateCombatTestState(s => ({ ...s, suggestedAction: null, actionHighlight: null }));
    return;
  }

  const budget = createTurnBudget(current, state.combat);
  const suggestion = selectNextAction(current, state.combat, budget);

  // ActionHighlight berechnen (Target-Position oder Fallback auf Akteur-Position)
  let actionHighlight: ActionHighlight | null = null;
  if (suggestion.type === 'action') {
    actionHighlight = {
      targetPosition: suggestion.target?.combatState.position ?? current.combatState.position,
      actionName: suggestion.action.name,
      targetName: suggestion.target?.name ?? null,
    };
  }

  updateCombatTestState(s => ({ ...s, suggestedAction: suggestion, actionHighlight }));
}

/**
 * Fuehrt die vorgeschlagene Aktion aus.
 */
export function executeCurrentAction(): void {
  const state = getCombatTestState();
  if (!state.combat || !state.suggestedAction) return;

  const currentId = state.combat.turnOrder[state.combat.currentTurnIndex];
  const current = state.combat.combatants.find(c => c.id === currentId);
  if (!current) return;

  if (state.suggestedAction.type === 'pass') {
    advanceTurn(state.combat);
  } else {
    // Position aktualisieren
    current.combatState.position = state.suggestedAction.position;
    // Action ausfuehren
    executeAction(current, state.suggestedAction, state.combat);
    advanceTurn(state.combat);
  }

  // State aktualisieren und neuen Vorschlag holen
  updateCombatTestState(s => ({ ...s, suggestedAction: null, actionHighlight: null }));
  requestNextAction();
}

/**
 * Ueberspringt den aktuellen Turn.
 */
export function skipCurrentTurn(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  advanceTurn(state.combat);
  updateCombatTestState(s => ({ ...s, suggestedAction: null, actionHighlight: null }));
  requestNextAction();
}

/**
 * Gibt verfuegbare Szenarien zurueck.
 */
export function getAvailableScenarios(): Array<{ id: string; name: string }> {
  return encounterPresets.map(p => ({ id: p.id, name: p.name }));
}
