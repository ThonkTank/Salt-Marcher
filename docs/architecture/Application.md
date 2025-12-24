# Application Layer

> **Lies auch:** [Features](Features.md), [Data-Flow](Data-Flow.md)
> **Wird benoetigt von:** SessionRunner, Library, Cartographer

UI-Komponenten und deren State-Management via MVVM Pattern.

**Pfad:** `src/application/`

---

## UI-Framework

**Entscheidung:** Vanilla JS + Obsidian Component-System

| Aspekt | Entscheidung | Begründung |
|--------|--------------|------------|
| **UI-Framework** | Vanilla JS | Keine zusätzlichen Dependencies, native Obsidian-Integration, einfacheres Build-Setup |
| **Component-System** | Obsidian Components | `Component` Basisklasse für Lifecycle-Management (`load()`, `unload()`, `registerEvent()`) |
| **State-Binding** | Manuelles Re-Rendering | ViewModel emittiert RenderHints → View ruft Panel-Updates auf |

**Kein React/Vue/Svelte** - Obsidian-Plugins profitieren nicht von virtuellen DOMs, und die Integration würde unnötige Komplexität hinzufügen.

---

## Verzeichnis-Struktur

```
src/application/<name>/
├── view.ts           # Obsidian ItemView Container
├── viewmodel.ts      # State Management + Koordination
├── types.ts          # State types, RenderHints
├── panels/           # UI-Bereiche (sprechen NUR mit ViewModel)
├── services/         # Algorithmen ohne State (optional)
└── utils/            # ToolView-spezifische Utilities (optional)
```

---

## MVVM Pattern

Jeder ToolView hat **eine** View und **ein** ViewModel (1:1 Beziehung).

```
┌─────────────────────────────────────────────────────────────────┐
│  VIEW (view.ts = Container für Panels)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Panels                                                  │   │
│  │  └── Nutzen @shared/ Components direkt                  │   │
│  │  └── State/Callbacks vom ViewModel                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ViewModel (State + Koordination)                        │   │
│  │  └── Workflow-Features → EventBus → Feature             │   │
│  │  └── CRUD/Queries → Direkte Feature-Calls               │   │
│  │  └── Algorithmen → services/                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## View-Architektur: SessionRunner + DetailView

Das Session-Management nutzt zwei Views, die parallel arbeiten:

| View | Position | Zweck |
|------|----------|-------|
| **SessionRunner** | Center Leaf | Map + Quick-Controls für schnellen GM-Zugriff |
| **DetailView** | Right Leaf | Kontextbezogene Detail-Ansichten (Encounter, Combat, Shop, etc.) |

```
┌────────────────────────────────────┬─────────────────────┐
│  SessionRunner (Center)            │  DetailView (Right) │
│  ┌──────┬───────────────────────┐  │  ┌───────────────┐  │
│  │Quick │                       │  │  │ Tab-Nav       │  │
│  │Ctrl  │       MAP             │  │  ├───────────────┤  │
│  │      │                       │  │  │               │  │
│  │Travel│                       │  │  │ Tab-Inhalt    │  │
│  │Audio │                       │  │  │ (Encounter,   │  │
│  │Party │                       │  │  │  Combat, etc.)│  │
│  │Action│                       │  │  │               │  │
│  └──────┴───────────────────────┘  │  └───────────────┘  │
└────────────────────────────────────┴─────────────────────┘
```

### View-Kommunikation

Die Views kommunizieren **ausschließlich via EventBus** - keine direkten Referenzen:

```typescript
// SessionRunner: Encounter generieren
this.eventBus.publish(createEvent('encounter:generate-requested', { position, terrainId }));

