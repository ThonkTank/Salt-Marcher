# Testing

> **Lies auch:** [Orchestration.md](Orchestration.md), [Services.md](Services.md)
> **Wird benoetigt von:** Tests schreiben

Test-Patterns pro Layer und Mock-Strategien.

---

## Uebersicht

SaltMarcher verwendet **Vitest** als Test-Framework.

```bash
npm test             # Watch-Modus
npx vitest run       # Alle Tests einmalig
npx vitest run <file> # Einzelne Datei
```

### Test-Strategie pro Layer

| Layer | Test-Typ | Mocking-Aufwand |
|-------|----------|-----------------|
| Schemas/Utils | Unit Tests | Keine Mocks |
| Services | Pipeline Tests | MockVault |
| sessionState | State-Machine Tests | MockServices, MockStorage |
| Views | Integration-Light | MocksessionState |

---

## Schemas/Utils Tests

### Pure Function Unit Tests

Utils sind pure functions ohne Side Effects - ideal fuer Unit Tests.

**Pfad:** `src/utils/`, `src/schemas/` (Tests neben Source)

```typescript
// @core/utils/hex-math.test.ts
import { hexDistance, coordToKey, hexNeighbors } from '@core/utils/hex-math';

describe('hexDistance', () => {
  it('should return 0 for same coordinate', () => {
    const coord = { q: 5, r: 3 };
    expect(hexDistance(coord, coord)).toBe(0);
  });

  it('should calculate distance correctly', () => {
    const a = { q: 0, r: 0 };
    const b = { q: 3, r: -2 };
    expect(hexDistance(a, b)).toBe(3);
  });

  it('should be symmetric', () => {
    const a = { q: 1, r: 2 };
    const b = { q: 4, r: -1 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });
});

describe('coordToKey', () => {
  it('should create unique string key', () => {
    expect(coordToKey({ q: 5, r: 3 })).toBe('5,3');
    expect(coordToKey({ q: -1, r: 10 })).toBe('-1,10');
  });
});

describe('hexNeighbors', () => {
  it('should return 6 neighbors', () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
  });
});
```

### Zod Schema Tests

```typescript
// @core/schemas/creature.test.ts
import { creatureSchema } from '@core/schemas/creature';

describe('creatureSchema', () => {
  it('should validate valid creature', () => {
    const creature = {
      id: 'creature-123',
      name: 'Goblin',
      cr: 0.25,
      maxHp: 7,
      ac: 15,
    };

    const result = creatureSchema.safeParse(creature);
    expect(result.success).toBe(true);
  });

  it('should reject invalid CR', () => {
    const creature = {
      id: 'creature-123',
      name: 'Goblin',
      cr: -1,  // Invalid
      maxHp: 7,
      ac: 15,
    };

    const result = creatureSchema.safeParse(creature);
    expect(result.success).toBe(false);
  });
});
```

---

## Feature Layer Tests

### State-Machine Tests

Features haben State-Machines die auf Events reagieren. Teste Transitions und Side-Effects.

**Pfad:** `src/features/` (Tests neben Source)

