# SessionControl

> **Verantwortlichkeit:** Single Source of Truth fuer alle In-Session-Daten
> **Layer:** Orchestration
>
> **Verwandte Dokumente:**
> - [Orchestration.md](../architecture/Orchestration.md) - Layer-Uebersicht
> - [Services.md](../architecture/Services.md) - Service-Pipeline-Pattern

Der SessionControl ist der **einzige State-Owner** fuer alle In-Session-Daten. Er orchestriert Workflows und delegiert Business-Logik an stateless Services.

---

## Verantwortlichkeiten

| Aufgabe | SessionControl | Services |
|---------|---------------|----------|
| State halten | Ja | Nein |
| Workflows orchestrieren | Ja | Nein |
| Context fuer Services bauen | Ja | Nein |
| Business-Logik ausfuehren | Nein | Ja |
| Vault lesen/schreiben | via Services | Ja |
| UI-Updates ausloesen | Ja (reaktiver State) | Nein |

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

## Reaktiver State (Svelte Store)

Der SessionControl exponiert seinen State als Svelte Store:

```typescript
import { writable, type Writable } from 'svelte/store';

class SessionControl {
  readonly state: Writable<SessionState>;

  constructor(
    private readonly encounterService: EncounterService,
    private readonly weatherService: WeatherService,
    private readonly vault: VaultAdapter
  ) {
    this.state = writable(this.loadOrCreateInitialState());
  }

  // State-Update-Pattern
  private updateState(updater: (s: SessionState) => SessionState): void {
    this.state.update(updater);
  }

  // Getter fuer aktuellen State
  private getState(): SessionState {
    let current: SessionState;
    this.state.subscribe(s => current = s)();
    return current!;
  }
}
```

### View-Subscription

```svelte
<script>
  import { sessionControl } from '$lib/session';

  // Automatische Subscription via $-Prefix
  $: party = $sessionControl.state.party;
  $: travel = $sessionControl.state.travel;
  $: time = $sessionControl.state.time;
</script>

{#if travel.status === 'traveling'}
  <TravelProgress progress={travel.progress} />
{/if}

<button on:click={() => sessionControl.startTravel(route)}>
  Start Travel
</button>
```

---

## Context-Building

Der SessionControl baut vollstaendige Contexts fuer Services:

```typescript
class SessionControl {
  // Party-Snapshot fuer Services
  private buildPartySnapshot(): PartySnapshot {
    const state = this.getState();
    const members = state.party.members.map(id => {
      const char = this.vault.getEntity('character', id);
      return { id, level: char.level, hp: char.currentHp, ac: char.ac };
    });

    return {
      level: Math.max(...members.map(m => m.level)),
      size: members.length,
      members,
      position: state.party.position
    };
  }

  // Terrain aus aktiver Map
  private getCurrentTerrain(): TerrainDefinition {
    const state = this.getState();
    const map = this.vault.getEntity('map', state.activeMapId!);
    const tile = map.getTile(state.party.position);
    return this.vault.getEntity('terrain', tile.terrainId);
  }

  // Fraktions-Praesenz am aktuellen Ort
  private getFactionPresence(): FactionPresence[] {
    const state = this.getState();
    const map = this.vault.getEntity('map', state.activeMapId!);
    const tile = map.getTile(state.party.position);
    return tile.factionPresence ?? [];
  }
}
```

---

## Persistenz

### Session-State speichern

```typescript
class SessionControl {
  async saveSession(): Promise<Result<void, SaveError>> {
    const state = this.getState();

    // Nur persistierbare Teile speichern
    const persistable: PersistedSessionState = {
      party: state.party,
      time: state.time,
      activeMapId: state.activeMapId,
      travel: state.travel.status !== 'idle' ? state.travel : null,
      // UI-State wird NICHT persistiert
    };

    return this.vault.saveSessionState(persistable);
  }

  async loadSession(): Promise<Result<void, LoadError>> {
    const result = await this.vault.loadSessionState();
    if (isErr(result)) return result;

    const persisted = unwrap(result);

    // State wiederherstellen
    this.state.set({
      ...this.createInitialState(),
      party: persisted.party,
      time: persisted.time,
      activeMapId: persisted.activeMapId,
      travel: persisted.travel ?? { status: 'idle', route: null, progress: null }
    });

    // Wetter neu berechnen
    this.refreshWeather();

    return ok(undefined);
  }
}
```

### Persistenz-Kategorien

| Kategorie | Beispiele | Speicherung |
|-----------|-----------|-------------|
| **Persistent** | Party-Position, Zeit, aktive Map | Vault (JSON) |
| **Resumable** | Travel-Progress, Combat-State | Plugin-Data |
| **Session-only** | UI-State, Camera | Memory (verloren bei Reload) |

---

## API-Uebersicht

### Session-Lifecycle

| Methode | Beschreibung |
|---------|--------------|
| `newSession(mapId)` | Neue Session starten |
| `saveSession()` | Session speichern |
| `loadSession()` | Session laden |

### Zeit

| Methode | Beschreibung |
|---------|--------------|
| `advanceTime(duration)` | Zeit manuell voranschreiten |
| `setTime(dateTime)` | Zeit direkt setzen |

### Workflows

Details in den jeweiligen Workflow-Dokumenten:

| Workflow | Dokument |
|----------|----------|
| Travel | [TravelWorkflow.md](TravelWorkflow.md) |
| Encounter | [EncounterWorkflow.md](EncounterWorkflow.md) |
| Combat | [CombatWorkflow.md](CombatWorkflow.md) |
| Rest | [RestWorkflow.md](RestWorkflow.md) |