// DetailView: Auto-Open bei Event
this.eventBus.subscribe('encounter:generated', () => {
  this.setActiveTab('encounter');
});
```

### Auto-Open Verhalten (DetailView)

| Event | Aktion |
|-------|--------|
| `encounter:generated` | Wechsle zu Encounter-Tab |
| `combat:started` | Wechsle zu Combat-Tab |

**Priorität:** Combat > Encounter > andere Tabs (Combat unterbricht nie laufende Anzeige außer Encounter).

**Details:** [SessionRunner.md](../application/SessionRunner.md) | [DetailView.md](../application/DetailView.md)

---

## ViewModel ↔ Feature Kommunikation

### Entscheidungsbaum: CRUD oder Workflow?

```
┌─────────────────────────────────────────────────────────────┐
│  1. Hat die Operation eine State-Machine?                   │
│     └─ JA → WORKFLOW (EventBus)                            │
│     └─ NEIN → weiter zu 2.                                 │
│                                                             │
│  2. Kann die Operation andere Features beeinflussen?        │
│     └─ JA → WORKFLOW (EventBus)                            │
│     └─ NEIN → weiter zu 3.                                 │
│                                                             │
│  3. Ist die Operation synchron und atomar?                  │
│     └─ JA → CRUD (Direkter Feature-Call)                   │
│     └─ NEIN → WORKFLOW (EventBus)                          │
└─────────────────────────────────────────────────────────────┘
```

**Formale Definition:**
> **CRUD** = Isolierte, synchrone, atomare Operationen ohne State-Machine und ohne Auswirkungen auf andere Features.
>
> **Workflow** = Operationen mit State-Machine ODER Cross-Feature Side-Effects ODER asynchronem Multi-Step-Ablauf.

### Operations-Zuordnung

| Operation | State-Machine | Cross-Feature | Sync/Atomar | Typ |
|-----------|:-------------:|:-------------:|:-----------:|:---:|
| Terrain malen | ✗ | ✗ | ✓ | CRUD |
| Tile löschen | ✗ | ✗ | ✓ | CRUD |
| Entity erstellen/bearbeiten | ✗ | ✗ | ✓ | CRUD |
| Entity löschen | ✗ | ✓ (Referenzen!) | ✗ | **Workflow** |
| Map laden | ✗ | ✓ (Travel reset) | ✗ | **Workflow** |
| Zeit manuell setzen | ✗ | ✓ (Weather, Travel) | ✗ | **Workflow** |
| Undo/Redo | ✓ | ✓ | ✓ | **Workflow** |
| Travel starten/stoppen | ✓ | ✓ | ✗ | Workflow |
| Combat starten/beenden | ✓ | ✓ | ✗ | Workflow |
| Encounter generieren | ✗ | ✓ | ✗ | **Workflow** |
| Alle Daten-Abfragen | - | - | ✓ | Query (Direkt) |

### Implementation

```typescript
// ViewModel: Zeit setzen (Workflow - wegen Cross-Feature Effects)
setTime(newTime: GameDateTime): void {
  this.eventBus.publish({
    type: EventTypes.TIME_SET_REQUESTED,
    payload: { newTime },
    correlationId: crypto.randomUUID(),
    timestamp: now(),
    source: 'session-runner-viewmodel'
  });
}

// ViewModel: Entity bearbeiten (CRUD - isoliert)
updateCreature(id: CreatureId, changes: Partial<Creature>): void {
  const result = this.entityRegistry.save('creature', { ...existing, ...changes });
  if (!isOk(result)) {
    this.showError(unwrapErr(result));
  }
}

