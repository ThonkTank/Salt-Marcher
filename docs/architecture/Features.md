# Feature Layer

> **Lies auch:** [Core](Core.md), [EventBus](EventBus.md)
> **Wird benoetigt von:** Alle Features

Jedes Feature ist eine selbstständige Einheit mit State, Business Logic und StoragePort.

**Pfad:** `src/features/`

---

## Verzeichnis-Struktur

```
src/features/<name>/
├── types.ts           # State, Config, Events, StoragePort
├── orchestrator.ts    # State Machine + Business Logic
├── <name>-utils.ts    # Pure helper functions (optional)
└── index.ts           # Public exports
```

---

## StoragePort Pattern

Jedes Feature definiert seinen eigenen StoragePort. Infrastructure-Adapter implementieren diese Ports.

```typescript
// types.ts
interface MapStoragePort {
  loadMap(id: EntityId<'map'>): Promise<Result<HexMapData, AppError>>;
  saveMap(map: HexMapData): Promise<Result<void, AppError>>;
  listMaps(): Promise<Result<MapSummary[], AppError>>;
}

// orchestrator.ts
class MapOrchestrator {
  constructor(
    private readonly storage: MapStoragePort,
    private readonly eventBus: EventBus
  ) {}

  async loadMap(id: EntityId<'map'>): Promise<void> {
    const result = await this.storage.loadMap(id);
    if (!isOk(result)) {
      // Error handling, publish *-failed event
      return;
    }
    const data = unwrap(result);
    // ... state update, event publish
  }
}
```

**Datenfluss:**

```
Feature (Business Logic) → StoragePort Interface → Infrastructure Adapter → Vault
```

---

## Feature-Typen

| Typ | Beschreibung | State | Beispiele |
|-----|--------------|-------|-----------|
| **Primary** | State-Machine, reagiert auf `*-requested` Commands | State Machine | Map, TimeTracker, Almanac, Travel, Combat, EntityRegistry, Party, Quest, Encounter, Factions (Economy: Post-MVP) |
| **Reactive** | Reagiert auf Feature-Events, keine User-Commands | Derived/Generated | Environment (mit Submodulen) |
| **Hybrid** | Primaer reaktiv, aber mit optionalen Steuer-Commands | Generated + Commands | Audio (MoodContext + GM-Kontrolle) |

---

## Feature-Dependency-Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CORE LAYER (keine Dependencies)                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │   Schemas   │  │    Types    │  │    Utils    │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
│                         │                                                    │
│                         ▼                                                    │
│               ┌─────────────────┐                                           │
│               │    EventBus     │  (Kommunikations-Backbone)                │
│               └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRIMARY FEATURES (State Machines)                                           │
│                                                                              │
│  ┌──────────────────┐                                                       │
│  │  EntityRegistry  │  (Basis-Daten: Creatures, Items, NPCs, Factions)      │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│     ┌─────┼─────────────────────────┐                                       │
│     │     │                         │                                       │
│     ▼     ▼                         ▼                                       │
│  ┌──────┐ ┌──────┐              ┌───────┐                                   │
│  │ Map  │ │ Time │              │ Party │                                   │
│  └──┬───┘ └──┬───┘              └───┬───┘                                   │
│     │        │                      │                                       │
│     └────────┼──────────────────────┘                                       │
│              │                                                               │
│              ▼                                                               │
│        ┌──────────┐                                                         │
│        │  Travel  │  (Route-Planung, animierte Reisen)                      │
│        └────┬─────┘                                                         │
│             │                                                                │
│     ┌───────┴───────┐                                                       │
│     │               │                                                       │
│     ▼               ▼                                                       │
│  ┌───────────┐  ┌────────┐                                                  │
│  │ Encounter │  │  Quest │  (40/60 XP Split)                                │
│  └─────┬─────┘  └────────┘                                                  │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────┐                                                               │
│  │  Combat  │  (Initiative, Conditions, HP-Tracking)                        │
│  └──────────┘                                                               │
│                                                                              │
│  Weitere: Economy, Factions (abhaengig von EntityRegistry, Time)            │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACTIVE FEATURES (reagieren auf Primary Feature Events)                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────┐                        │
│  │  Environment                                     │                        │
│  │  ┌─────────────┐  ┌─────────────┐               │                        │
│  │  │   Weather   │  │   Lighting  │               │                        │
│  │  └─────────────┘  └─────────────┘               │                        │
│  │  Subscribes: time:state-changed, map:loaded,          │                        │
│  │              party:position-changed             │                        │
│  └─────────────────────────────────────────────────┘                        │
│                          │                                                   │
│                          ▼                                                   │
│  ┌─────────────────────────────────────────────────┐                        │
│  │  Audio (Hybrid)                                  │                        │
│  │  Reaktiv: MoodContext aus Map, Time, Weather    │                        │
│  │  Steuerbar: Pause, Skip, Volume, Override       │                        │
│  │  Subscribes: map:loaded, time:state-changed,          │                        │
│  │              environment:weather-changed,       │                        │
│  │              combat:started, travel:started     │                        │
│  └─────────────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dependency-Regeln

