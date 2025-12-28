# sessionState

> **Verantwortlichkeit:** State-Container fuer alle In-Session-Daten
> **Layer:** Orchestration
>
> **Verwandte Dokumente:**
> - [Orchestration.md](../architecture/Orchestration.md) - Layer-Uebersicht
> - [Services.md](../architecture/Services.md) - Service-Pipeline-Pattern

Der `sessionState` ist ein **Svelte Store** - ein reiner State-Container ohne Business-Logik. Workflows lesen und schreiben den State, Services fuehren Business-Logik aus.

---

## Abgrenzung

| Komponente | Verantwortlichkeit |
|------------|-------------------|
| **sessionState** | State speichern (nur Container) |
| **Workflows** | State lesen, Context bauen, Services aufrufen, State schreiben |
| **Services** | Business-Logik, Vault-Zugriff, keine Entscheidungen |

**sessionState ist KEIN Controller.** Es hat keine Methoden ausser `getState()` und `updateState()`.

---

## State-Interface

```typescript
interface SessionState {
  // === KARTEN-KONTEXT ===
  activeMapId: EntityId<'map'> | null;
  camera: CameraState;

  // === PARTY (Single Source of Truth) ===
  party: PartyState;

  // === ZEIT (Single Source of Truth) ===
  time: TimeState;

  // === WETTER (computed by WeatherService) ===
  weather: Weather | null;

  // === WORKFLOWS ===
  travel: TravelWorkflowState;
  encounter: EncounterWorkflowState;
  combat: CombatWorkflowState;
  rest: RestWorkflowState;

  // === UI (session-only, nicht persistiert) ===
  ui: UIState;
}
```

### PartyState

```typescript
interface PartyState {
  position: HexCoordinate;
  mapId: EntityId<'map'>;
  members: EntityId<'character'>[];
  transport: TransportMode;
  availableTransports: TransportMode[];
}
```

### TimeState

```typescript
interface TimeState {
  currentDateTime: GameDateTime;
  activeCalendarId: EntityId<'calendar'>;
  daySegment: TimeSegment;  // 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night'
}
```

### Workflow-States

Jeder Workflow hat einen eigenen State. Details in den jeweiligen Workflow-Dokumenten:

| Workflow | State-Dokument |
|----------|----------------|
| Travel | [TravelWorkflow.md](TravelWorkflow.md) |
| Encounter | [EncounterWorkflow.md](EncounterWorkflow.md) |
| Combat | [CombatWorkflow.md](CombatWorkflow.md) |
| Rest | [RestWorkflow.md](RestWorkflow.md) |

---

## Module-Pattern

```typescript
// sessionState.ts
import { writable } from 'svelte/store';

const initialState: SessionState = {
  activeMapId: null,
  camera: { center: { q: 0, r: 0 }, zoom: 1 },
  party: { position: { q: 0, r: 0 }, mapId: null, members: [], transport: 'walk', availableTransports: ['walk'] },
  time: { currentDateTime: null, activeCalendarId: null, daySegment: 'morning' },
  weather: null,
  travel: { status: 'idle', route: null, progress: null },
  encounter: { status: 'idle', current: null },
  combat: { status: 'idle', participants: [], currentTurn: 0, round: 1 },
  rest: { status: 'idle' },
  ui: { selectedEntity: null, detailViewOpen: false }
};

export const sessionState = writable<SessionState>(initialState);

export function getState(): SessionState {
  let current: SessionState;
  sessionState.subscribe(s => current = s)();
  return current!;
}

export function updateState(fn: (s: SessionState) => SessionState): void {
  sessionState.update(fn);
}
```

---

## Nutzung in Workflows

Workflows importieren `getState` und `updateState` direkt:

```typescript
// encounterWorkflow.ts
import { getState, updateState } from './sessionState';
import { generateEncounter } from '@services/encounterGenerator';
import { vault } from '@infrastructure/vault';

export function checkEncounter(trigger: EncounterTrigger): void {
  if (!rollEncounterCheck()) return;

  const state = getState();
  const map = vault.getEntity('map', state.activeMapId!);
  const tile = map.getTile(state.party.position);

  const result = generateEncounter({
    position: state.party.position,
    terrain: vault.getEntity('terrain', tile.terrainId),
    timeSegment: state.time.daySegment,
    weather: state.weather!,
    factions: tile.factionPresence ?? [],
    trigger,
  });

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

## View-Subscription

Views subscriben direkt auf den Store:

```svelte
<script>
  import { sessionState } from '$lib/session/sessionState';

  // Automatische Subscription via $-Prefix
  $: party = $sessionState.party;
  $: travel = $sessionState.travel;
  $: time = $sessionState.time;
</script>

{#if travel.status === 'traveling'}
  <TravelProgress progress={travel.progress} />
{/if}
```

---

## Persistenz

### Session-State speichern

Persistenz-Logik gehoert in einen Workflow oder Service, nicht in sessionState selbst:

```typescript
// sessionLifecycleWorkflow.ts
import { getState, updateState, sessionState } from './sessionState';
import { vault } from '@infrastructure/vault';

export async function saveSession(): Promise<Result<void, SaveError>> {
  const state = getState();

  const persistable: PersistedSessionState = {
    party: state.party,
    time: state.time,
    activeMapId: state.activeMapId,
    travel: state.travel.status !== 'idle' ? state.travel : null,
  };

  return vault.saveSessionState(persistable);
}

export async function loadSession(): Promise<Result<void, LoadError>> {
  const result = await vault.loadSessionState();
  if (isErr(result)) return result;

  const persisted = unwrap(result);

  sessionState.set({
    ...initialState,
    party: persisted.party,
    time: persisted.time,
    activeMapId: persisted.activeMapId,
    travel: persisted.travel ?? { status: 'idle', route: null, progress: null }
  });

  return ok(undefined);
}
```

### Persistenz-Kategorien

| Kategorie | Beispiele | Speicherung |
|-----------|-----------|-------------|
| **Persistent** | Party-Position, Zeit, aktive Map | Vault (JSON) |
| **Resumable** | Travel-Progress, Combat-State | Plugin-Data |
| **Session-only** | UI-State, Camera | Memory (verloren bei Reload) |

---

## Was NICHT in sessionState gehoert

| Gehoert NICHT hierher | Gehoert stattdessen in |
|-----------------------|------------------------|
| `getCurrentTerrain()` | Workflow (inline Vault-Lookup) |
| `buildPartySnapshot()` | Workflow (vor Service-Aufruf) |
| `getFactionPresence()` | Workflow (inline Vault-Lookup) |
| `checkEncounter()` | EncounterWorkflow |
| `startCombat()` | CombatWorkflow |
| Business-Logik | Services |