// ViewModel: Query (immer direkt)
getCreature(id: CreatureId): Option<Creature> {
  return this.entityRegistry.get('creature', id);
}
```

---

## Verantwortlichkeiten

| Komponente | Darf | Darf NICHT |
|------------|------|------------|
| **Panels** | Rendern, @shared/ nutzen, lokaler UI-State | Direkte Feature-Calls |
| **ViewModel** | State, EventBus (Workflows), Feature-Calls (CRUD/Queries) | DOM Manipulation, Algorithmen |
| **services/** | Algorithmen (Brush, Pathfinding) | State Management |

---

## Render Hints

ViewModel emittiert `RenderHint` für optimiertes Panel-Rendering:

| Hint | Bedeutung |
|------|-----------|
| `'full'` | Alles neu rendern |
| `'tiles'` | Nur Kacheln |
| `'camera'` | Nur Viewport |
| `'ui'` | Nur UI-Elemente |
| `'selection'` | Nur Selektion |
| `'brush'` | Nur Brush-Preview |

---

## Shared Components (`@shared/`)

Wiederverwendbare, stateless UI-Komponenten:

```
src/application/shared/
├── rendering/        # Map-Rendering (siehe unten)
├── form/             # Form Controls (Select, Slider, Button)
├── layout/           # Layout Helpers
├── types/            # Gemeinsame Types
└── view/             # BaseToolView Lifecycle
```

**Regel:** Komponente in 2+ ToolViews verwendet → nach `@shared/` extrahieren.

---

## Rendering (`@shared/rendering/`)

Rendering gehört in die Application Layer, nicht Infrastructure (UI-Concern, kein externes System).

### Technologie: Canvas 2D API

**Entscheidung:** Native Canvas 2D API (keine externe Library)

| Alternative | Entscheidung | Begründung |
|-------------|--------------|------------|
| **Canvas 2D** | ✓ Gewählt | Guter Kompromiss aus Einfachheit und Performance, keine Dependencies, ausreichend für Hex-Maps |
| SVG | ✗ | Kann bei großen Maps (1000+ Hexes) laggen durch DOM-Overhead |
| PixiJS/WebGL | ✗ | Over-Engineering für 2D Hex-Maps, zusätzliche Dependency |

**Hex-Geometrie:** Clean-Room Neuimplementierung (Alpha3 nur als Konzept-Referenz).

```
src/application/shared/rendering/
├── canvas/           # Canvas 2D Rendering
│   ├── renderer.ts   # MapRenderer Interface + Impl
│   ├── layers.ts     # Layer-Management (terrain, grid, entities, ui)
│   └── camera.ts     # Viewport, Pan, Zoom
├── primitives/       # Render-Primitives
│   ├── hex.ts        # Hex-Geometrie (portiert aus Alpha3)
│   ├── grid.ts       # Grid-Geometrie
│   └── shapes.ts     # Allgemeine Formen
└── strategies/       # Map-Typ-spezifisch
    ├── hex-strategy.ts
    ├── grid-strategy.ts
    └── town-strategy.ts
