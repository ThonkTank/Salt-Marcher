# Time-System

> **Lies auch:** [Journal](../domain/Journal.md), [Events-Catalog](../architecture/Events-Catalog.md)
> **Wird benoetigt von:** Travel, Weather, Audio, Encounter

Backend-Feature fuer Kalender und Zeit-Verwaltung.

**Design-Philosophie:** Time ist ein Backend-Feature. Almanac ist das Frontend (User-facing ToolView). Andere Features (Travel, Weather) importieren Time, nicht Almanac.

---

## Uebersicht

Das Time-System verwaltet:

1. **Aktuelle Zeit** - GameDateTime im aktiven Kalender
2. **Aktiver Kalender** - CalendarDefinition aus EntityRegistry
3. **Zeit-Operationen** - Advance, Set, Convert

```
┌─────────────────────────────────────────────────────────────────┐
│  Almanac ToolView (User-facing)                                  │
│  - Kalender erstellen/editieren                                  │
│  - Zeit anzeigen/setzen                                          │
│  - Events/Journal verwalten                                      │
│  - Timeline-Ansicht                                              │
├─────────────────────────────────────────────────────────────────┤
│  WorldEvents Feature                                             │
│  - WorldEvents CRUD                                              │
│  - Journal-Entries                                               │
│  - Event-Queries                                                 │
│  - Subscribes time:* Events                                      │
├─────────────────────────────────────────────────────────────────┤
│  Time Feature (Backend)  ← Dieses Dokument                       │
│  - currentTime: GameDateTime                                     │
│  - activeCalendarId                                              │
│  - time:advance-requested                                        │
│  - time:set-requested                                            │
│  - time:calendar-changed                                         │
├─────────────────────────────────────────────────────────────────┤
│  CalendarDefinition → EntityRegistry                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ownership-Tabelle

| Aspekt | Owner | Zugriff |
|--------|-------|---------|
| CalendarDefinition (Schema) | EntityRegistry | Library erstellt/editiert |
| Aktiver Kalender | Time Feature | `time:set-calendar-requested` |
| Aktuelle Zeit | Time Feature | `time:advance-requested`, `time:set-requested` |
| WorldEvents | WorldEvents Feature | CRUD via WorldEvents Feature |
| Journal-Entries | WorldEvents Feature | CRUD via WorldEvents Feature |

---

## Schemas

### TimeState

```typescript
interface TimeState {
  currentTime: GameDateTime;
  activeCalendarId: EntityId<'calendar'>;
}
```

### GameDateTime

```typescript
interface GameDateTime {
  year: number;
  month: number;               // 1-indexed
  day: number;                 // 1-indexed
  hour: number;                // 0-23
  minute: number;              // 0-59

  // Computed (basierend auf CalendarDefinition)
  dayOfWeek?: number;          // 0-indexed
  season?: string;
  timeSegment?: TimeSegment;
}

type TimeSegment = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
```

### CalendarDefinition

Kalender werden im EntityRegistry gespeichert (`EntityType: 'calendar'`).

```typescript
interface CalendarDefinition {
  id: EntityId<'calendar'>;
  name: string;                // "Gregorian", "Harptos", etc.

  // Monate
  months: CalendarMonth[];

  // Wochentage
  weekdays: string[];          // ["Montag", "Dienstag", ...]

  // Jahreszeiten
  seasons: CalendarSeason[];

  // Zeit-Segmente (6 Segmente fuer feinere Granularitaet)
  timeSegments: {
    dawn: { start: number; end: number };       // z.B. 5-7
    morning: { start: number; end: number };    // z.B. 7-11
    midday: { start: number; end: number };     // z.B. 11-14
    afternoon: { start: number; end: number };  // z.B. 14-18
    dusk: { start: number; end: number };       // z.B. 18-20
    night: { start: number; end: number };      // z.B. 20-5
  };
}

interface CalendarMonth {
  name: string;
  days: number;
  season?: string;             // Optionale Saison-Zuordnung
}

interface CalendarSeason {
  name: string;
  months: number[];            // Month-Indices (0-indexed)
}
```

---

## Zeit-Operationen

### Advance (Zeit voranschreiten)

```typescript
function advanceTime(
  state: TimeState,
  duration: Duration,
  calendar: CalendarDefinition
): TimeState {
  const newTime = addDuration(state.currentTime, duration, calendar);

  eventBus.publish('time:state-changed', {
    previousTime: state.currentTime,
    currentTime: newTime,
    activeCalendarId: state.activeCalendarId,
    duration
  });

  return { ...state, currentTime: newTime };
}

