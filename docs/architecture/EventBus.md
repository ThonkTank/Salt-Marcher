# Event Bus

> **Lies auch:** [Core](Core.md), [Features.md](Features.md), [Application.md](Application.md), [Events-Catalog.md](Events-Catalog.md)
> **Wird benoetigt von:** Features, Events-Catalog

Zentraler Kommunikationskanal für Cross-Component Kommunikation.

**Pfad:** `@core/events/event-bus.ts`

---

## Event-Kategorien

| Kategorie | Pattern | Sender | Empfänger |
|-----------|---------|--------|-----------|
| **Command/Request** | `*-requested` | ViewModel | Primary Feature |
| **Domain** | `*:loaded`, `*:saved`, `*:started`, `*:completed` | Feature | Reactive Features |
| **State-Sync** | `*:state-changed` | Feature | ViewModel |
| **Failure** | `*-failed` | Feature | ViewModel, Features |

### Domain Events im Detail

| Event | Wann verwenden | Beispiele |
|-------|----------------|-----------|
| `*:loaded` | Daten aus Storage geladen | `map:loaded`, `entities:loaded` |
| `*:saved` | Daten in Storage gespeichert | `map:saved`, `entity:saved` |
| `*:started` | Workflow/Prozess gestartet | `travel:started`, `combat:started` |
| `*:completed` | Workflow/Prozess beendet | `travel:completed`, `combat:completed` |
| `*:changed` | Daten wurden modifiziert | `time:state-changed`, `party:position-changed` |

**Unterschied `*:loaded` vs `*:state-changed`:**
- `*:loaded` = Domain Event (etwas ist passiert: Daten wurden geladen)
- `*:state-changed` = State-Sync Event (vollständiger State für UI-Update)

---

## Event-Naming-Konvention

Alle Events folgen einem einheitlichen Naming-Schema:

### Standard-Patterns

| Pattern | Verwendung | Beispiele |
|---------|------------|-----------|
| `{feature}:{action}` | State-Changes | `time:state-changed`, `map:loaded` |
| `{feature}:{action}-requested` | Commands/Requests | `travel:start-requested`, `map:navigate-requested` |
| `{feature}:{subject}-{action}` | Spezifische Aenderungen | `combat:participant-hp-changed`, `party:position-changed` |
| `{feature}:{action}-failed` | Fehler | `travel:failed`, `map:load-failed` |

### Vollstaendige Konvention

| Kategorie | Pattern | Wann verwenden | Beispiel |
|-----------|---------|----------------|----------|
| **Command** | `{feature}:{action}-requested` | User/ViewModel will Aktion | `travel:start-requested` |
| **State-Sync** | `{feature}:state-changed` | Vollstaendiger State fuer UI | `travel:state-changed` |
| **Domain** | `{feature}:{action}` | Einfache Aenderung/Event | `map:loaded`, `time:state-changed` |
| **Domain (spezifisch)** | `{feature}:{subject}-{action}` | Wenn Unterscheidung noetig | `party:position-changed` |
| **Lifecycle-Start** | `{feature}:started` | Workflow/Prozess begonnen | `travel:started`, `combat:started` |
| **Lifecycle-End** | `{feature}:completed` | Workflow/Prozess beendet | `travel:completed`, `combat:completed` |
| **Failure** | `{feature}:{action}-failed` | Operation fehlgeschlagen | `travel:failed`, `entity:delete-failed` |

### Regeln

1. **Feature-Name kommt zuerst:** `travel:*`, `map:*`, `combat:*`
2. **Verben im Imperativ:** `start`, `load`, `navigate` (nicht `starting`, `loaded`)
3. **Subject nur wenn noetig:** Nur `{feature}:{subject}-{action}` wenn mehrere Subjects existieren
4. **Konsistenz:** Innerhalb eines Features gleiche Patterns verwenden

### Wichtige Aenderungen (Migration)

| Alt | Neu | Grund |
|-----|-----|-------|
| `travel:arrived` | `travel:completed` | Konsistenz mit anderen Features |
| `combat:ended` | `combat:completed` | Konsistenz mit anderen Features |
| `almanac:*` | `worldevents:*` | Almanac ist UI, nicht Feature |