```typescript
// features/travel/travel.test.ts
import { createTravelOrchestrator } from '@/features/travel';
import { createMockEventBus } from 'test/helpers/mock-event-bus';
import { createMockStorage } from 'test/helpers/mock-storage';
import { createMockMapFeature, createMockTimeFeature } from 'test/helpers/mock-features';

describe('TravelOrchestrator', () => {
  let eventBus: MockEventBus;
  let storage: MockTravelStorage;
  let mapFeature: MockMapFeature;
  let timeFeature: MockTimeFeature;
  let orchestrator: TravelFeaturePort;

  beforeEach(() => {
    eventBus = createMockEventBus();
    storage = createMockStorage();
    mapFeature = createMockMapFeature(testMapData);
    timeFeature = createMockTimeFeature();

    orchestrator = createTravelOrchestrator({
      eventBus,
      storage,
      mapFeature,
      timeFeature,
    });
    orchestrator.initialize();
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  describe('State Transitions', () => {
    it('should start in idle state', () => {
      expect(orchestrator.getState().status).toBe('idle');
    });

    it('should transition idle → planning on plan-requested', () => {
      eventBus.simulate('travel:plan-requested', {
        from: { q: 0, r: 0 },
        to: { q: 5, r: 3 },
      });

      expect(orchestrator.getState().status).toBe('planning');
      expect(orchestrator.getState().route).toBeDefined();
    });

    it('should transition planning → traveling on start-requested', () => {
      // Setup: erst planning
      eventBus.simulate('travel:plan-requested', { from, to });

      // Act
      eventBus.simulate('travel:start-requested', {
        routeId: orchestrator.getState().route!.id,
      });

      expect(orchestrator.getState().status).toBe('traveling');
    });

    it('should reject start-requested in idle state', () => {
      eventBus.simulate('travel:start-requested', { routeId: 'invalid' });

      expect(orchestrator.getState().status).toBe('idle');
      expect(eventBus.published).toContainEqual(
        expect.objectContaining({ type: 'travel:start-failed' })
      );
    });
  });

  describe('Event Publishing', () => {
    it('should publish state-changed on transition', () => {
      eventBus.simulate('travel:plan-requested', { from, to });

      expect(eventBus.published).toContainEqual(
        expect.objectContaining({
          type: 'travel:state-changed',
          payload: expect.objectContaining({ status: 'planning' }),
        })
      );
    });

    it('should preserve correlationId in responses', () => {
      const correlationId = 'test-correlation-123';

      eventBus.simulate('travel:plan-requested', { from, to }, { correlationId });

      const stateChanged = eventBus.published.find(
        e => e.type === 'travel:state-changed'
      );
      expect(stateChanged?.correlationId).toBe(correlationId);
    });
  });

  describe('Storage Integration', () => {
    it('should persist state on transition', async () => {
      eventBus.simulate('travel:start-requested', { routeId });

      expect(storage.saved).toContainEqual(
        expect.objectContaining({ status: 'traveling' })
      );
    });

    it('should restore state on initialize', async () => {
      storage.setInitialState({ status: 'paused', route: testRoute });

      const newOrchestrator = createTravelOrchestrator({ eventBus, storage, mapFeature, timeFeature });
      await newOrchestrator.initialize();

      expect(newOrchestrator.getState().status).toBe('paused');
    });
  });
});
```

### Reactive Feature Tests

```typescript
// features/environment/environment.test.ts
describe('EnvironmentOrchestrator', () => {
  let eventBus: MockEventBus;
  let mapFeature: MockMapFeature;
  let partyFeature: MockPartyFeature;
  let timeFeature: MockTimeFeature;
  let orchestrator: EnvironmentFeaturePort;

  beforeEach(() => {
    eventBus = createMockEventBus();
    mapFeature = createMockMapFeature();
    partyFeature = createMockPartyFeature();
    timeFeature = createMockTimeFeature();

    orchestrator = createEnvironmentOrchestrator({
      eventBus,
      mapFeature,
      partyFeature,
      timeFeature,
    });
    orchestrator.initialize();
  });

  it('should recalculate weather on time:segment-changed', () => {
    const initialWeather = orchestrator.getState().weather;

    eventBus.simulate('time:segment-changed', {
      from: 'morning',
      to: 'midday',
    });

    // Weather sollte neu berechnet sein
    expect(orchestrator.getState().weather).toBeDefined();
  });

  it('should recalculate on party:position-changed', () => {
    partyFeature.setPosition({ q: 10, r: 5 }); // Anderes Terrain

    eventBus.simulate('party:position-changed', {
      from: { q: 0, r: 0 },
      to: { q: 10, r: 5 },
    });

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({ type: 'environment:weather-changed' })
    );
  });
});
```

---

## Application Layer Tests

### ViewModel Integration-Light Tests

**Pfad:** `src/application/` (Tests neben Source)