interface Duration {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
}
```

### Set (Zeit setzen)

```typescript
function setTime(
  state: TimeState,
  newTime: GameDateTime
): TimeState {
  eventBus.publish('time:state-changed', {
    previousTime: state.currentTime,
    currentTime: newTime,
    activeCalendarId: state.activeCalendarId
    // duration: undefined bei direktem Setzen
  });

  return { ...state, currentTime: newTime };
}
```

### Kalender wechseln

```typescript
function setCalendar(
  state: TimeState,
  calendarId: EntityId<'calendar'>
): TimeState {
  const calendar = entityRegistry.get('calendar', calendarId);
  if (!calendar) {
    eventBus.publish('time:calendar-change-failed', {
      reason: 'calendar_not_found',
      calendarId
    });
    return state;
  }

  // Optional: Zeit konvertieren
  const convertedTime = convertTime(
    state.currentTime,
    state.activeCalendarId,
    calendarId
  );

  eventBus.publish('time:calendar-changed', {
    oldCalendarId: state.activeCalendarId,
    newCalendarId: calendarId,
    time: convertedTime
  });

  return {
    currentTime: convertedTime,
    activeCalendarId: calendarId
  };
}
```

---

## Event-Flows

### Zeit aendern

```
User klickt "+1 Stunde" in Almanac UI
    │
    ├── Almanac ViewModel published:
    │   time:advance-requested { duration: { hours: 1 } }
    │
    ├── Time Feature verarbeitet:
    │   - Berechnet neue Zeit
    │   - Published: time:state-changed { previousTime, currentTime, activeCalendarId, duration }
    │
    └── Consumer reagieren:
        ├── Weather Feature → Neu berechnen
        ├── Travel Feature → ETA aktualisieren
        ├── Audio Feature → Context-Update
        └── WorldEvents Feature → Events pruefen
```

### Kalender wechseln

```
User waehlt anderen Kalender in Almanac UI
    │
    ├── time:set-calendar-requested { calendarId }
    │
    ├── Time Feature:
    │   - Laedt CalendarDefinition aus EntityRegistry
    │   - Konvertiert currentTime (falls moeglich)
    │   - Published: time:calendar-changed
    │
    └── Almanac ToolView:
        - Timeline neu rendern
```

### Travel-Integration

```
travel:completed
    │
    ├── Travel Feature berechnet: duration = X hours
    │
    ├── Travel Feature published:
    │   time:advance-requested { duration: { hours: X } }
    │
    └── Time Feature verarbeitet (wie oben)
```

---

## Time-Segment Berechnung

```typescript
function getTimeSegment(
  time: GameDateTime,
  calendar: CalendarDefinition
): TimeSegment {
  const hour = time.hour;
  const segments = calendar.timeSegments;

  if (isInRange(hour, segments.dawn)) return 'dawn';
  if (isInRange(hour, segments.morning)) return 'morning';
  if (isInRange(hour, segments.midday)) return 'midday';
  if (isInRange(hour, segments.afternoon)) return 'afternoon';
  if (isInRange(hour, segments.dusk)) return 'dusk';
  return 'night';
}

function isInRange(
  hour: number,
  range: { start: number; end: number }
): boolean {
  if (range.start <= range.end) {
    return hour >= range.start && hour < range.end;
  } else {
    // Wrap around (z.B. night: 20-5)
    return hour >= range.start || hour < range.end;
  }
}
```

---

## Events

```typescript
// Requests
'time:advance-requested': {
  duration: Duration;
  reason?: 'travel' | 'rest' | 'activity' | 'manual';
}
'time:set-requested': {
  newDateTime: GameDateTime;
}
'time:set-calendar-requested': {
  calendarId: EntityId<'calendar'>;
}

// State-Changes
'time:state-changed': {
  previousTime: GameDateTime;
  currentTime: GameDateTime;
  activeCalendarId: EntityId<'calendar'>;
  duration?: Duration;  // undefined bei direktem Setzen
}
'time:segment-changed': {
  previousSegment: TimeSegment;
  newSegment: TimeSegment;
}
'time:day-changed': {
  previousDay: number;
  newDay: number;
}
'time:calendar-changed': {
  oldCalendarId: EntityId<'calendar'>;
  newCalendarId: EntityId<'calendar'>;
  time: GameDateTime;
}