| Regel | Beschreibung |
|-------|--------------|
| **Top-Down** | Obere Features duerfen untere importieren (Queries) |
| **Events Up** | State-Aenderungen werden via Events nach oben propagiert |
| **Keine Zyklen** | A → B → A ist verboten |
| **Core importfrei** | Core-Layer importiert keine Features |

### Enforcement

Zyklische Abhängigkeiten werden via ESLint verhindert:

```javascript
// eslint.config.js
{
  rules: {
    'import-x/no-cycle': 'error'
  }
}
```

**IDE-Integration:** Fehler werden sofort in der IDE angezeigt.
**CI:** `npm run lint` läuft im Build-Prozess und blockiert bei Zyklen.

### Typische Event-Flows

```
Travel-Start:
  travel:start-requested
    → Travel Feature (state: traveling)
    → time:advance-requested (nach jedem Tile)
    → Time Feature (state: changed)
    → environment:weather-changed
    → Environment Feature (recalculate)
    → audio:context-changed
    → Audio Feature (track selection)

Encounter-Trigger:
  travel:moved (Tile-Wechsel)
    → Encounter Feature (check)
    → encounter:generated (bei Treffer)
    → DetailView (preview)
    → encounter:start-requested (GM bestaetigt)
    → Combat Feature (bei Combat-Type)
```

---

## Primary Features

### State Machine Pattern

**types.ts Struktur:**

```typescript
// 1. Status-Enum
type TravelStatus = 'idle' | 'planning' | 'traveling' | 'paused';

// 2. State-Type
interface TravelState {
  status: TravelStatus;
  route: Route | null;
  progress: TravelProgress | null;
  activeTransport: TransportMode;      // foot | mounted | carriage | boat (aktuell genutzt)
}
// Hinweis: position und availableTransports gehören zu PartyState (Party-Feature)

// 3. StoragePort (falls Persistenz benötigt)
interface TravelStoragePort {
  loadState(): Promise<Result<TravelPersistedState | null, AppError>>;
  saveState(state: TravelPersistedState): Promise<Result<void, AppError>>;
}

// 4. Config mit Default
interface TravelConfig { /* ... */ }
const DEFAULT_TRAVEL_CONFIG: TravelConfig = { /* ... */ };

// 5. Event-Payloads
interface TravelStartedPayload { routeId: string; from: Coordinate; /* ... */ }

// 6. State-Listener
type TravelStateListener = (state: TravelState) => void;
```

**Standard-Methoden:**

```typescript
interface FeaturePort {
  // State Access
  getState(): Readonly<State>;
  subscribe(listener: StateListener): () => void;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // Feature-spezifische Methoden
}
```

### Compensation Pattern

Bei Fehlern in Cross-Feature Workflows:

```typescript
// Bei Fehler: *-failed Event publishen
eventBus.publish({
  type: 'economy:transaction-failed',
  payload: { reason: 'insufficient_funds', itemId },
  correlationId: originalEvent.correlationId, // WICHTIG: übernehmen!
  timestamp: now(),
  source: 'economy-feature'
});

// Andere Features können reagieren
eventBus.subscribe('economy:transaction-failed', (event) => {
  if (this.pendingOperations.has(event.correlationId)) {
    this.compensate(event.correlationId);
  }
});
```

**Regeln:**
- Jedes Feature MUSS `*-failed` Events publishen bei Fehlern
- `correlationId` MUSS vom Ursprungs-Event übernommen werden
- Features SOLLTEN auf relevante `*-failed` Events reagieren können

### EntityRegistry Pattern

Generisches CRUD-Feature für alle Entity-Typen mit type-spezifischen Utils:

```typescript
interface EntityRegistryPort {
  // Generische CRUD-Operationen
  get<T extends EntityType>(type: T, id: EntityId<T>): Option<Entity<T>>;
  list<T extends EntityType>(type: T): Entity<T>[];
  query<T extends EntityType>(type: T, filter: EntityFilter<T>): Entity<T>[];
  save<T extends EntityType>(type: T, entity: Entity<T>): Result<void, AppError>;
  delete<T extends EntityType>(type: T, id: EntityId<T>): Result<void, AppError>;

  // Subscriptions
  subscribe<T extends EntityType>(type: T, listener: EntityChangeListener<T>): Unsubscribe;
  subscribeAll(listener: AnyEntityChangeListener): Unsubscribe;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;
}

// MVP Entity-Typen (15)
type EntityType =
  | 'creature' | 'character' | 'npc' | 'faction' | 'item' | 'culture'
  | 'map' | 'poi' | 'terrain'
  | 'quest' | 'encounter' | 'shop'
  | 'calendar' | 'journal' | 'worldevent'
  | 'track';
```

