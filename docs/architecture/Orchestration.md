# Orchestration Layer

Die Orchestration-Schicht koordiniert Workflows waehrend einer aktiven Session. Der **sessionState** ist der zentrale State-Container, **Workflows** orchestrieren alle In-Session-Aktivitaeten.

---

## Abgrenzung

| Layer | Verantwortlichkeit | State | Beispiele |
|-------|-------------------|-------|-----------|
| **sessionState** | State-Container (nur Speicher) | Stateful | `sessionState.ts` |
| **Workflows** | State lesen, Context bauen, Services aufrufen, State schreiben | Stateless (operiert auf sessionState) | EncounterWorkflow, TravelWorkflow |
| **Services** | Business-Logik als Pipelines | Stateless | EncounterService, WeatherService |
| **Views** | UI-Darstellung | Reactive (subscribed) | SessionRunner, DetailView |

**Wichtig:** sessionState ist KEIN Controller mit Methoden. Es ist nur ein Svelte Store.

---

## sessionState

Der sessionState ist ein **Svelte Store** - die Single Source of Truth fuer alle In-Session-Daten:

- Party-Position und Transport
- Aktuelle Zeit und Wetter
- Aktive Workflows (Travel, Encounter, Combat, Rest)
- UI-State (nicht persistiert)

**Kernprinzip:** Views subscriben auf den Store. Workflows schreiben State-Updates. Keine Events.

```typescript
// sessionState.ts
export const sessionState = writable<SessionState>(initialState);
export function getState(): SessionState { ... }
export function updateState(fn: (s: SessionState) => SessionState): void { ... }
```

Details: [SessionState.md](../orchestration/SessionState.md)

---

## Workflows

Workflows sind **Thin Orchestration** - sie koordinieren, transformieren aber nicht:

| Workflow | State-Machine | Trigger |
|----------|--------------|---------|
| **Travel** | idle → planning → traveling ↔ paused → idle | GM plant Route |
| **Encounter** | idle → preview → active → resolving → idle | Encounter-Check waehrend Travel |
| **Combat** | idle → active → idle | GM startet Combat aus Encounter |
| **Rest** | idle → resting ↔ paused → idle | GM startet Short/Long Rest |

Workflows koennen sich gegenseitig unterbrechen:
- Travel → Encounter (automatisch bei Check)
- Encounter → Combat (GM-Entscheidung)
- Rest → Encounter (bei Encounter-Check waehrend Rest)

---

## Thin Workflow-Prinzip

Workflows sind **maximal duenn**. Sie:

1. **Lesen** State aus sessionState
2. **Bauen** Context (Vault-Lookups wenn noetig)
3. **Rufen** Services auf
4. **Schreiben** Ergebnis zurueck in sessionState

**Verboten in Workflows:**
- Eigene Business-Logik (gehoert in Services)
- Eigene Helper-Klassen (inline Vault-Lookups statt `getCurrentTerrain()`)
- Eigene Filterlogik (Services filtern selbst)

### Beispiel: Thin Workflow

```typescript
// encounterWorkflow.ts
import { getState, updateState } from './sessionState';
import { generateEncounter } from '@services/encounterGenerator';
import { vault } from '@infrastructure/vault';

export function checkEncounter(trigger: EncounterTrigger): void {
  if (!rollEncounterCheck()) return;

  // State lesen
  const state = getState();
  const map = vault.getEntity('map', state.activeMapId!);
  const tile = map.getTile(state.party.position);

  // Service aufrufen (Context inline bauen)
  const result = generateEncounter({
    position: state.party.position,
    terrain: vault.getEntity('terrain', tile.terrainId),
    timeSegment: state.time.daySegment,
    weather: state.weather!,
    factions: tile.factionPresence ?? [],
    trigger,
  });

  // State schreiben
  if (isOk(result)) {
    updateState(s => ({
      ...s,
      encounter: { status: 'preview', current: unwrap(result) },
      travel: { ...s.travel, status: 'paused' }
    }));
  }
}
```

---

## Dokumentation

Detaillierte Spezifikationen unter `docs/orchestration/`:

| Dokument | Inhalt |
|----------|--------|
| [SessionState.md](../orchestration/SessionState.md) | State-Interface, Module-Pattern, Persistenz |
| [TravelWorkflow.md](../orchestration/TravelWorkflow.md) | Reise-Orchestration, Speed, Encounter-Checks |
| [EncounterWorkflow.md](../orchestration/EncounterWorkflow.md) | Encounter-Generierung, Preview, Resolution |
| [CombatWorkflow.md](../orchestration/CombatWorkflow.md) | Combat-Start, Zug-Verwaltung, Ende |
| [RestWorkflow.md](../orchestration/RestWorkflow.md) | Short/Long Rest, Unterbrechung |

---

## Verwandte Dokumente

- [Services.md](Services.md) - Service-Pipeline-Pattern