// Failures
'time:calendar-change-failed': {
  reason: 'calendar_not_found' | 'conversion_failed';
  calendarId: EntityId<'calendar'>;
}
```

---

## Consumer

Diese Features reagieren auf `time:state-changed`:

| Feature | Reaktion |
|---------|----------|
| Weather | Wetter neu berechnen |
| Travel | ETA aktualisieren |
| Audio | Context-Update (timeOfDay) |
| WorldEvents | Events pruefen, Timeline aktualisieren |
| Encounter | Reset taeglicher Encounter-Limits |
| **Visibility** | Sichtweiten-Overlay aktualisieren |

---

## Sichtweiten-Einfluss (Post-MVP)

Tageszeit beeinflusst die Overland-Sichtweite im Visibility-System.

### Visibility-Modifier pro Segment

| Segment | Modifier | Notiz |
|---------|----------|-------|
| `dawn` | 50% | Morgendaemmerung |
| `morning` | 100% | Volle Sicht |
| `midday` | 100% | Volle Sicht |
| `afternoon` | 100% | Volle Sicht |
| `dusk` | 50% | Abenddaemmerung |
| `night` | 10% | Minimale Sicht (ohne Darkvision) |

### Berechnung

Der Time-Modifier wird **multiplikativ** mit dem Weather-Modifier kombiniert:

```
Effektive Sichtweite = Basis × Hoehen-Bonus × Weather-Modifier × Time-Modifier
```

**Beispiel:** Basis 2 Hex, klar (100%), Nacht (10%) → 0.2 Hex (nur aktuelles Tile)

### Segment-Wechsel

Bei `time:segment-changed` wird das Visibility-Overlay automatisch aktualisiert:

```
time:segment-changed { previousSegment: 'dusk', newSegment: 'night' }
    │
    └── Visibility Feature:
        - Neuen Time-Modifier (10%) berechnen
        - visibleTiles neu berechnen
        - Overlay neu rendern
```

### Darkvision

Charaktere mit Darkvision negieren den Nacht-Modifier:
- Mit Darkvision: Night-Modifier = 100%
- Dawn/Dusk bleiben 50% (Daemmerung ≠ Dunkelheit)

→ Character-Sinne: [Character-System.md](Character-System.md#sinne)
→ Visibility-System: [Map-Feature.md](Map-Feature.md#visibility-system)

---

## WorldEvents vs JournalEntries

Zwei verschiedene Konzepte fuer zeitbezogene Eintraege:

| Konzept | Definition | Erstellt von | Persistenz |
|---------|------------|--------------|------------|
| **WorldEvent** | Geplantes zukuenftiges Event | GM manuell | EntityRegistry (`worldevent`) |
| **JournalEntry** | Log-Eintrag als Reaktion auf Geschehen | Plugin automatisch | EntityRegistry (`journal`) |

### WorldEvent (Zukunft)

Kalender-Eintraege fuer geplante Events:

```typescript
interface WorldEvent {
  id: EntityId<'worldevent'>;
  title: string;
  description?: string;
  scheduledTime: GameDateTime;         // Wann tritt es ein?
  repeat?: RepeatRule;                 // Wiederkehrend? (Mondzyklen, Feste)
  tags?: string[];                     // Kategorisierung
}

// Beispiele:
// - "Mittwinterfest" (jaehrlich am 21. Dezember)
// - "Vollmond" (alle 30 Tage)
// - "Armeeaufmarsch" (einmalig in 3 Tagen)
```

### WorldEvent Lifecycle

Wenn `scheduledTime` erreicht wird:

```
Zeit erreicht scheduledTime
    │
    ├── JournalEntry erstellen (type: 'worldevent')
    │
    ├── if (repeat !== undefined):
    │   │   // Wiederkehrendes Event
    │   ├── Berechne naechste scheduledTime
    │   └── WorldEvent bleibt bestehen
    │
    └── else:
        │   // Einmaliges Event
        └── WorldEvent loeschen
```

| Event-Art | Nach Trigger | WorldEvent |
|-----------|--------------|------------|
| Einmalig | JournalEntry erstellt | Geloescht |
| Wiederkehrend | JournalEntry erstellt | Bleibt, neue scheduledTime |

### JournalEntry (Vergangenheit)

Automatische Log-Eintraege bei System-Events:

```typescript
interface JournalEntry {
  id: EntityId<'journal'>;
  timestamp: GameDateTime;              // Wann passiert?
  type: JournalEntryType;
  title: string;
  description?: string;                 // Menschenlesbarer Text
  data?: Record<string, unknown>;       // Strukturierte Daten (optional)
  relatedEntities?: EntityRef[];        // Verlinkte Entities (NPCs, Locations, etc.)
  source: 'system' | 'manual';
}