**Architektur:**
- EntityRegistry = Generisches CRUD (Persistenz, Caching, Queries)
- Type-spezifische Utils in `@core/utils/` (creature-utils, terrain-utils, encounter-utils, shop-utils, item-utils)
- Business Logic bleibt testbar und separiert

**Events:**
- `entity:saved` - Nach erfolgreichem Speichern
- `entity:deleted` - Nach erfolgreichem Löschen
- `entity:delete-requested` - **Workflow-Event** (wegen Referenz-Validierung)

**Design-Entscheidung: Warum separate StoragePorts?**

Maps, Almanac (WorldEvents/Journal), und Party haben eigene StoragePorts statt EntityRegistry:
- **Maps:** Komplexe Tile-Daten, eigene Queries (Pathfinding, Tile-Lookup), nicht schema-basiert
- **Almanac:** Time-basierte Queries, RecurrenceRules, Journal mit Entity-Links
- **Party:** Live-Session-State, haeufige Updates, Position-Tracking

Diese Trennung erlaubt domain-spezifische Optimierungen ohne das generische EntityRegistry zu verkomplizieren.

### Encounter Feature

```typescript
interface EncounterFeaturePort extends FeaturePort {
  getState(): Readonly<EncounterState>;

  // State Machine: idle → generating → preview → active → resolved
  //                                       ↓
  //                                  dismissed
  // Trigger: time-based | manual | location
}

type EncounterStatus = 'idle' | 'generating' | 'preview' | 'active' | 'dismissed' | 'resolved';

interface EncounterState {
  status: EncounterStatus;
  activeEncounter: EncounterInstance | null;
  previewEncounter: EncounterInstance | null;  // Fuer Preview-State
}
```

**Encounter-Flow:**
1. `encounter:generate-requested` → Feature generiert Encounter
2. `encounter:generated` → Encounter wird an DetailView geschickt (Preview)
3. GM sieht Preview und waehlt: Start / Dismiss / Regenerate
4. Bei Start: `encounter:start-requested` → Combat-Feature uebernimmt bei Combat-Type
5. Bei Dismiss: `encounter:dismiss-requested` → Feature resettet zu idle
6. Am Ende: `encounter:resolve-requested` → XP/Loot verteilt

**Events:** `encounter:generate-requested`, `encounter:generated`, `encounter:started`, `encounter:dismissed`, `encounter:resolved`
**Depends on:** Map, EntityRegistry, Environment, TimeTracker

### Economy Feature (Post-MVP)

> **MVP-Scope:** Im MVP zeigen Shops nur Preise an. Der GM passt Charakter-Inventare manuell an. Es gibt keine automatischen Transaktionen oder Stock-Verwaltung.

```typescript
// POST-MVP: Vollstaendiges Economy-Feature
interface EconomyFeaturePort extends FeaturePort {
  getState(): Readonly<EconomyState>;
}

interface EconomyState {
  // POST-MVP Features:
  transactionLog: Transaction[];           // Kauf/Verkauf-Historie
  shopStock: Map<ShopId, StockEntry[]>;    // Limitierte Warenbestaende
  restockTimers: Map<ShopId, Timestamp>;   // Automatisches Auffuellen
}
```

**MVP:** Kein EconomyFeature - Shop-Entity + `shop-utils.ts` (Preisberechnung) genuegen.

**Post-MVP Events:** `economy:transaction-completed`, `economy:transaction-failed`
**Depends on:** EntityRegistry, TimeTracker

### Factions Feature

```typescript
interface FactionsFeaturePort extends FeaturePort {
  getState(): Readonly<FactionsState>;
}

interface FactionsState {
  relations: FactionRelation[];
  reputation: Map<FactionId, number>;
  plannedActions: FactionAction[];
}
```

**Events:** `faction:relation-changed`, `faction:action-triggered`
**Depends on:** EntityRegistry, TimeTracker, Map

---

## Reactive Features

Reactive Features reagieren auf Feature-Events und haben **keine eigene State-Machine oder User-Commands**. Ihr State kann **deterministisch abgeleitet** (z.B. Lighting aus Zeit) oder **generiert** (z.B. Weather würfeln) werden.

**Hinweis:** Der Unterschied zwischen pure und generiertem State ist ein Implementierungsdetail - Code-Struktur und Event-Subscriptions sind identisch.

### Interface

```typescript
interface ReactiveFeaturePort<TState> {
  // Computed State (wird bei jedem Event neu berechnet)
  getState(): Readonly<TState>;
  subscribe(listener: (state: TState) => void): () => void;

  // Lifecycle
  initialize(): void;
  dispose(): void;

  // KEIN: startWorkflow(), transition(), etc.
}
```

