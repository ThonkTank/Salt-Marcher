# Orchestration Layer

Die Orchestration-Schicht koordiniert Workflows waehrend einer aktiven Session. **sessionControl** orchestriert den aktiven Workflow und synct den Svelte Store, **Workflows** fuehren die Logik aus.

---

## Abgrenzung

| Layer | Verantwortlichkeit | State | Pfad |
|-------|-------------------|-------|------|
| **sessionControl** | UI-Orchestrator, Workflow-Auswahl, Svelte Store sync | Svelte Store | `application/sessionControls/` |
| **Workflows** | State lesen/schreiben, Services aufrufen, Vault persistieren | Stateless | `workflows/` |
| **sessionState** | Einfacher State-Container (kein Framework) | Stateful | `infrastructure/state/` |
| **Services** | Business-Logik als Pipelines | Stateless | `services/` |
| **Views** | UI-Darstellung | Reactive (subscribed) | `views/` |

**Wichtig:** sessionState ist ein einfacher Container ohne Framework-Dependencies. sessionControl haelt den Svelte Store.

---

## sessionControl

sessionControl in `application/sessionControls/` ist der **UI-Orchestrator**:

- Haelt den Svelte Store (`sessionStore`)
- Entscheidet welcher Workflow aktiv ist
- Ruft Workflows auf
- Synct Svelte Store mit Infrastructure-State nach Workflow-Aufrufen

```typescript
// sessionControl.ts
import { writable } from 'svelte/store';
import { getState } from '@/infrastructure/state/sessionState';

export const sessionStore = writable<SessionState>(getState());

export function syncStore(): void {
  sessionStore.set(getState());
}
```

---

## sessionState

sessionState in `infrastructure/state/` ist ein **einfacher Container** ohne Framework-Dependencies:

- Party-Position und Transport
- Aktuelle Zeit und Wetter
- Aktive Workflows (Travel, Encounter, Combat, Rest)

**Kernprinzip:** Kein Svelte, kein Framework. Ermoeglicht CLI-Testbarkeit.

```typescript
// infrastructure/state/sessionState.ts
let state: SessionState = { ... };

export function getState(): SessionState { return state; }
export function updateState(fn: (s: SessionState) => SessionState): void { state = fn(state); }
export function resetState(initial: SessionState): void { state = initial; }
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
| **CombatTest** | idle → active → idle | UI-Szenario-Auswahl (AI-Testing) |

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
// workflows/encounterWorkflow.ts
import { getState, updateState } from '@/infrastructure/state/sessionState';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { generateEncounter } from '@/services/encounterGenerator/encounterGenerator';

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

**sessionControl** synct nach jedem Workflow-Aufruf:

```typescript
// In sessionControl: Workflow aufrufen + Store syncen
checkEncounter('travel');
syncStore();
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
| [CombatTestWorkflow.md](../orchestration/CombatTestWorkflow.md) | Combat-Test UI, AI-Vorschlaege |

---

## Verwandte Dokumente

- [Services.md](Services.md) - Service-Pipeline-Pattern
