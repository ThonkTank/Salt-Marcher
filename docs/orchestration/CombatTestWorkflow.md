> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# CombatTestWorkflow

> **Verantwortlichkeit:** Orchestriert Combat-Test UI - Szenario-Laden, AI-Vorschlaege, Action-Ausfuehrung
> **Controller:** `src/application/combatTest/combatTestControl.ts`
> **State:** `CombatTestState` in `src/infrastructure/state/combatTestState.ts`
> **Trigger:** UI-Events aus `CombatTest.svelte`
>
> **Verwandte Dokumente:**
> - [Orchestration.md](../architecture/Orchestration.md) - Architektur-Uebersicht
> - [CombatWorkflow.md](CombatWorkflow.md) - Combat Business-Logik
> - [combatantAI.md](../services/combatantAI/combatantAI.md) - AI-Entscheidungslogik

Dieser Controller orchestriert die Combat-Test UI fuer AI-Entwicklung und Balancing. Er ruft `combatWorkflow` direkt auf und verwaltet den UI-spezifischen State.

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
│   - Ruft combatWorkflow direkt auf                          │
│   - Verwaltet combatTestState (UI-spezifisch)               │
│   - Berechnet ActionHighlight (UI-spezifisch)               │
└─────────────────────────────────────────────────────────────┘
       ↓ calls
┌─────────────────────────────────────────────────────────────┐
│ combatWorkflow.ts                       src/workflows/      │
│   - loadScenario(), requestAISuggestion()                   │
│   - executeAISuggestion(), skipTurn()                       │
│   - runAction(), applyResult()                              │
└─────────────────────────────────────────────────────────────┘
```

---

## State-Struktur

```typescript
interface CombatTestState {
  combat: CombatStateWithLayers | null;
  suggestedAction: TurnAction | null;
  actionHighlight: ActionHighlight | null;
  selectedScenarioId: string | null;
  error: string | null;
}

interface CombatTestUIState extends CombatTestState {
  availableScenarios: Array<{ id: string; name: string }>;
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `combat` | `CombatStateWithLayers \| null` | Aktiver Combat-State mit Layer-Daten |
| `suggestedAction` | `TurnAction \| null` | AI-Vorschlag fuer aktuellen Combatant |
| `actionHighlight` | `ActionHighlight \| null` | UI-Highlight fuer Ziel-Position |
| `selectedScenarioId` | `string \| null` | ID des geladenen Szenarios |
| `error` | `string \| null` | Fehlermeldung bei Lade-Problemen |

---

## API (combatTestControl.ts)

### initCombatTestControl

Initialisiert den Controller und laedt verfuegbare Szenarien:

```typescript
export function initCombatTestControl(): void
```

### openScenario

Laedt ein Szenario und holt ersten AI-Vorschlag:

```typescript
export function openScenario(scenarioId: string): void
```

### acceptSuggestedAction

Fuehrt die vorgeschlagene Aktion aus:

```typescript
export function acceptSuggestedAction(): void
```

### skipCurrentTurn

Ueberspringt den aktuellen Turn:

```typescript
export function skipCurrentTurn(): void
```

### resetCombatTest

Setzt den State zurueck:

```typescript
export function resetCombatTest(): void
```

---

## Verwendete combatWorkflow Funktionen

| Funktion | Zweck |
|----------|-------|
| `loadScenario(scenarioId)` | Preset → CombatStateWithLayers |
| `requestAISuggestion(state)` | AI-Entscheidung holen |
| `executeAISuggestion(suggestion, state)` | AI-Vorschlag ausfuehren |
| `skipTurn(state)` | Turn ueberspringen |
| `getAvailableScenarios()` | Szenario-Liste |

---

## UI-spezifische Logik

### ActionHighlight

```typescript
interface ActionHighlight {
  targetPosition: GridPosition;
  actionName: string;
  targetName: string | null;
}
```

Wird im Controller berechnet fuer visuelles Feedback in der UI:

```typescript
function computeActionHighlight(
  suggestion: TurnAction | null,
  combat: CombatStateWithLayers
): ActionHighlight | null
```

---

## Unterschied zu CombatWorkflow

| Aspekt | CombatWorkflow | CombatTestControl |
|--------|---------------|-------------------|
| **Typ** | Workflow (Business-Logik) | Controller (UI-Orchestration) |
| **Zweck** | Combat-Operationen | AI-Testing & Balancing |
| **State-Owner** | Keiner (State-agnostisch) | combatTestState |
| **UI-Logik** | Keine | ActionHighlight |
| **Svelte-Integration** | Keine | combatTestStore |