### Beispiel: Environment Feature mit Submodulen

Environment ist ein Reactive Feature mit Weather und Lighting als Submodulen:

```
src/features/environment/
├── types.ts              # EnvironmentState, EnvironmentConfig
├── orchestrator.ts       # EnvironmentOrchestrator
├── weather/
│   ├── types.ts          # WeatherState, WeatherParams
│   ├── weather-engine.ts # Generation, Transitions
│   └── weather-effects.ts # Mechanical effects
├── lighting/
│   ├── types.ts          # LightingState
│   └── lighting-engine.ts
└── index.ts
```

```typescript
interface EnvironmentState {
  weather: WeatherState;
  lighting: LightingState;
}

class EnvironmentOrchestrator implements ReactiveFeaturePort<EnvironmentState> {
  private state: EnvironmentState;
  private weatherEngine: WeatherEngine;
  private lightingEngine: LightingEngine;

  initialize() {
    // Weather wird bei Segment-Wechsel neu berechnet (6x pro Tag)
    this.eventBus.subscribe('time:segment-changed', this.recalculateWeather);
    // Lighting bei jeder Zeitaenderung
    this.eventBus.subscribe('time:state-changed', this.recalculateLighting);
    this.eventBus.subscribe('map:loaded', this.recalculateAll);
    this.eventBus.subscribe('party:position-changed', this.recalculateWeather);
  }

  private recalculateWeather = () => {
    const partyPosition = this.partyFeature.getState().position;
    const map = this.mapFeature.getActiveMap();

    // Area-Averaging: Weather basiert auf Terrain der umgebenden Tiles
    const weather = this.weatherEngine.calculateAreaWeather(partyPosition, map);
    // ... publish events
  }
}
```

**Weather Area-Averaging:**

Wetter wird nicht pro Tile berechnet (3 Meilen waeren zu granular), sondern als Durchschnitt der Umgebung:
- **Radius:** 5 Tiles um die Party-Position
- **Gewichtung:** Distanz-gewichtet (naehere Tiles zaehlen mehr)
- **Terrain-Einfluss:** Nice-to-have (z.B. Berge blocken Wind, Wasser mildert Temperatur)

```typescript
function calculateAreaWeather(center: HexCoordinate, map: MapData): WeatherParams {
  const RADIUS = 5;
  const tiles = getTilesInRadius(center, RADIUS);

  let weightedParams = { temp: 0, wind: 0, precip: 0 };
  let totalWeight = 0;

  for (const tile of tiles) {
    const distance = hexDistance(center, tile);
    const weight = 1 / (distance + 1);  // Distanz-Gewichtung

    const tileParams = getBaseTileWeather(tile, map);
    weightedParams.temp += tileParams.temp * weight;
    // ... andere Parameter

    totalWeight += weight;
  }

  return normalizeWeather(weightedParams, totalWeight);
}
```

### Abgrenzung

| Typ | Input | Output |
|-----|-------|--------|
| **Primary** | `*-requested` Commands | State Machine Transitions |
| **Reactive** | Feature-Events (`*:changed`) | Derived State + `*:changed` Event |

---

## Audio (Hybrid Feature)

Audio ist ein **Hybrid-Feature**: Primaer reaktiv (waehlt automatisch Tracks basierend auf MoodContext), aber mit Steuer-Commands fuer GM-Kontrolle.

```
src/features/audio/
├── types.ts
├── orchestrator.ts
├── mood-tags/           # Tag-Aggregation (Submodul)
│   └── mood-context.ts  # Sammelt Tags von Map, Time, Weather + User-Tags
└── selection/           # Track-Auswahl-Logik
```

### Reaktives Verhalten

Audio reagiert automatisch auf Feature-Events und waehlt passende Tracks:

```typescript
interface MoodContext {
  locationType: 'wilderness' | 'dungeon' | 'town' | 'tavern' | ...;
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'storm' | 'snow' | ...;
  situation: 'exploration' | 'combat' | 'social' | 'rest' | 'travel';
  userTags: string[];  // GM-gesetzte Tags zur Verfeinerung
}

class AudioOrchestrator {
  private moodContext: MoodContext;

  initialize() {
    // Reaktive Subscriptions
    this.eventBus.subscribe('map:loaded', this.updateContext);
    this.eventBus.subscribe('time:state-changed', this.updateContext);
    this.eventBus.subscribe('environment:weather-changed', this.updateContext);
    this.eventBus.subscribe('combat:started', this.updateContext);
    this.eventBus.subscribe('travel:started', this.updateContext);

    // GM-Steuerungs-Commands
    this.eventBus.subscribe('audio:pause-requested', this.handlePause);
    this.eventBus.subscribe('audio:resume-requested', this.handleResume);
    this.eventBus.subscribe('audio:set-volume-requested', this.handleSetVolume);
    this.eventBus.subscribe('audio:skip-requested', this.handleSkip);
    this.eventBus.subscribe('audio:override-track-requested', this.handleOverride);
  }

  private updateContext = () => {
    this.moodContext = this.aggregateMoodContext();
    this.selectAndPlayTrack();
  }
}
```