```

### Renderer Interface

```typescript
interface MapRenderer {
  render(state: RenderState, hints: RenderHint[]): void;
  setCamera(camera: Camera): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

**Regeln:**
- Renderer sind **stateless** - sie erhalten RenderState vom ViewModel
- Keine Geschäftslogik in Renderern
- ViewModel besitzt RenderState, Renderer zeichnet nur

---

## View Factory Pattern

ToolViews werden via Factory registriert, die alle Dependencies kapselt:

```typescript
// Factory kapselt Dependencies
function createCartographerViewFactory(
  mapFeature: MapFeaturePort,
  eventBus: EventBus
): ViewFactory {
  return (leaf: WorkspaceLeaf) => new CartographerView(leaf, mapFeature, eventBus);
}

// Registrierung in main.ts
const factory = createCartographerViewFactory(mapFeature, eventBus);
this.registerView(VIEW_TYPE_CARTOGRAPHER, factory);
```

**Regeln:**
- View erhält Dependencies via Constructor, nicht via globale Imports
- Factory ist die einzige Stelle die Dependencies kennt
- Ermöglicht Testbarkeit (Mock-Dependencies injizieren)

---

## Testing

### Pattern: Integration-Light mit Mocks

```typescript
describe('CartographerViewModel', () => {
  let eventBus: MockEventBus;
  let mapFeature: MockMapFeature;
  let vm: CartographerViewModel;

  beforeEach(() => {
    eventBus = createMockEventBus();
    mapFeature = createMockMapFeature(testMapData);
    vm = createCartographerViewModel({ eventBus, mapFeature });
  });

  afterEach(() => {
    vm.dispose();
  });

  it('should update state when brush changes', () => {
    vm.setBrush({ type: 'terrain', terrain: 'forest' });

    expect(vm.getState().activeBrush.terrain).toBe('forest');
  });

  it('should emit render hint on brush change', () => {
    const hints: RenderHint[] = [];
    vm.subscribe((state, hint) => hints.push(...hint));

    vm.setBrush({ type: 'terrain', terrain: 'forest' });

    expect(hints).toContain('brush');
  });

  it('should publish event for workflow features', () => {
    vm.startTravel(routeId);

    expect(eventBus.published).toContainEqual(
      expect.objectContaining({ type: 'travel:start-requested' })
    );
  });
});
```

### Test-Utilities

- `createMockEventBus()` - Mock EventBus
- `createMockMapFeature(data)` - Mock MapFeaturePort
- Fixtures in `devkit/testing/fixtures/`

---

## Checkliste: Neues ViewModel

- [ ] 1:1 Beziehung zu View
- [ ] Dependencies: EventBus + Feature-Ports (read-only für Queries)
- [ ] Workflow-Features → EventBus (`*-requested`)
- [ ] CRUD-Features → Direkte Feature-Calls
- [ ] Queries → Direkte Feature-Calls
- [ ] Algorithmen → in `services/` auslagern
- [ ] State-Updates via Events empfangen
- [ ] `subscribe()` für State-Listener
- [ ] `dispose()` für EventBus-Subscriptions Cleanup
- [ ] RenderHints für optimiertes Re-Rendering
- [ ] Integration-Light-Tests mit Mocks

---

*Siehe auch: [Features.md](Features.md) | [EventBus.md](EventBus.md) | [SessionRunner.md](../application/SessionRunner.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 2599 | ✅ | Application/Library | - | LibraryView Container (Obsidian ItemView) Umgesetzt: - View in main.ts registriert (registerView) - Ribbon-Icon 'book-open' für Library hinzugefügt - Command 'open-library' hinzugefügt - Alle vorbereiteten Deliverables waren bereits implementiert (view.ts, viewmodel.ts, types.ts, index.ts) | hoch | Ja | #2621, #2706 | Application.md#mvvm-pattern, Application.md#view-factory-pattern, Library.md | main.ts [geändert]: - Import VIEW_TYPE_LIBRARY, LibraryView aus ./application/library - registerView(VIEW_TYPE_LIBRARY, ...) mit entityRegistry + eventBus - addRibbonIcon('book-open', 'Open Library', ...) - addCommand({ id: 'open-library', name: 'Open Library', ... }) Bereits implementiert (unverändert): - src/application/library/view.ts: LibraryView, createLibraryViewFactory() - src/application/library/viewmodel.ts: createLibraryViewModel() - src/application/library/types.ts: VIEW_TYPE_LIBRARY - src/application/library/index.ts: Public API Exports |
| 2900 | ⬜ | Features/Economy | - | EconomyFeaturePort Interface mit getState() (Post-MVP) | niedrig | Nein | - | Features.md#economy-feature-post-mvp, Features.md#primary-features, Shop.md#prioritaet | [neu] src/features/economy/types.ts:EconomyFeaturePort, EconomyConfig |
| 2901 | ⛔ | Features/Economy | - | EconomyState: transactionLog, shopStock, restockTimers (Post-MVP) | niedrig | Nein | #2900 | Features.md#economy-feature-post-mvp, Shop.md | [neu] src/features/economy/types.ts:EconomyState, Transaction, StockEntry |
| 2902 | ⛔ | Features/Economy | - | economy:transaction-completed Event (Post-MVP) | niedrig | Nein | #2900 | Features.md#economy-feature-post-mvp, EventBus.md#event-naming-konvention, Events-Catalog.md | [neu] src/core/events/domain-events.ts:EconomyTransactionCompletedPayload |
| 2903 | ⛔ | Features/Economy | - | economy:transaction-failed Event mit Compensation Pattern (Post-MVP) | niedrig | Nein | #2900 | Features.md#compensation-pattern, EventBus.md#event-naming-konvention, Events-Catalog.md | [neu] src/core/events/domain-events.ts:EconomyTransactionFailedPayload mit correlationId |
| 2904 | ⛔ | Features/Economy | - | EconomyOrchestrator: Automatische Transaktionen + Stock-Verwaltung (Post-MVP) | niedrig | Nein | #2901, #2902, #2903 | Features.md#economy-feature-post-mvp, Shop.md, Item.md | [neu] src/features/economy/orchestrator.ts:createEconomyOrchestrator(), processTransaction(), updateStock() |
| 2905 | ⬜ | Features/Factions | - | FactionsFeaturePort Interface mit getState() | hoch | Ja | #1400 | Features.md#factions-feature, Features.md#primary-features, Faction.md | [neu] src/features/factions/types.ts:FactionsFeaturePort, FactionsConfig |
| 2906 | ⛔ | Features/Factions | - | FactionsState: relations, reputation, plannedActions | hoch | Ja | #2905, #1403 | Features.md#factions-feature, Faction.md#schema, Faction.md#events | [neu] src/features/factions/types.ts:FactionsState, FactionRelation, FactionAction |
| 2907 | ⛔ | Features/Factions | - | faction:relation-changed Event | hoch | Ja | #2905 | Features.md#factions-feature, EventBus.md#event-naming-konvention, Events-Catalog.md | [neu] src/core/events/domain-events.ts:FactionRelationChangedPayload |
| 2908 | ⛔ | Features/Factions | - | faction:action-triggered Event | hoch | Ja | #2905 | Features.md#factions-feature, EventBus.md#event-naming-konvention, Events-Catalog.md | [neu] src/core/events/domain-events.ts:FactionActionTriggeredPayload |
| 2909 | ⛔ | Features/Factions | - | FactionsOrchestrator: Relation-Tracking + Reputation-System | hoch | Ja | #2906, #2907, #2908, #1401 | Features.md#factions-feature, Faction.md, NPC-System.md | [neu] src/features/factions/orchestrator.ts:createFactionsOrchestrator(), updateRelation(), calculateReputation() |
| 2910 | ⬜ | Architecture | - | Compensation Pattern: travel:failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Travel-System.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/features/travel/travel-service.ts:startTravel() [ändern - publish travel:failed bei Fehler] |
| 2911 | ✅ | Architecture | - | Compensation Pattern: encounter:failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Encounter-System.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/features/encounter/encounter-service.ts:generateEncounter() [ändern - publish encounter:failed bei Fehler] |
| 2912 | ⬜ | Architecture | - | Compensation Pattern: combat:failed Event bei Fehler publizieren | mittel | Ja | - | Features.md#compensation-pattern, Combat-System.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/features/combat/combat-service.ts:startCombat() [ändern - publish combat:failed bei Fehler] |
| 2913 | ⬜ | Architecture | - | Compensation Pattern: map:load-failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Map-Feature.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/features/map/map-service.ts:loadMap() [ändern - publish map:load-failed bei Fehler] |
| 2914 | ⬜ | Architecture | - | Compensation Pattern: entity:save-failed Event bei Fehler publizieren | hoch | Ja | - | Features.md#compensation-pattern, Features.md#entityregistry-pattern, EntityRegistry.md, EventBus.md#event-naming-konvention, Events-Catalog.md | src/infrastructure/vault/entity-adapter.ts:save() [ändern - publish entity:save-failed bei Fehler], delete() [ändern] |
| 2915 | ⛔ | Architecture | - | Compensation Pattern: Alle *-failed Events müssen correlationId übernehmen | hoch | Ja | #2910-#2914 | Features.md#compensation-pattern, EventBus.md#event-struktur-pflichtfelder, Events-Catalog.md | src/core/events/domain-events.ts [ändern - add correlationId to all *-failed payloads], alle Feature-Services [ändern - correlationId propagieren] |