type JournalEntryType =
  | 'arrival'          // travel:completed - Party erreichte Location/Map
  | 'combat'           // combat:completed - Kampf beendet
  | 'encounter'        // Nicht-Kampf-Begegnung (Social, Haendler)
  | 'rest'             // rest:completed - Long/Short Rest
  | 'quest_progress'   // quest:objective-completed - Quest-Fortschritt
  | 'death'            // Character/NPC gestorben
  | 'worldevent'       // WorldEvent eingetreten
  | 'note';            // Manuelle GM-Notiz

// Beispiele:
// - "Party erreichte Nebelhain" (type: arrival)
// - "Goblin-Patrouille besiegt" (type: combat)
// - "Quest-Objective: Hoehle gefunden" (type: quest_progress)
```

### Verwendung

| Feature | Event | JournalEntryType |
|---------|-------|------------------|
| Travel | `travel:completed` | arrival |
| Combat | `combat:completed` | combat |
| Encounter | Nicht-Kampf-Begegnung | encounter |
| Rest | `rest:completed` | rest |
| Quest | `quest:objective-completed` | quest_progress |
| Encounter | NPC/Character Tod | death |
| WorldEvents | WorldEvent eingetreten | worldevent |
| GM | Manueller Eintrag | note |

---

## Time/WorldEvents-Beziehung

**Time Feature:**
- Haelt currentTime und activeCalendarId
- Verarbeitet Zeit-Requests
- Published Zeit-Events
- Klein, fokussiert, testbar

**WorldEvents Feature:**
- WorldEvents und Journal-Entries
- Subscribes auf `time:state-changed`
- Prueft ob Events faellig sind
- Publiziert `worldevents:due`, `worldevents:upcoming`

**Almanac ToolView:**
- User-facing UI fuer Time + WorldEvents
- Konsumiert beide Features
- Timeline, Event-Editor, Kalender-Grid

**Warum getrennt:**
- Travel/Weather brauchen nur Zeit, nicht WorldEvents
- WorldEvents ist eigenstaendige Logik (Events pruefen, Journal fuehren)
- Almanac ist UI-Name, nicht Feature-Name
- Klare Dependency-Richtung: WorldEvents → Time (nicht umgekehrt)

---

## Resting

Short/Long Rest mit Stunden-basiertem Loop und Encounter-Unterbrechung.

### State Machine

```
idle ─────────────────────────────────────────────────────────────┐
  │                                                                │
  │ rest:short-rest-requested / rest:long-rest-requested          │
  ▼                                                                │
resting ──────────────────────────────────────────────────────────┤
  │   │                                                            │
  │   │ Pro Stunde (Normal) / Tag (Gritty): Encounter-Check       │
  │   │                                                            │
  │   ├── Kein Encounter → Zeit +1h → weiter                      │
  │   │                                                            │
  │   └── Encounter! → rest:paused Event                          │
  │       │                                                        │
  │       ▼                                                        │
  │     paused ────────────────────────────────────────────────────┤
  │       │                                                        │
  │       ├── rest:resume-requested → zurueck zu resting           │
  │       └── rest:restart-requested → hoursCompleted = 0, resting │
  │                                                                │
  │ Alle Stunden abgeschlossen                                     │
  ▼                                                                │
rest:*-completed Event ────────────────────────────────────────────┘
```

### Rest-Typen

| Typ | Dauer (Normal) | Dauer (Gritty Realism) | Encounter-Checks |
|-----|---------------|------------------------|------------------|
| Short Rest | 1 Stunde | 1 Tag (24h) | 1 Check |
| Long Rest | 8 Stunden | 1 Woche (7 Tage) | bis zu 8 Checks |

### Gritty Realism Option

GM kann in den Optionen "Gritty Realism" aktivieren:

```typescript
interface RestSettings {
  grittyRealism: boolean;  // default: false
}

