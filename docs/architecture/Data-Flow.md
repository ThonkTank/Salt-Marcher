# Data-Flow

> **Lies auch:** [Features](Features.md), [EventBus](EventBus.md)
> **Wird benoetigt von:** Application

Diagramme und Beschreibungen wie Daten zwischen Features fliessen.

---

## Uebersicht

SaltMarcher verwendet einen **unidirektionalen Datenfluss**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                               │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │   View      │ ◄────── │  ViewModel  │ ◄────── │   Panels    │        │
│  └─────────────┘         └──────┬──────┘         └─────────────┘        │
│                                 │                                        │
│              ┌──────────────────┼──────────────────┐                     │
│              │                  │                  │                     │
│              ▼                  ▼                  ▼                     │
│         EventBus           Direct Calls       EventBus                   │
│       (Workflows)          (CRUD/Query)     (Subscriptions)              │
└──────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            FEATURE LAYER                                  │
│                                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐   │
│  │    Map     │    │   Travel   │    │   Time     │    │ Encounter  │   │
│  │  Feature   │◄───│  Feature   │───►│  Feature   │───►│  Feature   │   │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘   │
│        │                 │                 │                 │          │
│        │     EventBus (Cross-Feature Communication)          │          │
│        └────────────────────────────────────────────────────────┘        │
│                                 │                                        │
│                                 ▼                                        │
│                          StoragePort                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                              │
│                                                                          │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐         │
│  │  VaultAdapter  │    │  AudioAdapter  │    │  CacheAdapter  │         │
│  └───────┬────────┘    └────────────────┘    └────────────────┘         │
│          │                                                               │
│          ▼                                                               │
│       Obsidian Vault (Markdown Files, JSON Data)                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Event-basierter Datenfluss

### Request → Response Pattern

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ViewModel                      Feature                    ViewModel     │
│      │                             │                           │         │
│      │   travel:start-requested    │                           │         │
│      │────────────────────────────►│                           │         │
│      │       { routeId }           │                           │         │
│      │                             │                           │         │
│      │                             │  [State Transition]       │         │
│      │                             │  [Persistence]            │         │
│      │                             │                           │         │
│      │                             │   travel:started          │         │
│      │◄────────────────────────────│──────────────────────────►│         │
│      │                             │      { route, eta }       │         │
│      │                             │                           │         │
│                   ODER bei Fehler:                                       │
│      │                             │                           │         │
│      │                             │   travel:start-failed     │         │
│      │◄────────────────────────────│──────────────────────────►│         │
│      │                             │      { error }            │         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Cross-Feature Event-Chain

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Travel          Time            Environment        Encounter            │
│     │              │                  │                 │                │
│     │              │                  │                 │                │
│     │  travel:moved (Party auf neuem Tile)              │                │
│     │─────────────────────────────────────────────────────────────────►  │
│     │              │                  │                 │                │
│     │              │                  │  [Recalculate]  │                │
│     │              │                  │  Weather        │                │
│     │              │                  │                 │                │
│     │              │    environment:weather-changed     │                │
│     │◄─────────────────────────────────────────────────────────────────  │
│     │              │                  │                 │                │
│     │              │                  │                 │ [Check]        │
│     │              │                  │                 │ Encounter      │
│     │              │                  │                 │                │
│     │              │   encounter:generated (optional)   │                │
│     │◄─────────────────────────────────────────────────────────────────  │
│     │              │                  │                 │                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## CRUD vs Workflow Datenfluss

### CRUD (Direkte Calls)

Fuer isolierte, synchrone, atomare Operationen:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ViewModel                  EntityRegistry                 │
│      │                           │                         │
│      │   entityRegistry.save()   │                         │
│      │──────────────────────────►│                         │
│      │                           │  [Validate]             │
│      │                           │  [Persist]              │
│      │       Result<void, E>     │                         │
│      │◄──────────────────────────│                         │
│      │                           │                         │
│      │  [Update Local State]     │                         │
│      │  [Notify Subscribers]     │                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Workflow (EventBus)

Fuer Operationen mit State-Machine oder Cross-Feature Effects:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ViewModel        EventBus        Feature A    Feature B   │
│      │               │               │             │       │
│      │   publish()   │               │             │       │
│      │──────────────►│   dispatch    │             │       │
│      │               │──────────────►│             │       │
│      │               │               │ [Process]   │       │
│      │               │               │             │       │
│      │               │   publish()   │             │       │
│      │               │◄──────────────│             │       │
│      │               │   dispatch    │             │       │
│      │◄──────────────│──────────────────────────►  │       │
│      │               │               │             │       │
│      │ [React to     │               │   [React]   │       │
│      │  State Change]│               │             │       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Feature-Dependencies

### Dependency Graph

```
                                ┌─────────────┐
                                │    Core     │
                                │  (Schemas,  │
                                │   Types)    │
                                └──────┬──────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
    ┌─────────────┐             ┌─────────────┐             ┌─────────────┐
    │    Map      │             │    Time     │             │   Entity    │
    │  Feature    │             │  Feature    │             │  Registry   │
    └──────┬──────┘             └──────┬──────┘             └──────┬──────┘
           │                           │                           │
           └───────────────┬───────────┴───────────┬───────────────┘
                           │                       │
                           ▼                       ▼
                    ┌─────────────┐         ┌─────────────┐
                    │   Party     │         │   Faction   │
                    │  Feature    │         │  Feature    │
                    └──────┬──────┘         └──────┬──────┘
                           │                       │
                           └───────────┬───────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
    ┌─────────────┐             ┌─────────────┐             ┌─────────────┐
    │   Travel    │             │ Environment │             │  Encounter  │
    │  Feature    │             │  (Reactive) │             │  Feature    │
    └──────┬──────┘             └─────────────┘             └──────┬──────┘
           │                                                       │
           │                    ┌─────────────┐                    │
           │                    │   Combat    │                    │
           └───────────────────►│  Feature    │◄───────────────────┘
                                └──────┬──────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │    Loot     │
                                │  Feature    │
                                └─────────────┘
```

