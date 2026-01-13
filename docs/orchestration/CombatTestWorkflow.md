# CombatTestWorkflow

> **Verantwortlichkeit:** Orchestriert Combat-Test UI - Szenario-Laden, AI-Vorschlaege, Action-Ausfuehrung
> **State:** `CombatTestState` in `src/infrastructure/state/combatTestState.ts`
> **Trigger:** UI-Events aus `CombatTest.svelte`
>
> **Verwandte Dokumente:**
> - [Orchestration.md](../architecture/Orchestration.md) - Architektur-Uebersicht
> - [combatantAI.md](../services/combatantAI/combatantAI.md) - AI-Entscheidungslogik

Dieser Workflow orchestriert die Combat-Test UI fuer AI-Entwicklung und Balancing. Er laedt Szenarien, holt AI-Vorschlaege und fuehrt Aktionen aus.

---

## State-Struktur

```typescript
interface CombatTestState {
  combat: CombatStateWithLayers | null;
  suggestedAction: TurnAction | null;
  selectedScenarioId: string | null;
  error: string | null;
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `combat` | `CombatStateWithLayers \| null` | Aktiver Combat-State mit Layer-Daten |
| `suggestedAction` | `TurnAction \| null` | AI-Vorschlag fuer aktuellen Combatant |
| `selectedScenarioId` | `string \| null` | ID des geladenen Szenarios |
| `error` | `string \| null` | Fehlermeldung bei Lade-Problemen |

---

## State-Machine

```
idle → active → idle
```

| Transition | Trigger | Aktion |
|------------|---------|--------|
| idle → active | `loadScenario()` | Preset laden, Combat initialisieren |
| active → idle | Manuell / Reset | State zuruecksetzen |

---

## API

### loadScenario

Laedt ein Szenario aus den Encounter-Presets:

```typescript
export function loadScenario(scenarioId: string): void {
  if (!scenarioId) {
    updateCombatTestState(() => ({
      combat: null,
      suggestedAction: null,
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
      selectedScenarioId: scenarioId,
      error: null,
    }));

    requestNextAction();
  } catch (e) {
    updateCombatTestState(s => ({
      ...s,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
}
```

### requestNextAction

Holt AI-Vorschlag fuer den aktuellen Combatant:

```typescript
export function requestNextAction(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  const currentId = state.combat.turnOrder[state.combat.currentTurnIndex];
  const current = state.combat.combatants.find(c => c.id === currentId);
  if (!current) {
    updateCombatTestState(s => ({ ...s, suggestedAction: null }));
    return;
  }

  const budget = createTurnBudget(current, state.combat);
  const suggestion = selectNextAction(current, state.combat, budget);

  updateCombatTestState(s => ({ ...s, suggestedAction: suggestion }));
}
```

### executeCurrentAction

Fuehrt die vorgeschlagene Aktion aus:

```typescript
export function executeCurrentAction(): void {
  const state = getCombatTestState();
  if (!state.combat || !state.suggestedAction) return;

  const currentId = state.combat.turnOrder[state.combat.currentTurnIndex];
  const current = state.combat.combatants.find(c => c.id === currentId);
  if (!current) return;

  if (state.suggestedAction.type === 'pass') {
    advanceTurn(state.combat);
  } else {
    current.combatState.position = state.suggestedAction.fromPosition;
    executeAction(current, state.suggestedAction, state.combat);
    advanceTurn(state.combat);
  }

  updateCombatTestState(s => ({ ...s, suggestedAction: null }));
  requestNextAction();
}
```

### skipCurrentTurn

Ueberspringt den aktuellen Turn ohne Aktion:

```typescript
export function skipCurrentTurn(): void {
  const state = getCombatTestState();
  if (!state.combat) return;

  advanceTurn(state.combat);
  updateCombatTestState(s => ({ ...s, suggestedAction: null }));
  requestNextAction();
}
```

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ CombatTest.svelte                       src/views/          │
│   - Subscribes to combatTestStore                           │
│   - Dispatches: openScenario, acceptSuggestedAction, skip   │
└─────────────────────────────────────────────────────────────┘
       ↓ dispatches              ↑ subscribes
┌─────────────────────────────────────────────────────────────┐
│ combatTestControl.ts            src/application/combatTest/ │
│   - combatTestStore = writable<CombatTestUIState>()         │
│   - Ruft Workflows auf, synct Store                         │
└─────────────────────────────────────────────────────────────┘
       ↓ calls
┌─────────────────────────────────────────────────────────────┐
│ combatTestWorkflow.ts                     src/workflows/    │
│   - getCombatTestState() / updateCombatTestState()          │
│   - loadEncounterPreset(), selectNextAction(), executeAction│
└─────────────────────────────────────────────────────────────┘
```

---

## Verwendete Services

| Service | Funktionen | Zweck |
|---------|------------|-------|
| `encounterLoader` | `loadEncounterPreset()` | Szenario → CombatState |
| `combatantAI` | `selectNextAction()` | AI-Entscheidung |
| `combatTracking` | `executeAction()`, `advanceTurn()`, `createTurnBudget()` | Combat-Ausfuehrung |

---

## CLI-Testing

```bash
# Workflow-Funktionen direkt aufrufen
npm run cli -- workflows/combatTestWorkflow loadScenario '"1v1"'

# State inspizieren
npm run cli -- infrastructure/state/combatTestState getCombatTestState '{}'
```

---

## Unterschied zu CombatWorkflow

| Aspekt | CombatWorkflow | CombatTestWorkflow |
|--------|---------------|-------------------|
| **Zweck** | Live-Session Combat | AI-Testing & Balancing |
| **State-Owner** | sessionState | combatTestState |
| **Initiative** | GM wuerfelt | Auto-generiert |
| **Aktionen** | GM entscheidet | AI schlaegt vor |
| **Persistenz** | Session-ueberdauernd | Transient |