function getRestDuration(type: 'short' | 'long', settings: RestSettings): Duration {
  if (settings.grittyRealism) {
    return type === 'short'
      ? { days: 1 }           // 24 Stunden
      : { days: 7 };          // 1 Woche
  } else {
    return type === 'short'
      ? { hours: 1 }          // 1 Stunde
      : { hours: 8 };         // 8 Stunden
  }
}
```

### Encounter-Unterbrechung

```typescript
interface RestState {
  status: 'idle' | 'resting' | 'paused';
  type?: 'short' | 'long';
  hoursCompleted: number;
  hoursRemaining: number;
  interruptionCount: number;
}
```

Bei Encounter-Check:

```
rest:*-requested
    │
    ▼
Pro Stunde:
    │
    ├── Encounter-Check (wie Travel, ~1h auf Karte verbracht)
    │
    ├── Kein Encounter:
    │   └── Zeit +1h → time:advance-requested { hours: 1, reason: 'rest' }
    │
    └── Encounter generiert:
        │
        ├── rest:paused Event
        ├── encounter:generated Event
        │
        ▼
        Nach Encounter-Resolution:
            │
            ▼
        GM-Modal: "Rast fortsetzen?" / "Rast neustarten?"
            │
            ├── Fortsetzen → rest:resume-requested
            │   └── Verbleibende Stunden weiterlaufen
            │
            └── Neustarten → rest:restart-requested
                └── hoursCompleted = 0, Loop neu beginnen