### GM-Steuerung

Der GM kann via SessionRunner-UI eingreifen:

| Command | Beschreibung |
|---------|--------------|
| `audio:pause-requested` | Pausiert Wiedergabe |
| `audio:resume-requested` | Setzt Wiedergabe fort |
| `audio:set-volume-requested` | Volume pro Layer (0.0-1.0) |
| `audio:skip-requested` | Springt zum naechsten Track |
| `audio:override-track-requested` | GM waehlt manuell einen Track (optional) |

**Wichtig:** Nach einem Override bleibt der manuelle Track aktiv, bis der Kontext sich aendert oder der GM das Override aufhebt

---

## State Ownership & Persistence

| Kategorie | Beispiele | Owner | Persistenz | Reload-Verhalten |
|-----------|-----------|-------|------------|------------------|
| **Persistent** | Maps, Entities, Zeit | Feature + StoragePort | Vault | Wiederhergestellt |
| **Session** | Combat-State, UI-Zoom | Feature | Memory | Reset zu Idle |
| **Resumable** | Travel-Progress, Quest | Feature | Plugin-Data | Optional wiederhergestellt |

### Entity-Ownership (Runtime-Daten)

| Daten | Owner | Charakteristik |
|-------|-------|----------------|
| Creature-Template | EntityRegistry | Statische Definition |
| Character-Template | EntityRegistry | Persistente PC-Daten |
| NPC-Definition | EntityRegistry | Persistente NPC-Daten |
| Creature in Combat | Combat-Feature | Temporaere Instanz |
| NPC in Combat | Combat-Feature | Temporaere Instanz (referenziert NPC-Definition) |
| Party-Position | Party-Feature | Persistent |
| Party-Members | Party-Feature | Session-temporaer |
| Map-Tiles | Map-Feature (StoragePort) | Persistent |
| Active Route | Travel-Feature | Session-temporaer |
| Current Time | Time-Feature | Persistent |
| Active Weather | Environment-Feature | Computed (nicht persistiert) |

**Generelle Regel:**
- **EntityRegistry** = Persistente Definitionen (Templates, Configs, NPCs)
- **Feature-State** = Runtime-Instanzen und Session-Daten
- **StoragePort** = Feature-spezifische persistente Daten (z.B. Map-Tiles)

**Combat-Instanzen:**

```typescript
// Combat erstellt temporaere Instanzen aus Templates
interface CombatParticipant {
  sourceType: 'creature' | 'character' | 'npc';
  sourceId: EntityId<'creature' | 'character' | 'npc'>;

  // Kopierte/berechnete Werte fuer Combat
  currentHP: number;
  maxHP: number;
  initiative: number;
  conditions: Condition[];
}
```

Bei Combat-Ende:
- Character-Aenderungen (HP, Conditions) → zurueck zu EntityRegistry persistieren
- NPC-Aenderungen (Status: dead) → zurueck zu EntityRegistry persistieren
- Creature-Instanzen → verworfen (Template bleibt unveraendert)

### Resumable Pattern

Für wichtige Workflows die bei Plugin-Reload nicht verloren gehen sollen:

```typescript
interface ResumableFeature {
  serialize(): ResumableState | null;
  restore(state: ResumableState): boolean;
  readonly resumeEnabled: boolean;
}

// In main.ts onunload():
if (feature.resumeEnabled) {
  const state = feature.serialize();
  if (state) await plugin.saveData({ [name]: state });
}

// In main.ts onload():
const saved = await plugin.loadData();
if (saved?.[name] && !feature.restore(saved[name])) {
  feature.reset(); // Fallback zu Idle
}
```

**Regeln:**
- Session-State geht bei Reload verloren (Reset zu Idle)
- Resumable State wird im Plugin-Datenordner gespeichert, nicht im Vault
- Combat: Resumable via Snapshot *(LOW PRIO)* - wiederherstellbar bei Plugin-Reload

### Persistence Strategy: Pessimistic Save-First

Für alle persistierten Daten gilt die **Pessimistic (Save-First)** Strategie:

```
1. Speichern versuchen
2. Bei Erfolg: State ändern
3. UI informieren

Bei Save-Fehler: State bleibt unverändert
```

| Daten-Typ | Strategie | Begründung |
|-----------|-----------|------------|
| **Persistente Daten** (Maps, Entities, Party, Time, Almanac) | Pessimistic | User-Daten sind heilig |
| **Session-State** (Combat-State, UI-Zoom, Brush-Selection) | Kein Save | Wird bei Reload zurückgesetzt |
| **Resumable State** (Travel-Progress) | Pessimistic | Wenn gespeichert, dann korrekt |