**Vollstaendiger Event-Katalog:** [Events-Catalog.md](Events-Catalog.md) ist Single Source of Truth fuer alle Events.

---

## Event-Struktur (Pflichtfelder)

```typescript
interface DomainEvent<T> {
  type: string;           // z.B. 'travel:started'
  payload: T;             // Typisierte Daten
  correlationId: string;  // Workflow-Tracking (PFLICHT)
  timestamp: Timestamp;   // Erstellungszeitpunkt
  source: string;         // Sender-Identifikation
}
```

---

## Type-Safe Events

### Event-Types definieren

```typescript
// @core/events/domain-events.ts

// Event-Type Konstanten
export const EventTypes = {
  // Travel
  TRAVEL_PLAN_REQUESTED: 'travel:plan-requested',
  TRAVEL_START_REQUESTED: 'travel:start-requested',
  TRAVEL_STATE_CHANGED: 'travel:state-changed',
  TRAVEL_FAILED: 'travel:failed',

  // Encounter
  ENCOUNTER_START_REQUESTED: 'encounter:start-requested',
  ENCOUNTER_STATE_CHANGED: 'encounter:state-changed',
} as const;

// Payload-Types
interface TravelStartRequestedPayload {
  routeId: string;
}

interface TravelStateChangedPayload {
  status: TravelStatus;
  progress: TravelProgress | null;
}

// Type-Map
interface EventPayloadMap {
  [EventTypes.TRAVEL_START_REQUESTED]: TravelStartRequestedPayload;
  [EventTypes.TRAVEL_STATE_CHANGED]: TravelStateChangedPayload;
  // ...
}
```

### Events publizieren

```typescript
import { EventTypes, createEvent } from '@core/events';

// Mit Helper
eventBus.publish(
  createEvent(
    EventTypes.TRAVEL_START_REQUESTED,
    { routeId },
    'session-runner-viewmodel'
  )
);

// Manuell (vollständig)
eventBus.publish({
  type: EventTypes.TRAVEL_START_REQUESTED,
  payload: { routeId },
  correlationId: crypto.randomUUID(),
  timestamp: now(),
  source: 'session-runner-viewmodel'
});
```

### Events subscriben

```typescript
// Typisiertes Subscribe
const unsub = eventBus.subscribe(
  EventTypes.TRAVEL_STATE_CHANGED,
  (event) => {
    // event.payload ist typisiert als TravelStateChangedPayload
    this.updateTravelState(event.payload);
  }
);

// Cleanup in dispose()
this.subscriptions.push(unsub);

// dispose()
dispose() {
  this.subscriptions.forEach(unsub => unsub());
}
```

---

## Kommunikationsfluss

```
┌─────────────────┐
│    ViewModel    │
│                 │──[*-requested]──┐
│                 │                 │
│                 │◄──────────────┐ │
└─────────────────┘               │ │
                                  │ │
                    [*:state-changed]
                                  │ │
                                  │ ▼
                          ┌───────────────────┐
                          │ Primary           │
                          │ Feature           │
                          │                   │──[StoragePort Calls]──┐
                          │                   │                       │
                          │                   │◄──────────────────────┘
                          └───────────────────┘
                                  │
                            [*:changed]
                                  │
                                  ▼
                          ┌───────────────────┐
                          │ Reactive          │
                          │ Features          │
                          │                   │──[*:state-changed]──▶ ViewModel
                          └───────────────────┘
```

---

## Neues Event definieren

1. **Event-Type** in `@core/events/domain-events.ts` hinzufügen:
   ```typescript
   export const EventTypes = {
     // ...
     MY_NEW_EVENT: 'feature:new-event',
   } as const;
   ```

2. **Payload-Interface** definieren:
   ```typescript
   interface MyNewEventPayload {
     someData: string;
     moreData: number;
   }
   ```

3. **EventPayloadMap** erweitern:
   ```typescript
   interface EventPayloadMap {
     // ...
     [EventTypes.MY_NEW_EVENT]: MyNewEventPayload;
   }
   ```

4. **Event-Creator** (optional):
   ```typescript
   export function createMyNewEvent(
     payload: MyNewEventPayload,
     source: string
   ): DomainEvent<MyNewEventPayload> {
     return createEvent(EventTypes.MY_NEW_EVENT, payload, source);
   }
   ```