```typescript
// application/session-runner/viewmodel.test.ts
import { createSessionRunnerViewModel } from '@/application/session-runner/viewmodel';
import { createMockEventBus } from 'test/helpers/mock-event-bus';
import { createMockMapFeature, createMockTravelFeature } from 'test/helpers/mock-features';

describe('SessionRunnerViewModel', () => {
  let eventBus: MockEventBus;
  let mapFeature: MockMapFeature;
  let travelFeature: MockTravelFeature;
  let vm: SessionRunnerViewModel;

  beforeEach(() => {
    eventBus = createMockEventBus();
    mapFeature = createMockMapFeature(testMapData);
    travelFeature = createMockTravelFeature();

    vm = createSessionRunnerViewModel({
      eventBus,
      mapFeature,
      travelFeature,
    });
  });

  afterEach(() => {
    vm.dispose();
  });

  describe('State Management', () => {
    it('should emit render hint on state change', () => {
      const hints: RenderHint[] = [];
      vm.subscribe((state, hint) => hints.push(...hint));

      vm.selectTile({ q: 5, r: 3 });

      expect(hints).toContain('selection');
    });
  });

  describe('CRUD Operations', () => {
    it('should call feature directly for queries', () => {
      const tile = vm.getTile({ q: 5, r: 3 });

      expect(mapFeature.getTileCalled).toBe(true);
      expect(tile).toBeDefined();
    });
  });

  describe('Workflow Operations', () => {
    it('should publish event for travel start', () => {
      vm.startTravel('route-123');

      expect(eventBus.published).toContainEqual(
        expect.objectContaining({
          type: 'travel:start-requested',
          payload: { routeId: 'route-123' },
        })
      );
    });
  });

  describe('Event Subscriptions', () => {
    it('should update state on travel:started', () => {
      eventBus.simulate('travel:started', {
        route: testRoute,
        eta: testEta,
      });

      expect(vm.getState().travelActive).toBe(true);
    });
  });
});
```

---

## Mock Utilities

### MockEventBus

**Pfad:** `test/helpers/mock-event-bus.ts`

```typescript
interface MockEventBus {
  // Standard EventBus Interface
  publish<T>(event: DomainEvent<T>): void;
  subscribe<T>(type: string, handler: EventHandler<T>): Unsubscribe;

  // Test Utilities
  published: DomainEvent<unknown>[];
  simulate<T>(type: string, payload: T, options?: { correlationId?: string }): void;
  clearPublished(): void;
}

export function createMockEventBus(): MockEventBus {
  const handlers = new Map<string, Set<EventHandler<unknown>>>();
  const published: DomainEvent<unknown>[] = [];

  return {
    published,

    publish(event) {
      published.push(event);
      const typeHandlers = handlers.get(event.type);
      if (typeHandlers) {
        typeHandlers.forEach(handler => handler(event));
      }
    },

    subscribe(type, handler) {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)?.delete(handler);
    },

    simulate(type, payload, options = {}) {
      this.publish({
        type,
        payload,
        correlationId: options.correlationId ?? crypto.randomUUID(),
        timestamp: Date.now() as Timestamp,
        source: 'test',
      });
    },

    clearPublished() {
      published.length = 0;
    },
  };
}
```

### MockStorage

**Pfad:** `test/helpers/mock-storage.ts`

```typescript
interface MockStorage<T> {
  load(): Promise<Result<T | null, AppError>>;
  save(data: T): Promise<Result<void, AppError>>;

  // Test Utilities
  saved: T[];
  setInitialState(state: T): void;
  setShouldFail(fail: boolean): void;
}

export function createMockStorage<T>(): MockStorage<T> {
  let state: T | null = null;
  let shouldFail = false;
  const saved: T[] = [];

  return {
    saved,

    async load() {
      if (shouldFail) return err({ code: 'LOAD_FAILED', message: 'Mock failure' });
      return ok(state);
    },

    async save(data) {
      if (shouldFail) return err({ code: 'SAVE_FAILED', message: 'Mock failure' });
      saved.push(data);
      state = data;
      return ok(undefined);
    },

    setInitialState(newState) {
      state = newState;
    },

    setShouldFail(fail) {
      shouldFail = fail;
    },
  };
}
```

### MockFeature Factories

**Pfad:** `test/helpers/mock-features.ts`

```typescript
export function createMockMapFeature(mapData?: HexMapData): MockMapFeature {
  const data = mapData ?? createTestMapData();
  let getTileCalled = false;

  return {
    getTileCalled,

    getState() {
      return { mapId: data.id, status: 'loaded' };
    },

    getTile(coord: HexCoordinate) {
      getTileCalled = true;
      return data.tiles.get(coordToKey(coord)) ?? null;
    },

    getClimateZone() {
      return 'temperate';
    },
  };
}

export function createMockTravelFeature(): MockTravelFeature {
  let state: TravelState = { status: 'idle', route: null, progress: null };

  return {
    getState() {
      return state;
    },

    setState(newState: Partial<TravelState>) {
      state = { ...state, ...newState };
    },
  };
}

export function createMockTimeFeature(): MockTimeFeature {
  let currentTime = createTestGameDateTime();

  return {
    getCurrentTime() {
      return currentTime;
    },

    setCurrentTime(time: GameDateTime) {
      currentTime = time;
    },
  };
}
```