**Implementierung:**

```typescript
async updateEntity(id: EntityId, changes: Partial<Entity>): Promise<Result<void, AppError>> {
  // 1. Erst speichern
  const saveResult = await this.storage.save(id, { ...existing, ...changes });
  if (!isOk(saveResult)) {
    // State bleibt unverändert bei Fehler
    return saveResult;
  }

  // 2. Dann State ändern
  this.state = { ...this.state, entity: { ...existing, ...changes } };

  // 3. UI informieren
  this.eventBus.publish({ type: 'entity:saved', ... });
  return ok(undefined);
}
```

**Warum Pessimistic?**
- User-Daten sind heilig - Datenverlust ist inakzeptabel
- UI zeigt nur bestätigte Änderungen
- Keine Inkonsistenz zwischen Memory und Disk

---

## Position-Ownership (Party vs Travel)

Es gibt zwei verschiedene "Positionen" mit unterschiedlichen Zwecken:

### Party-Position (Game-Mechanik)

```typescript
// PartyState.position ist Single Source of Truth
Party.state.position: HexCoordinate  // z.B. (5,3)
```

**Verwendung:**
- Encounter-Checks ("Auf welchem Tile steht die Party?")
- Weather-Berechnung (Area-Averaging um Party)
- Faction-Presence ("Wessen Gebiet?")
- Map-Navigation ("Von wo aus kann navigiert werden?")

**Aktualisierung:** Nur via `travel:moved` Event oder `party:update-requested`.

### Travel-Animation (Visuelles Rendering)

```typescript
// TravelState.animationState für Smooth-Movement zwischen Tiles
Travel.animationState: {
  from: HexCoordinate;    // Start-Tile
  to: HexCoordinate;      // Ziel-Tile
  progress: number;       // 0.0 - 1.0
}
```

**Verwendung:**
- Nur für Rendering (Party-Token bewegt sich visuell zwischen Tiles)
- Keine Game-Mechaniken basieren hierauf

### Mechanische Checks: Nur bei Tile-Wechsel

Alle spielrelevanten Checks erfolgen **ausschließlich beim Tile-Wechsel** via `travel:moved` Event:

| Check | Trigger | Basiert auf |
|-------|---------|-------------|
| Encounter-Check | `travel:moved` | **Ziel-Tile** |
| Weather-Update | `travel:moved` + `time:segment-changed` | Ziel-Tile (Area-Averaging) |
| Müdigkeit/Hunger | `travel:moved` | Verstrichene Zeit |
| Faction-Presence | `travel:moved` | Ziel-Tile |

**Während der Animation passiert nichts** - keine Checks, keine Zufallsereignisse.

**Encounter-Context basiert auf Ziel-Tile:** Wenn die Party von Wald (5,3) nach Sumpf (5,4) reist, basiert der Encounter auf dem Sumpf-Tile.

**Position-Update bei JEDEM Tile, nicht nur am Routen-Ende:**
Bei einer Route von (5,1) nach (5,5) wird `Party.position` bei jedem Tile-Wechsel aktualisiert:
- Tile 5,1 → 5,2: Animation → `travel:moved` → Position = 5,2 → Checks auf 5,2
- Tile 5,2 → 5,3: Animation → `travel:moved` → Position = 5,3 → Checks auf 5,3
- usw.

Dies stellt sicher, dass Encounter zur aktuellen Position passen (nicht zur Start-Location der Route).

### Flow-Beispiel

```
Travel-Animation bei 70% von (5,3) nach (5,4):
  ├── Rendering: Party-Token bewegt sich visuell zwischen Tiles
  └── Game-State: Party.position ist noch (5,3)
      └── KEINE mechanischen Checks während Animation

Travel-Animation erreicht 100%:
  ├── travel:moved { from: (5,3), to: (5,4) }
  ├── Party.position wird (5,4)
  ├── party:position-changed
  │   └── Encounter-Check auf Ziel-Tile (5,4)
  │   └── Weather-Update (Area-Averaging um 5,4)
  │   └── Faction-Presence-Check
  └── Alle anderen Features reagieren auf neue Position
```

**Wichtig:** Game-Mechaniken verwenden IMMER `Party.position`, nie die Animation-Position.

---

## Kommunikation

### Feature-Query-Policy

**Regel:** Read-Queries sind erlaubt, Mutations gehen via Events.

| Operation | Methode | Beispiel |
|-----------|---------|----------|
| **Reads/Queries** | Direkte Calls erlaubt | `mapFeature.getState()`, `timeFeature.getCurrentTime()` |
| **Writes/Commands** | Events only | `travel:start-requested` → TravelFeature |
| **State-Änderungen triggern** | Events only | Nie `otherFeature.setState()` direkt |