```

### Rest-Abschluss

Bei Abschluss wird `rest:*-completed` gepubliziert. Andere Features reagieren:

| Feature | Event | Reaktion |
|---------|-------|----------|
| Encounter | `rest:long-rest-completed` | budgetUsed = 0 (XP-Budget Reset) |
| (Post-MVP) Character | `rest:*-completed` | HP-Recovery, Spell-Slots, Feature-Recovery |
| Journal | `rest:*-completed` | JournalEntry erstellen (type: 'rest') |

### Events (Referenz)

Vollstaendige Event-Definitionen: [Events-Catalog.md#rest](../architecture/Events-Catalog.md#rest)

---

## Prioritaet

| Komponente | Prioritaet | MVP |
|------------|------------|-----|
| TimeState | Hoch | Ja |
| GameDateTime | Hoch | Ja |
| CalendarDefinition | Hoch | Ja |
| time:advance | Hoch | Ja |
| time:set | Mittel | Ja |
| **Rest State Machine** | Hoch | Ja |
| **Rest-Completed Events** | Hoch | Ja |
| **Gritty Realism Option** | Mittel | Ja |
| time:set-calendar | Niedrig | Nein |
| Zeit-Konvertierung | Niedrig | Nein |
| **Visibility-Modifier** | Mittel | Nein |

---

*Siehe auch: [Weather-System.md](Weather-System.md) | [Travel-System.md](Travel-System.md) | [Audio-System.md](Audio-System.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 900 | ✅ | Time | TimeState Interface (currentTime, activeCalendarId) | hoch | Ja | - | Time-System.md#schemas | src/core/schemas/time.ts, src/features/time/types.ts, src/features/time/time-store.ts |
| 901 | ✅ | Time | GameDateTime Interface (year, month, day, hour, minute, computed fields) | hoch | Ja | #900 | Time-System.md#gamedatetime | src/core/schemas/time.ts |
| 903 | ✅ | Time | CalendarDefinition Schema (months, weekdays, seasons, timeSegments) | hoch | Ja | - | Time-System.md#schemas, ../architecture/EntityRegistry.md | src/core/schemas/time.ts |
| 905 | ✅ | Time | CalendarSeason Interface (name, months) | hoch | Ja | #903 | Time-System.md#calendardefinition | src/core/schemas/time.ts |
| 906 | ✅ | Time | TimeSegment Type ('dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night') | hoch | Ja | - | Time-System.md#gamedatetime | src/core/schemas/time.ts, src/core/schemas/common.ts |
| 908 | ✅ | Time | time:set-requested Handler | hoch | Ja | #900, #901 | Time-System.md#zeit-operationen, ../architecture/Events-Catalog.md#time | src/features/time/time-service.ts (setupEventHandlers L213-239) |
| 910 | ✅ | Time | time:segment-changed Event publizieren | hoch | Ja | #909 | Time-System.md#events, ../architecture/Events-Catalog.md#time | src/features/time/time-service.ts (publishSegmentChanged), src/core/events/domain-events.ts |
| 912 | ✅ | Time | getTimeSegment() Funktion mit Wrap-Around-Logik | hoch | Ja | #906 | Time-System.md#time-segment-berechnung | src/features/time/time-utils.ts (getTimeSegment, isInRange) |
| 914 | ⬜ | Time | time:set-calendar-requested Handler | niedrig | Nein | #903 | Time-System.md#zeit-operationen, ../architecture/Events-Catalog.md#time | src/features/time/time-service.ts:setupEventHandlers() [ändern], src/features/time/time-service.ts:setCalendar() [neu] |
| 916 | ⛔ | Time | time:calendar-change-failed Event publizieren | niedrig | Nein | #914 | Time-System.md#events, ../architecture/Events-Catalog.md#time | src/features/time/time-service.ts:publishCalendarChangeFailed() [neu], src/core/events/domain-events.ts |
| 918 | ⛔ | Time | Visibility-Modifier pro TimeSegment (dawn 50%, night 10%, etc.) | mittel | Nein | #906, #843, #848 | Time-System.md#sichtweiten-einfluss-post-mvp, Map-Feature.md#visibility-system | src/features/map/visibility-utils.ts:getTimeModifier() [neu], src/features/map/visibility.ts:calculateVisibility() [ändern] |
| 952 | ⛔ | Time | RestState Interface (status, type, hoursCompleted, hoursRemaining, interruptionCount) | hoch | Ja | #951 | Time-System.md#resting | src/core/schemas/time.ts [ändern] |
| 954 | ⛔ | Time | Rest-Service (Stunden-Loop mit Encounter-Checks) | hoch | Ja | #953, #215 | Time-System.md#resting, Encounter-System.md, ../architecture/Events-Catalog.md#rest | src/features/time/rest-service.ts [neu] |
| 902 | ✅ | Time | Duration Interface (years, months, days, hours, minutes) | hoch | Ja | - | Time-System.md#zeit-operationen | src/core/schemas/time.ts |
| 904 | ✅ | Time | CalendarMonth Interface (name, days, season) | hoch | Ja | #903 | Time-System.md#calendardefinition | src/core/schemas/time.ts |
| 907 | ✅ | Time | time:advance-requested Handler | hoch | Ja | #900, #902 | Time-System.md#advance-zeit-voranschreiten | src/features/time/time-service.ts (setupEventHandlers L164-210) |
| 909 | ✅ | Time | time:state-changed Event publizieren | hoch | Ja | #907, #908 | Time-System.md#events | src/features/time/time-service.ts (publishStateChanged), src/core/events/domain-events.ts |
| 911 | ✅ | Time | time:day-changed Event publizieren | hoch | Ja | #909 | Time-System.md#events | src/features/time/time-service.ts (publishDayChanged), src/core/events/domain-events.ts |
| 913 | ✅ | Time | addDuration() Funktion für Zeit-Arithmetik | hoch | Ja | #901, #902 | Time-System.md#advance-zeit-voranschreiten | src/features/time/time-utils.ts (addDuration, normalizeTime) |
| 915 | ⛔ | Time | time:calendar-changed Event publizieren | niedrig | Nein | #914 | Time-System.md#events | src/features/time/time-service.ts:publishCalendarChanged() [neu], src/core/events/domain-events.ts |
| 917 | ⬜ | Time | convertTime() zwischen Kalendern | niedrig | Nein | #903 | Time-System.md#kalender-wechseln | src/features/time/time-utils.ts:convertTime() [neu] |
| 919 | ⛔ | Time | Darkvision negiert Night-Modifier | mittel | Nein | #918, #849 | Time-System.md#darkvision | src/features/map/visibility-utils.ts:getTimeModifier() [ändern], src/features/party/types.ts:CharacterSenses [neu] |
| 953 | ⛔ | Time | Rest-Store (State Machine: idle → resting → paused) | hoch | Ja | #952 | Time-System.md#resting | src/features/time/rest-store.ts [neu] |
| 1114 | ⛔ | Audio | Weather-Matching: Ambience anpassen bei weather-changed | niedrig | Nein | #909, #1107, #1108, #1113 | Time-System.md, Events-Catalog.md#time | [neu] src/features/audio/mood-matching.ts |
| 2964 | ⬜ | Time | getCurrentSeason(): Aktuelle Saison aus Datum + Kalender ableiten | hoch | Ja | #905 | Time-System.md#calendardefinition | - |
| 2965 | ⬜ | Time | Celestial Events: Custom Mondphasen und Himmelsereignisse im Calendar-System | hoch | Ja | #903 | Time-System.md#calendardefinition | - |