---

## Fixtures

**Pfad:** `test/fixtures/`

### Map Fixtures

```typescript
// test/fixtures/map.fixture.ts
export function createTestMapData(options?: Partial<HexMapData>): HexMapData {
  return {
    id: 'map-test' as EntityId<'map'>,
    name: 'Test Map',
    dimensions: { width: 10, height: 10 },
    tiles: createTestTiles(10, 10),
    ...options,
  };
}

function createTestTiles(width: number, height: number): Map<string, OverworldTile> {
  const tiles = new Map<string, OverworldTile>();

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      tiles.set(`${q},${r}`, {
        coordinate: { q, r },
        terrain: 'grassland',
        elevation: 100,
        locations: [],
      });
    }
  }

  return tiles;
}
```

### Creature Fixtures

```typescript
// test/fixtures/creature.fixture.ts
export function createTestCreature(options?: Partial<CreatureDefinition>): CreatureDefinition {
  return {
    id: 'creature-test' as EntityId<'creature'>,
    name: 'Test Goblin',
    cr: 0.25,
    maxHp: 7,
    ac: 15,
    speed: 30,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    ...options,
  };
}
```

### Time Fixtures

```typescript
// test/fixtures/time.fixture.ts
export function createTestGameDateTime(options?: Partial<GameDateTime>): GameDateTime {
  return {
    year: 1492,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    ...options,
  };
}
```

---

## Test Organization

### Verzeichnis-Struktur

```
src/                              # Tests neben Source-Code
├── core/
│   ├── types/
│   │   ├── result.ts
│   │   └── result.test.ts
│   └── utils/
│       ├── hex-math.ts
│       └── hex-math.test.ts
├── features/
│   ├── travel/
│   │   ├── index.ts
│   │   └── travel.test.ts
│   └── encounter/
│       ├── index.ts
│       └── encounter.test.ts
└── application/
    └── session-runner/
        ├── viewmodel.ts
        └── viewmodel.test.ts

test/                             # Test-Utilities auf Root-Ebene
├── helpers/
│   ├── mock-event-bus.ts
│   ├── mock-storage.ts
│   └── mock-features.ts
└── fixtures/
    ├── map.fixture.ts
    ├── creature.fixture.ts
    └── time.fixture.ts
```

### Naming Conventions

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| Unit Test | `<module>.test.ts` | `hex-math.test.ts` |
| Feature Test | `<feature>.test.ts` | `travel.test.ts` |
| ViewModel Test | `viewmodel.test.ts` | `viewmodel.test.ts` |
| Mock | `mock-<name>.ts` | `mock-event-bus.ts` |
| Fixture | `<entity>.fixture.ts` | `creature.fixture.ts` |

---

## Best Practices

### Do

- **Teste State-Transitions explizit** - Jede State-Machine Transition verdient einen Test
- **Teste correlationId-Propagation** - Events muessen correlationId weitergeben
- **Verwende Fixtures** - Konsistente Testdaten
- **Teste Failure-Cases** - Was passiert bei Storage-Fehler?
- **Isoliere Tests** - `beforeEach` + `afterEach` fuer Setup/Cleanup

### Don't

- **Keine echten Vault-Operationen** - Immer MockStorage verwenden
- **Keine setTimeout in Tests** - Verwende `vi.useFakeTimers()` wenn noetig
- **Nicht auf Implementierung testen** - Teste Verhalten, nicht interne State
- **Keine Tests die auf Reihenfolge angewiesen sind** - Jeder Test muss isoliert laufen

---

## Prioritaet

| Test-Bereich | MVP | Post-MVP |
|--------------|:---:|:--------:|
| Core Utils | ✓ | |
| Feature State-Machines | ✓ | |
| Event-Propagation | ✓ | |
| ViewModel Integration | | ✓ |
| Storage Integration | | ✓ |
| E2E Workflows | | ✓ |

---