---

## Event-Ordering

### Deterministische Reihenfolge

Events werden in **Registrierungs-Reihenfolge** an Subscriber ausgeliefert:

```typescript
// Feature A registriert zuerst
eventBus.subscribe('time:state-changed', featureAHandler);

// Feature B registriert danach
eventBus.subscribe('time:state-changed', featureBHandler);

// Bei time:state-changed: featureAHandler wird ZUERST aufgerufen
```

### Best Practices

| Szenario | Loesung |
|----------|---------|
| Feature B braucht Ergebnis von Feature A | A publiziert neues Event, B reagiert darauf |
| Reihenfolge ist wichtig | Features unabhaengig halten, Kaskaden ueber Events |
| Zirkulaere Abhaengigkeit | Architektur-Problem! Refactoren |

### Event-Kaskaden

Typischer Flow bei `time:state-changed`:

```
time:state-changed
    │
    ├── 1. Weather Feature: recalculate → environment:weather-changed
    │
    ├── 2. Travel Feature: update ETA
    │
    ├── 3. WorldEvents Feature: check due events → worldevents:due
    │
    └── 4. Audio Feature: update context → audio:context-changed
```

**Regel:** Features reagieren unabhaengig. Wenn Feature B das Ergebnis von Feature A braucht, wartet B auf A's Output-Event (nicht auf das gemeinsame Input-Event).

### Synchron vs Asynchron