### Query-Dependencies (erlaubt)

Features duerfen andere Features fuer **synchrone Reads** injiziert bekommen:

| Feature | Query-Dependencies |
|---------|-------------------|
| Travel | MapFeature, PartyFeature, TimeFeature |
| Encounter | MapFeature, PartyFeature, TimeFeature, EnvironmentFeature |
| Environment | MapFeature, PartyFeature, TimeFeature |
| Combat | PartyFeature, EntityRegistry |

### Event-Dependencies

Features reagieren auf Events anderer Features:

| Feature | Subscribed Events |
|---------|-------------------|
| Environment | `time:state-changed`, `time:segment-changed`, `map:loaded`, `party:position-changed` |
| Encounter | `travel:moved`, `map:loaded` |
| Travel | `time:state-changed`, `map:loaded` |

---

## Persistenz-Datenfluss

### Pessimistic Save-First

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Feature             StoragePort           Vault           │
│      │                    │                  │             │
│      │   save(entity)     │                  │             │
│      │───────────────────►│   write(file)    │             │
│      │                    │─────────────────►│             │
│      │                    │                  │ [Persist]   │
│      │                    │   Result<void>   │             │
│      │                    │◄─────────────────│             │
│      │   Result<void>     │                  │             │
│      │◄───────────────────│                  │             │
│      │                    │                  │             │
│      │ [On Success:]      │                  │             │
│      │ - Update State     │                  │             │
│      │ - Publish Event    │                  │             │
│      │                    │                  │             │
│      │ [On Failure:]      │                  │             │
│      │ - State unchanged  │                  │             │
│      │ - Show Error       │                  │             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### State-Kategorien

| Kategorie | Beispiele | Persistenz | Datenfluss |
|-----------|-----------|------------|------------|
| **Persistent** | Maps, Entities, Zeit | Vault | Feature ↔ StoragePort ↔ Vault |
| **Session** | Combat, UI-State | Memory | Feature ↔ ViewModel |
| **Resumable** | Travel-Progress | Plugin-Data | Feature ↔ Plugin.saveData() |

---

## ViewModel State Updates

### Subscription Pattern

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Feature            EventBus           ViewModel           │
│      │                 │                    │              │
│      │                 │  subscribe()       │              │
│      │                 │◄───────────────────│              │
│      │                 │                    │              │
│      │  [State Change] │                    │              │
│      │                 │                    │              │
│      │  publish()      │                    │              │
│      │────────────────►│  dispatch          │              │
│      │                 │───────────────────►│              │
│      │                 │                    │              │
│      │                 │                    │ [Update]     │
│      │                 │                    │ LocalState   │
│      │                 │                    │              │
│      │                 │                    │ [Notify]     │
│      │                 │                    │ Panels       │
│      │                 │                    │              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### RenderHint Propagation

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ViewModel              View               Panel           │
│      │                   │                   │             │
│      │  [State Change]   │                   │             │
│      │                   │                   │             │
│      │  notify(hint)     │                   │             │
│      │──────────────────►│                   │             │
│      │                   │                   │             │
│      │                   │  render(hint)     │             │
│      │                   │──────────────────►│             │
│      │                   │                   │             │
│      │                   │                   │ [Selective] │
│      │                   │                   │ Re-render   │
│      │                   │                   │             │
│                                                            │
│  RenderHints:                                              │
│  - 'full' → Alles neu rendern                              │
│  - 'tiles' → Nur Map-Tiles                                 │
│  - 'camera' → Nur Viewport                                 │
│  - 'ui' → Nur UI-Elemente                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Konkrete Beispiele

### Travel Start Flow

```
1. User klickt "Start Travel" im SessionRunner
2. ViewModel.startTravel() → eventBus.publish('travel:start-requested')
3. TravelFeature empfaengt Event
4. TravelFeature.storagePort.saveProgress() → Vault
5. TravelFeature: State = 'traveling'
6. TravelFeature → eventBus.publish('travel:started')
7. SessionRunnerViewModel empfaengt 'travel:started'
8. ViewModel: state.travelActive = true
9. ViewModel: notifySubscribers(RenderHint.full)
10. View: Panels re-rendern mit Travel-UI
```

### Encounter Generation Flow

```
1. TravelFeature publiziert 'travel:moved' (Party auf neuem Tile)
2. EncounterFeature empfaengt Event
3. EncounterFeature: Check Encounter-Wahrscheinlichkeit
4. Wenn Encounter: EncounterFeature.generateEncounter()
   a. Query MapFeature.getTile() fuer Terrain
   b. Query TimeFeature.getCurrentTime() fuer Tageszeit
   c. Query EnvironmentFeature.getWeather() fuer Modifikator
   d. Query EntityRegistry fuer passende Creatures
5. EncounterFeature → eventBus.publish('encounter:generated')
6. DetailViewViewModel empfaengt Event
7. DetailViewViewModel: Zeigt Encounter-Preview
8. GM entscheidet: Start / Dismiss / Regenerate
```

---

*Siehe auch: [EventBus.md](EventBus.md) | [Features.md](Features.md) | [Application.md](Application.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
