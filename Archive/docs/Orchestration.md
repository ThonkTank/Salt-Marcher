# Orchestration Layer

Koordiniert mehrere Domains für komplexe Workflows via State Machines.

**Pfad:** `src/orchestration/`

---

## Verzeichnis-Struktur

```
src/orchestration/<name>/
├── ports.ts           # OrchestratorPort Interface
├── orchestrator.ts    # State Machine + EventBus Integration
├── types.ts           # State, Config, Event-Payloads
├── <name>-*.ts        # Optional: Utility-Module
└── index.ts           # Public API
```

---

## Orchestrator-Typen

| Typ | Beschreibung | State | Beispiele |
|-----|--------------|-------|-----------|
| **Primary** | Startet Workflows, hört auf `*-requested` Events | State Machine | Travel, Combat, Quest |
| **Reactive** | Reagiert auf Domain-Events, berechnet Derived State | Computed | Environment, Audio |
| **Aggregator** | Aggregiert State aus 3+ Quellen | Merged | MoodContext |

---

## Primary Orchestrators

### State Machines

**types.ts Struktur:**

```typescript
// 1. Status-Enum
type TravelStatus = 'idle' | 'planning' | 'traveling' | 'paused' | 'arrived';

// 2. State-Type
interface TravelState {
  status: TravelStatus;
  route: Route | null;
  progress: TravelProgress | null;
  partyPosition: HexCoordinate;
}

// 3. Config mit Default
interface TravelConfig { /* ... */ }
const DEFAULT_TRAVEL_CONFIG: TravelConfig = { /* ... */ };

// 4. Event-Payloads
interface TravelStartedPayload { routeId: string; from: Coordinate; /* ... */ }

// 5. State-Listener
type TravelStateListener = (state: TravelState) => void;
```

**Port-Interface Standard-Methoden:**

```typescript
interface OrchestratorPort {
  // State Access
  getState(): Readonly<State>;
  subscribe(listener: StateListener): () => void;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // Domain-spezifische Methoden mit Result<T, AppError>
}
```

### Compensation Pattern

Bei Fehlern in Cross-Orchestrator Workflows:

```typescript
// Bei Fehler: *-failed Event publishen
eventBus.publish({
  type: 'economy:transaction-failed',
  payload: { reason: 'insufficient_funds', itemId },
  correlationId: originalEvent.correlationId, // WICHTIG: übernehmen!
  timestamp: now(),
  source: 'economy-orchestrator'
});

// Andere Orchestratoren können reagieren
eventBus.subscribe('economy:transaction-failed', (event) => {
  if (this.pendingOperations.has(event.correlationId)) {
    this.compensate(event.correlationId);
  }
});
```

**Regeln:**
- Jeder Orchestrator MUSS `*-failed` Events publishen bei Fehlern
- `correlationId` MUSS vom Ursprungs-Event übernommen werden
- Orchestratoren SOLLTEN auf relevante `*-failed` Events reagieren können

---

## Reactive Orchestrators

Reactive Orchestrators haben **keine State-Machine**. Sie berechnen Derived State aus Domain-Events.

### Interface

```typescript
interface ReactiveOrchestratorPort<TState> {
  // Computed State (wird bei jedem Event neu berechnet)
  getState(): Readonly<TState>;
  subscribe(listener: (state: TState) => void): () => void;

  // Lifecycle
  initialize(): void;
  dispose(): void;

  // KEIN: startWorkflow(), transition(), etc.
}
```

### Beispiel: EnvironmentOrchestrator

```typescript
class EnvironmentOrchestrator implements ReactiveOrchestratorPort<EnvironmentState> {
  private state: EnvironmentState;
  private listeners: Set<(state: EnvironmentState) => void> = new Set();

  initialize() {
    // Reagiert auf Quell-Events
    this.eventBus.subscribe('time:changed', this.recalculate);
    this.eventBus.subscribe('geography:position-changed', this.recalculate);
  }

  private recalculate = () => {
    const time = this.timeService.getCurrentTime();
    const climate = this.geographyService.getClimateAt(position);

    this.state = computeEnvironment(time, climate);
    this.notify();

    // Publiziert für andere Reactive Orchestrators
    this.eventBus.publish('environment:changed', this.state);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state));
  }
}
```

### Abgrenzung

| Typ | Input | Output |
|-----|-------|--------|
| **Primary** | `*-requested` Commands | State Machine Transitions |
| **Reactive** | Domain-Events (`*:changed`) | Derived State + `*:changed` Event |
| **Aggregator** | 3+ Quell-Events | Unified Context + `context:*-changed` Event |

---

## Context Aggregators

Wenn ein Orchestrator State aus 3+ Quellen benötigt:

```typescript
// FALSCH: Direct Multi-Subscription
subscribe('geography:position-changed', ...);
subscribe('time:changed', ...);
subscribe('environment:weather-changed', ...);
// → Tight Coupling, Race Conditions, partieller State

// RICHTIG: Context Aggregator
// MoodContextAggregator hört auf alle Quellen
// AudioOrchestrator hört nur auf aggregierten Context
subscribe('context:mood-changed', this.selectPlaylist);
```

### Struktur

```typescript
// src/orchestration/mood-context/
interface MoodContext {
  locationType: LocationType;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  situation: Situation;
}

// Aggregator hört auf Quell-Events, emittiert unified Context
eventBus.publish('context:mood-changed', aggregatedContext);
```