**Umsetzung:**

```typescript
// Jedes Feature exportiert ein Read-Only Port Interface
interface TimeFeaturePort {
  getCurrentTime(): GameDateTime;
  getActiveCalendar(): CalendarDefinition;
  // Keine Mutations hier!
}

interface PartyFeaturePort {
  getPosition(): { mapId: EntityId<'map'>; hex: HexCoordinate };
  getMembers(): EntityId<'character'>[];
  getPartySpeed(): number;
}

// Features erhalten andere Feature-Ports via Constructor
class TravelFeature {
  constructor(
    private eventBus: EventBus,
    private timeFeature: TimeFeaturePort,
    private partyFeature: PartyFeaturePort
  ) {}

  calculateETA() {
    const currentTime = this.timeFeature.getCurrentTime(); // ✅ Direct read
    return addDuration(currentTime, this.travelDuration);
  }

  startTravel() {
    this.eventBus.publish('travel:start-requested', { ... }); // ✅ Mutation via Event
  }
}
```

**Begruendung:**
- Read-Queries sind harmlos (keine Side Effects)
- Mutations via Events bleiben nachvollziehbar
- Einfacher als State-Caching
- Kein async fuer simple Reads noetig

### Cross-Feature Regeln

### Erlaubt

- **Query-Ports injizieren:** Features dürfen andere FeaturePorts als Dependency erhalten (für Reads)
- **Queries an StoragePort:** Async Calls für Persistenz
- **State publizieren:** `*:state-changed` Events
- **Utility-Imports:** Pure functions aus `@core/utils/`

### Verboten

- **Cross-Feature State-Änderungen:** Niemals direkt `otherFeature.doAction()` aufrufen
- **Bypassing EventBus für Commands:** Workflows MÜSSEN via Events kommunizieren

### Event-Flow

```
ViewModel ──[*-requested]──> Primary Feature
                                   │
                           [StoragePort Calls]
                                   │
                           [*:changed Events]
                                   │
                                   v
                         Reactive Features
                                   │
                        [*:state-changed Events]
                                   │
                                   v
                              ViewModel
```

---

## Testing

### Pattern: State-Machine-Tests mit MockEventBus + MockStorage