Siehe [Async-Patterns](#async-patterns) für vollständige Dokumentation.

**Kurzfassung:**
- `publish()` = Fire-and-forget (Handler-Promises nicht awaited)
- `request()` = Blocking mit Timeout (für Workflows die auf Ergebnis warten müssen)

---

## Regeln

### correlationId

| Situation | Aktion |
|-----------|--------|
| Neuer Workflow | Neue UUID generieren |
| Reaktion auf Event | correlationId uebernehmen |
| Event-Kette | Gleiche correlationId durch alle Events |

### Sender ↔ Empfänger

| Sender | Event-Kategorie | Empfänger |
|--------|-----------------|-----------|
| ViewModel | `*-requested` | Primary Feature |
| Feature | `*:state-changed` | ViewModel |
| Feature | `*-failed` | ViewModel, andere Features |
| Feature | `*:changed` | Reactive Features |

### Anti-Patterns

```typescript
// FALSCH: Feature direkt referenzieren (für Workflows)
this.travelFeature.start(routeId);

// RICHTIG: Via EventBus
eventBus.publish(createEvent(EventTypes.TRAVEL_START_REQUESTED, { routeId }, 'viewmodel'));

// FALSCH: Subscriptions im Constructor
constructor(eventBus: EventBus) {
  eventBus.subscribe(...); // ❌
}

// RICHTIG: Subscriptions in initialize()
initialize() {
  this.subscriptions.push(
    eventBus.subscribe(...) // ✓
  );
}
```

---

## Vollstaendiger Event-Katalog

**Single Source of Truth:** [Events-Catalog.md](Events-Catalog.md)

Der Events-Catalog enthaelt:
- Alle Event-Definitionen nach Namespace sortiert
- Vollstaendige TypeScript-Interfaces fuer Payloads
- Kategorisierung (Command, Domain, State-Sync, Failure)

### Namespaces

| Namespace | Feature | Beispiele |
|-----------|---------|-----------|
| `map:*` | Map Feature | `map:loaded`, `map:navigated` |
| `entity:*` | EntityRegistry | `entity:saved`, `entity:deleted` |
| `party:*` | Party Feature | `party:position-changed`, `party:xp-gained` |
| `time:*` | Time Feature | `time:state-changed`, `time:segment-changed` |
| `worldevents:*` | WorldEvents Feature | `worldevents:due`, `worldevents:created` |
| `travel:*` | Travel Feature | `travel:started`, `travel:completed` |
| `encounter:*` | Encounter Feature | `encounter:generated`, `encounter:resolved` |
| `combat:*` | Combat Feature | `combat:started`, `combat:completed` |
| `quest:*` | Quest Feature | `quest:activated`, `quest:completed` |
| `environment:*` | Environment (Reactive) | `environment:weather-changed` |
| `audio:*` | Audio (Hybrid) | `audio:track-changed`, `audio:paused` |
| `economy:*` | Economy Feature | `economy:transaction-completed` |
| `faction:*` | Factions Feature | `faction:reputation-changed` |
| `town:*` | Town Navigation | `town:navigate-requested` |
| `dungeon:*` | Dungeon Movement | `dungeon:position-changed` |

---

## Async-Patterns

### Zwei Kommunikationsmodi

| Modus | Methode | Verwendung |
|-------|---------|------------|
| **Fire-and-forget** | `eventBus.publish()` | Notifications, State-Sync, Reactive Updates |
| **Request/Response** | `eventBus.request()` | Workflows die auf Ergebnis warten müssen |

### Fire-and-forget (Standard)

Handler werden synchron aufgerufen, Promises nicht awaited:

```typescript
eventBus.publish(createEvent('map:loaded', { mapId }));
// Code läuft sofort weiter, Handler arbeiten unabhängig
```

**Verwenden für:**
- State-Sync Events (`*:state-changed`)
- Reactive Feature Updates (Weather → Audio)
- Notifications und Logging

### Request/Response (für Workflows)

Für Szenarien wo der Aufrufer auf ein Ergebnis warten muss:

```typescript
// Travel-Feature wartet auf Encounter-Generierung
const result = await eventBus.request(
  createEvent('encounter:generate-requested', { position, terrainId }),
  'encounter:generated',  // Warte auf dieses Response-Event
  5000                    // Timeout in ms
);

if (result.payload.encounter) {
  this.pause();
}
```

**Verwenden für:**
- Travel ↔ Encounter (Loop muss warten)
- Andere blocking Workflows

### Request/Response Interface

```typescript
interface EventBus {
  // Fire-and-forget
  publish<T>(event: DomainEvent<T>): void;
  subscribe<T>(type: string, handler: Handler<T>): Unsubscribe;

  // Request/Response
  request<TReq, TRes>(
    requestEvent: DomainEvent<TReq>,
    responseType: string,
    timeoutMs?: number
  ): Promise<DomainEvent<TRes>>;
}
```

**Implementierung:**
- `request()` published das Event und wartet auf Response mit gleicher `correlationId`
- Timeout default: 5000ms
- Bei Timeout: Promise rejected mit `TimeoutError`

### Timeout-Verhalten

**Entscheidung:** Promise reject mit `TimeoutError`

```typescript
// TimeoutError-Klasse
class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Verwendung
try {
  const result = await eventBus.request(event, 'response:type', 5000);
  // Erfolg
} catch (e) {
  if (e instanceof TimeoutError) {
    // Timeout behandeln
    console.warn(`Request timed out after ${e.timeoutMs}ms`);
  }
  throw e;
}
```

**Begründung:**
- `Result<T, E>` ist für synchrone/Business-Fehler (z.B. "Entity nicht gefunden")
- Timeout ist ein Infrastructure-Problem, kein Business-Fehler
- Standard Promise-Pattern für async Fehler (wie `fetch()` bei Netzwerk-Problemen)

### Event-Kaskaden (unverändert)

Für Abhängigkeiten zwischen Reactive Features bleibt das Kaskaden-Pattern:

```
time:state-changed
  → Weather subscribt, berechnet, published environment:weather-changed
  → Audio subscribt auf environment:weather-changed (NICHT auf time:state-changed)
```

**Regel:** Wenn Feature B das Ergebnis von Feature A braucht, subscribt B auf A's Output-Event.

---

## Sticky Events

### Konzept

Sticky Events speichern das letzte Event eines Typs und liefern es sofort an neue Subscriber. Dies löst das **Late-Subscriber-Problem**: Wenn eine View erst nach einem Event erstellt wird, erhält sie trotzdem den aktuellen Kontext.

**Bekanntes Pattern aus:**
- RxJS: `BehaviorSubject` / `ReplaySubject(1)`
- Android: `LiveData`
- Vue: `ref()` mit immediate watchers

### Wann Sticky Events verwenden?

| Szenario | Sticky? | Begründung |
|----------|:-------:|------------|
| UI-Kontext Events (`*:started`, `*:generated`) | ✓ | Views müssen wissen welcher Tab/Modus aktiv ist |
| State-Sync Events (`*:state-changed`) | ✗ | State wird direkt von Features abgefragt |
| Einmalige Notifications | ✗ | Sollten nicht wiederholt werden |
| Command Events (`*-requested`) | ✗ | Commands sind einmalige Aktionen |

### Sticky Event-Typen

Folgende Events sind sticky (definiert in Events-Catalog.md):

| Event | Sticky | Cleared by | Consumer | Grund |
|-------|:------:|------------|----------|-------|
| `map:loaded` | ✓ | `map:unloaded` | SessionRunner | Map-Kontext für späte Views |
| `party:loaded` | ✓ | — | SessionRunner | Party-State für späte Views |
| `travel:started` | ✓ | `travel:completed`, `travel:failed` | SessionRunner | Travel-Modus aktiv |
| `travel:paused` | ✓ | `travel:resumed`, `travel:completed` | SessionRunner | Pause-Grund (encounter, user) |
| `encounter:generated` | ✓ | `encounter:started`, `encounter:dismissed` | DetailView | Encounter-Tab öffnen |
| `combat:started` | ✓ | `combat:completed` | DetailView | Combat-Tab öffnen |
| `audio:track-changed` | ✓ | (überschrieben) | Audio-Panel | Aktueller Track |

**NICHT sticky** (mit Begründung):

| Kategorie | Beispiele | Grund |
|-----------|-----------|-------|
| `*:state-changed` | `travel:state-changed` | State wird direkt von Features abgefragt |
| `*-requested` | `combat:start-requested` | Commands sind einmalige Aktionen |
| `*:completed` | `travel:completed` | Lifecycle-Ende nicht wiederholen |
| `*:failed` | `travel:failed` | Fehler nicht wiederholen |
| Position-Events | `travel:position-changed` | Kontinuierliche Updates |
| Turn-Events | `combat:turn-changed` | Nur aktueller Turn relevant |

### API

```typescript
// Publish mit sticky Option
eventBus.publish(event, { sticky: true });

// Subscribe - erhält sofort das letzte sticky Event (falls vorhanden)
const unsub = eventBus.subscribe('combat:started', handler, { replay: true });

// Sticky Event manuell löschen (z.B. nach combat:completed)
eventBus.clearSticky('combat:started');
```

### Lifecycle

```
1. Feature publiziert sticky Event
   → Event wird normal an alle Subscriber geliefert
   → Event wird im stickyEvents-Cache gespeichert

2. Neue View subscribt mit replay: true
   → Subscriber erhält sofort das gecachte Event
   → Danach normale Event-Verarbeitung

3. Feature publiziert Gegenteil-Event (z.B. combat:completed)
   → Sticky Event wird aus Cache gelöscht
   → Neue Subscriber erhalten kein altes Event
```

### Sticky-Clearing-Regeln

| Sticky Event | Cleared by |
|--------------|------------|
| `map:loaded` | `map:unloaded` |
| `travel:started` | `travel:completed`, `travel:failed` |
| `travel:paused` | `travel:resumed`, `travel:completed` |
| `encounter:generated` | `encounter:started`, `encounter:dismissed` |
| `combat:started` | `combat:completed` |

### Implementierungshinweise

**Feature-Code (Publish):**

```typescript
// Sticky Event publishen
function publishCombatStarted(combatId: string, participants: CombatParticipant[]): void {
  eventBus.publish(
    createEvent(EventTypes.COMBAT_STARTED, { combatId, participants }, eventOptions()),
    { sticky: true }
  );
}

// Sticky Event clearen bei Workflow-Ende
function publishCombatCompleted(result: CombatResult): void {
  eventBus.clearSticky(EventTypes.COMBAT_STARTED);
  eventBus.publish(createEvent(EventTypes.COMBAT_COMPLETED, result, eventOptions()));
}
```

**ViewModel-Code (Subscribe):**

```typescript
// Mit replay für Late-Subscriber
eventSubscriptions.push(
  eventBus.subscribe(
    EventTypes.COMBAT_STARTED,
    () => {
      syncFromFeatures();
      state = { ...state, activeTab: 'combat' };
      notify(['full']);
    },
    { replay: true }  // Erhält sticky Event sofort
  )
);
```

---


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