---

## State Ownership & Persistence

| Kategorie | Beispiele | Owner | Persistenz | Reload-Verhalten |
|-----------|-----------|-------|------------|------------------|
| **Persistent** | Maps, Entities, Zeit | Domain | Vault | Wiederhergestellt |
| **Session** | Combat-State, UI-Zoom | Orchestrator | Memory | Reset zu Idle |
| **Resumable** | Travel-Progress, Quest | Orchestrator | Plugin-Data | Optional wiederhergestellt |

### Resumable Pattern

Für wichtige Workflows die bei Plugin-Reload nicht verloren gehen sollen:

```typescript
interface ResumableOrchestrator {
  serialize(): ResumableState | null;
  restore(state: ResumableState): boolean;
  readonly resumeEnabled: boolean;
}

// In main.ts onunload():
if (orchestrator.resumeEnabled) {
  const state = orchestrator.serialize();
  if (state) await plugin.saveData({ [name]: state });
}

// In main.ts onload():
const saved = await plugin.loadData();
if (saved?.[name] && !orchestrator.restore(saved[name])) {
  orchestrator.reset(); // Fallback zu Idle
}
```

**Regeln:**
- Session-State geht bei Reload verloren (Reset zu Idle)
- Resumable State wird im Plugin-Datenordner gespeichert, nicht im Vault
- Combat ist bewusst Session-only (kein Resume mid-combat)

---

## Kommunikation

### Erlaubt

- **Queries an Domains:** Direkte Port-Calls
- **Commands an Domains:** Direkte Port-Calls
- **State publizieren:** `*:state-changed` Events

### Verboten

- **Cross-Orchestrator:** KEINE direkten Referenzen, NUR Events

### Event-Flow

```
ViewModel ──[*-requested]──→ Primary Orchestrator
                                    │
                            [Domain Port Calls]
                                    │
                            [*:changed Events]
                                    │
                                    ▼
                          Reactive Orchestrators
                                    │
                         [*:state-changed Events]
                                    │
                                    ▼
                               ViewModel
```

---

## Testing

### Pattern: State-Machine-Tests mit MockEventBus

```typescript
describe('TravelOrchestrator', () => {
  let eventBus: MockEventBus;
  let orchestrator: TravelOrchestratorPort;

  beforeEach(() => {
    eventBus = createMockEventBus();
    orchestrator = createTravelOrchestrator({
      eventBus,
      geography: createMockGeography(),
      time: createMockTime()
    });
    orchestrator.initialize();
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  it('should transition from idle to planning', () => {
    expect(orchestrator.getState().status).toBe('idle');

    eventBus.simulate('travel:plan-requested', { from, to });

    expect(orchestrator.getState().status).toBe('planning');
  });

  it('should publish state-changed on transition', () => {
    eventBus.simulate('travel:start-requested', { routeId });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({ type: 'travel:state-changed' })
    );
  });

  it('should preserve correlationId in responses', () => {
    const correlationId = 'test-correlation';
    eventBus.simulate('travel:start-requested', { routeId }, { correlationId });

    const stateChanged = eventBus.published.find(
      e => e.type === 'travel:state-changed'
    );
    expect(stateChanged.correlationId).toBe(correlationId);
  });
});
```

### Test-Utilities

- `createMockEventBus()` - Mock mit `simulate()` und `published[]`
- `createMockGeography()` - Mock GeographyServicePort
- `createMockTime()` - Mock TimeServicePort
- State Machine Helpers in `devkit/testing/helpers/`

---

## Checkliste: Primary Orchestrator

- [ ] `types.ts`: Status-Enum, State-Type, Config, Event-Payloads, StateListener
- [ ] `ports.ts`: OrchestratorPort mit `getState()`, `subscribe()`, `initialize()`, `dispose()`
- [ ] `orchestrator.ts`: `createXxxOrchestrator(deps)` Factory
- [ ] State Machine mit expliziten Transitions
- [ ] Events in `@core/events/domain-events.ts` definieren
- [ ] Subscriptions in `initialize()`, nicht im Constructor
- [ ] `*-failed` Events bei Fehlern publishen
- [ ] `correlationId` bei Event-Reaktionen übernehmen
- [ ] In `main.ts` registrieren
- [ ] Optional: `ResumableOrchestrator` wenn State wichtig
- [ ] State-Machine-Tests mit MockEventBus

## Checkliste: Reactive Orchestrator

- [ ] `ports.ts`: ReactiveOrchestratorPort mit `getState()`, `subscribe()`
- [ ] Kein Status-Enum, nur Computed State
- [ ] Subscribe auf Domain-Events in `initialize()`
- [ ] Publiziere `*:changed` Events bei State-Änderung
- [ ] `dispose()` für Cleanup

## Checkliste: Context Aggregator

- [ ] 3+ Quell-Events identifizieren
- [ ] Aggregierten Context-Type definieren
- [ ] Als Reactive Orchestrator implementieren
- [ ] `context:*-changed` Events emittieren
- [ ] Consumer subscriben NUR auf aggregierten Context

---

*Zurück zur [Übersicht](DevGuide.md) | Siehe auch: [EventBus.md](EventBus.md)*