```typescript
describe('TravelOrchestrator', () => {
  let eventBus: MockEventBus;
  let storage: MockTravelStorage;
  let orchestrator: TravelFeaturePort;

  beforeEach(() => {
    eventBus = createMockEventBus();
    storage = createMockStorage();
    orchestrator = createTravelOrchestrator({
      eventBus,
      storage,
      // Query-Ports für Reads (erlaubt gemäß Cross-Feature Regeln)
      mapFeature: createMockMapFeature(),
      timeFeature: createMockTimeFeature()
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
- `createMockStorage()` - Mock StoragePort
- State Machine Helpers in `devkit/testing/helpers/`

---

## Checkliste: Primary Feature

- [ ] `types.ts`: Status-Enum, State-Type, StoragePort, Config, Event-Payloads, StateListener
- [ ] `orchestrator.ts`: `createXxxOrchestrator(deps)` Factory
- [ ] State Machine mit expliziten Transitions
- [ ] StoragePort für Persistenz definieren
- [ ] Events in `@core/events/domain-events.ts` definieren
- [ ] Subscriptions in `initialize()`, nicht im Constructor
- [ ] `*-failed` Events bei Fehlern publishen
- [ ] `correlationId` bei Event-Reaktionen übernehmen
- [ ] In `main.ts` registrieren
- [ ] Optional: `ResumableFeature` wenn State wichtig
- [ ] State-Machine-Tests mit MockEventBus + MockStorage

## Checkliste: Reactive Feature

- [ ] `types.ts`: ReactiveFeaturePort mit `getState()`, `subscribe()`
- [ ] Kein Status-Enum, nur Computed State
- [ ] Subscribe auf Feature-Events in `initialize()`
- [ ] Publiziere `*:changed` Events bei State-Aenderung
- [ ] `dispose()` für Cleanup

---

*Siehe auch: [EventBus.md](EventBus.md) | [Infrastructure.md](Infrastructure.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 2900 | ⬜ | Features/Economy | - | EconomyFeaturePort Interface mit getState() (Post-MVP) | niedrig | Nein | - | Features.md#economy-feature-post-mvp, Features.md#primary-features, Shop.md#prioritaet | [neu] src/features/economy/types.ts:EconomyFeaturePort, EconomyConfig |
| 2901 | ⛔ | Features/Economy | - | EconomyState: transactionLog, shopStock, restockTimers (Post-MVP) | niedrig | Nein | #2900 | Features.md#economy-feature-post-mvp, Shop.md#shopinventoryentry | [neu] src/features/economy/types.ts:EconomyState, Transaction, StockEntry |
| 2902 | ⛔ | Features/Economy | - | economy:transaction-completed Event (Post-MVP) | niedrig | Nein | #2900 | Features.md#economy-feature-post-mvp, Events-Catalog.md#event-naming-konvention, EventBus.md#event-naming-konvention | [neu] src/core/events/domain-events.ts:EconomyTransactionCompletedPayload |
| 2903 | ⛔ | Features/Economy | - | economy:transaction-failed Event mit Compensation Pattern (Post-MVP) | niedrig | Nein | #2900 | Features.md#compensation-pattern, Events-Catalog.md#event-naming-konvention, Error-Handling.md#event-fehlerbehandlung | [neu] src/core/events/domain-events.ts:EconomyTransactionFailedPayload mit correlationId |
| 2904 | ⛔ | Features/Economy | - | EconomyOrchestrator: Automatische Transaktionen + Stock-Verwaltung (Post-MVP) | niedrig | Nein | #2901, #2902, #2903 | Features.md#economy-feature-post-mvp, Features.md#state-machine-pattern, Shop.md#preis-berechnung | [neu] src/features/economy/orchestrator.ts:createEconomyOrchestrator(), processTransaction(), updateStock() |
| 2905 | ⬜ | Features/Factions | - | FactionsFeaturePort Interface mit getState() | hoch | Ja | #1400 | Features.md#factions-feature, Features.md#primary-features, Faction.md#schema | [neu] src/features/factions/types.ts:FactionsFeaturePort, FactionsConfig |
| 2906 | ⛔ | Features/Factions | - | FactionsState: relations, reputation, plannedActions | hoch | Ja | #2905, #1403 | Features.md#factions-feature, Faction.md#schema, Faction.md#events | [neu] src/features/factions/types.ts:FactionsState, FactionRelation, FactionAction |
| 2907 | ⛔ | Features/Factions | - | faction:relation-changed Event | hoch | Ja | #2905 | Features.md#factions-feature, Events-Catalog.md#faction, EventBus.md#event-naming-konvention | [neu] src/core/events/domain-events.ts:FactionRelationChangedPayload |
| 2908 | ⛔ | Features/Factions | - | faction:action-triggered Event | hoch | Ja | #2905 | Features.md#factions-feature, Events-Catalog.md#faction, EventBus.md#event-naming-konvention | [neu] src/core/events/domain-events.ts:FactionActionTriggeredPayload |
| 2909 | ⛔ | Features/Factions | - | FactionsOrchestrator: Relation-Tracking + Reputation-System | hoch | Ja | #2906, #2907, #2908, #1401 | Features.md#factions-feature, Features.md#state-machine-pattern, Faction.md#kultur-vererbung | [neu] src/features/factions/orchestrator.ts:createFactionsOrchestrator(), updateRelation(), calculateReputation() |
| 2910 | ⬜ | Architecture | - | Compensation Pattern: travel:failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Events-Catalog.md#travel, Error-Handling.md#event-fehlerbehandlung, Travel-System.md#fehlerbehandlung | src/features/travel/travel-service.ts:startTravel() [ändern - publish travel:failed bei Fehler] |
| 2911 | ✅ | Architecture | - | Compensation Pattern: encounter:failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Events-Catalog.md#encounter, Error-Handling.md#event-fehlerbehandlung, Encounter-System.md#events | src/features/encounter/encounter-service.ts:generateEncounter() [ändern - publish encounter:failed bei Fehler] |
| 2912 | ⬜ | Architecture | - | Compensation Pattern: combat:failed Event bei Fehler publizieren | mittel | Ja | - | Features.md#compensation-pattern, Events-Catalog.md#combat, Error-Handling.md#event-fehlerbehandlung, Combat-System.md#events | src/features/combat/combat-service.ts:startCombat() [ändern - publish combat:failed bei Fehler] |
| 2913 | ⬜ | Architecture | - | Compensation Pattern: map:load-failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Events-Catalog.md#map, Error-Handling.md#event-fehlerbehandlung, Map-Feature.md#events | src/features/map/map-service.ts:loadMap() [ändern - publish map:load-failed bei Fehler] |
| 2914 | ⬜ | Architecture | - | Compensation Pattern: entity:save-failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Features.md#entityregistry-pattern, EntityRegistry.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/infrastructure/vault/entity-adapter.ts:save() [ändern - publish entity:save-failed bei Fehler], delete() [ändern] |
| 2915 | ⛔ | Architecture | - | Compensation Pattern: Alle *-failed Events müssen correlationId übernehmen | hoch | Ja | #2910, #2914 | Features.md#compensation-pattern, EventBus.md#event-struktur-pflichtfelder, Error-Handling.md#event-fehlerbehandlung | src/core/events/domain-events.ts [ändern - add correlationId to all *-failed payloads], alle Feature-Services [ändern - correlationId propagieren] |
