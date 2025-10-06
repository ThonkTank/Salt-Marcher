# Calendar Workmode – API Contracts
Dieses Dokument beschreibt Schnittstellen zwischen UI, Domain, Persistenz und Cartographer. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [STATE_MACHINE.md](./STATE_MACHINE.md) und [COMPONENTS.md](./COMPONENTS.md).

## 1. Übersicht
- Alle Typen sind in `src/apps/calendar/mode/contracts.ts` zu zentralisieren.
- JSON-Schemas dienen als Persistenzformat (z.B. `JsonStore`).
- Versionierung erfolgt über `schemaVersion`-Felder (SemVer). Migrationen dokumentiert in §7.

## 2. DTOs {#dtos}
### 2.1 Kalender
```ts
interface CalendarSchemaDTO {
  id: string;
  name: string;
  description?: string;
  weeksPerMonth?: number; // optional für spezielle Systeme
  daysPerWeek: number;
  months: ReadonlyArray<{ id: string; name: string; length: number }>;
  leapRules?: ReadonlyArray<LeapRuleDTO>;
  epoch: {
    year: number;
    monthId: string;
    day: number;
  };
  schemaVersion: string; // e.g. "1.1.0"
}
interface CalendarSummaryDTO {
  id: string;
  name: string;
  schema: Pick<CalendarSchemaDTO, 'daysPerWeek' | 'months' | 'schemaVersion'>;
  isDefaultGlobal: boolean;
  defaultTravelIds: ReadonlyArray<string>; // Reisen, die diesen Kalender als Default nutzen
  isActive?: boolean;
}
```

### 2.2 Datum & Range
```ts
interface CalendarDateDTO {
  calendarId: string;
  year: number;
  monthId: string;
  day: number;
}
interface CalendarRangeDTO {
  calendarId: string;
  start: CalendarDateDTO;
  end: CalendarDateDTO;
  zoom: 'month' | 'week' | 'day' | 'upcoming';
}
```

### 2.3 Ereignisse
```ts
type CalendarEventDTO = CalendarEventSingleDTO | CalendarEventRecurringDTO;
interface CalendarEventSingleDTO {
  id: string;
  calendarId: string;
  title: string;
  date: CalendarDateDTO;
  category?: string;
  tags?: ReadonlyArray<string>;
  note?: string;
  followUpPolicy: 'auto' | 'manual';
  hooks?: ReadonlyArray<HookDescriptorDTO>;
}
interface CalendarEventRecurringDTO {
  id: string;
  calendarId: string;
  title: string;
  rule: RepeatRuleDTO;
  category?: string;
  tags?: ReadonlyArray<string>;
  note?: string;
  bounds?: {
    start?: CalendarDateDTO;
    end?: CalendarDateDTO;
  };
  hooks?: ReadonlyArray<HookDescriptorDTO>;
}
interface CalendarUpcomingEventDTO {
  id: string;
  title: string;
  occurrence: CalendarDateDTO;
  daysUntil: number; // negative = vergangen
  type: 'single' | 'recurring';
  category?: string;
}
interface CalendarGridEventDTO {
  id: string;
  title: string;
  start: CalendarDateDTO;
  end?: CalendarDateDTO;
  allDay: boolean;
  category?: string;
  isRecurring: boolean;
}
interface CalendarTravelEventDTO extends CalendarUpcomingEventDTO {
  priority: 'high' | 'medium' | 'low';
  followUpRequired: boolean;
}
```

### 2.4 Regeln & Hooks
```ts
interface RepeatRuleDTO {
  type: 'annual_offset' | 'monthly_position' | 'weekly_dayIndex' | 'custom';
  payload: Record<string, unknown>; // je nach Typ
  timezoneAgnostic?: boolean; // bleibt true, da Kalender schema-basiert
}
interface LeapRuleDTO {
  interval: number; // z.B. alle 4 Jahre
  addDayToMonthId: string;
}
interface HookDescriptorDTO {
  id: string;
  type: 'webhook' | 'script' | 'cartographer_event';
  config: Record<string, unknown>;
}
```

### 2.5 Filter & Log
```ts
interface CalendarEventFilterState {
  timeRange: { preset: 'next30' | 'next90' | 'prev30' | 'custom'; start?: CalendarDateDTO; end?: CalendarDateDTO };
  types: ReadonlyArray<'single' | 'recurring'>;
  tags: ReadonlyArray<string>;
  includeDefaultOnly: boolean;
}
interface CalendarOverviewFilterState {
  query: string;
  schemaTypes: ReadonlyArray<'gregorian' | 'custom' | 'tenDay'>;
  defaultScope?: 'global' | 'travel';
}
interface CalendarLogEntryDTO {
  id: string;
  timestamp: string; // ISO
  message: string;
  severity: 'info' | 'warning' | 'error';
  linkedEventId?: string;
}
```

## 3. Gateways {#gateways}
### 3.1 `CalendarStateGateway`
```ts
interface CalendarStateGateway {
  loadSnapshot(scope: 'global' | 'travel', travelId?: string): Promise<CalendarStateSnapshotDTO>;
  setActiveCalendar(input: { calendarId: string; scope: 'global' | 'travel'; travelId?: string }): Promise<void>;
  setDefaultCalendar(input: { calendarId: string; scope: 'global' | 'travel'; travelId?: string }): Promise<void>;
  advanceTime(input: AdvanceRequestDTO & { scope: 'global' | 'travel'; travelId?: string }): Promise<AdvanceResultDTO>;
  setDate(input: JumpRequestDTO & { scope: 'global' | 'travel'; travelId?: string }): Promise<JumpResultDTO>;
  getTravelLeafPreferences(travelId: string): Promise<TravelLeafPrefsDTO>;
  setTravelLeafPreferences(travelId: string, prefs: TravelLeafPrefsDTO): Promise<void>;
}
```

### 3.2 `CalendarRepository`
```ts
interface CalendarRepository {
  listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>>;
  getCalendar(id: string): Promise<CalendarSchemaDTO | null>;
  createCalendar(input: CalendarSchemaDTO & { isDefaultGlobal?: boolean }): Promise<void>;
  updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void>;
  deleteCalendar(id: string): Promise<void>;
  setDefault(input: { calendarId: string; scope: 'global' | 'travel'; travelId?: string }): Promise<void>;
}
```

### 3.3 `EventRepository`
```ts
interface EventRepository {
  listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>>;
  listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarUpcomingEventDTO>>;
  createEvent(event: CalendarEventDTO): Promise<void>;
  updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
```

### 3.4 `CartographerHookGateway`
```ts
interface CartographerHookGateway {
  dispatchHooks(events: ReadonlyArray<CalendarEventDTO>, context: { travelId?: string; scope: 'global' | 'travel' }): Promise<void>;
  notifyTravelPanel(payload: TravelPanelUpdateDTO): Promise<void>;
}
```

## 4. Request/Response DTOs für Zeitfortschritt
```ts
interface AdvanceRequestDTO {
  calendarId: string;
  amount: number; // kann negativ sein
  unit: 'day' | 'week' | 'month' | 'custom';
  customRange?: { start: CalendarDateDTO; end: CalendarDateDTO };
  followUpMode: 'auto' | 'manual';
}
interface AdvanceResultDTO {
  newDate: CalendarDateDTO;
  triggered: ReadonlyArray<CalendarEventDTO>;
  skipped: ReadonlyArray<CalendarEventDTO>;
}
interface JumpRequestDTO {
  calendarId: string;
  target: CalendarDateDTO;
  followUpMode: 'auto' | 'manual';
}
interface JumpResultDTO {
  date: CalendarDateDTO;
  skipped: ReadonlyArray<CalendarEventDTO>;
}
interface TravelLeafPrefsDTO {
  mode: TravelCalendarMode;
  visible: boolean;
  lastViewedDate: CalendarDateDTO;
}
interface TravelPanelUpdateDTO {
  currentDate: CalendarDateDTO;
  triggeredEvents: ReadonlyArray<CalendarEventDTO>;
  skippedEvents: ReadonlyArray<CalendarEventDTO>;
  message?: string;
}
```

## 5. JSON-Schemas {#schemas}
### 5.1 Kalenderpersistenz
```json
{
  "$id": "calendar.schema",
  "type": "object",
  "required": ["id", "name", "daysPerWeek", "months", "epoch", "schemaVersion"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "daysPerWeek": { "type": "integer", "minimum": 1 },
    "months": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "length"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "length": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "leapRules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["interval", "addDayToMonthId"],
        "properties": {
          "interval": { "type": "integer", "minimum": 1 },
          "addDayToMonthId": { "type": "string" }
        }
      }
    },
    "epoch": {
      "type": "object",
      "required": ["year", "monthId", "day"],
      "properties": {
        "year": { "type": "integer" },
        "monthId": { "type": "string" },
        "day": { "type": "integer", "minimum": 1 }
      }
    },
    "schemaVersion": { "type": "string" }
  }
}
```

### 5.2 Default-Status Persistenz
```json
{
  "$id": "calendar.defaults",
  "type": "object",
  "required": ["global", "travel"],
  "properties": {
    "global": { "type": ["string", "null"] },
    "travel": {
      "type": "object",
      "additionalProperties": { "type": ["string", "null"] }
    }
  }
}
```

### 5.3 Travel-Leaf Präferenzen
```json
{
  "$id": "calendar.travelPrefs",
  "type": "object",
  "required": ["mode", "visible", "lastViewedDate"],
  "properties": {
    "mode": { "enum": ["month", "week", "day", "upcoming"] },
    "visible": { "type": "boolean" },
    "lastViewedDate": { "$ref": "#/definitions/date" }
  },
  "definitions": {
    "date": {
      "type": "object",
      "required": ["calendarId", "year", "monthId", "day"],
      "properties": {
        "calendarId": { "type": "string" },
        "year": { "type": "integer" },
        "monthId": { "type": "string" },
        "day": { "type": "integer" }
      }
    }
  }
}
```

## 6. Fehlerobjekte
```ts
interface CalendarError {
  code: 'validation_error' | 'conflict' | 'io_error' | 'not_found';
  scope: 'calendar' | 'event' | 'default' | 'travel';
  message: string;
  details?: Record<string, unknown>;
}
```
- `validation_error`: Feldfehler (z.B. Wochenlänge 0, Custom-Rule invalid).
- `conflict`: Default-Verletzung (zwei globale Defaults) oder Eventkollision.
- `io_error`: Persistenz-/Dateifehler.
- `not_found`: Kalender/Ereignis existiert nicht (z.B. gelöscht).

Fehler werden an UI via `ERROR_OCCURRED` (siehe [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)) propagiert.

## 7. Versionierung & Migrationen
| Version | Änderung | Migration |
| --- | --- | --- |
| `1.0.0` | Basis-Schema (Kalender, Events) | Initiale Anlage |
| `1.1.0` | Default-Flags (`isDefaultGlobal`, `defaultTravelIds`), Travel-Leaf-Präferenzen | Migration: `defaults.global`/`defaults.travel` Datei anlegen, vorhandene Kalender ohne Default → `null` |
| `1.2.0` | Zoom-optimierte Event-Snapshots (Cached ranges) | Migration: Precompute Range-Caches (lazy on demand) |

Migration-Schritte:
1. `CalendarRepository` führt Schema-Version-Check aus (`schemaVersion`).
2. Bei fehlendem Default-Speicher legt Migration `calendar.defaults.json` an und weist globalen Default heuristisch (erster Kalender) zu.
3. Travel-Leaf Prefs: Standard `{ mode: 'upcoming', visible: false, lastViewedDate = currentDate }`.
4. Fehlende Felder in Events werden mit Defaults ergänzt (`followUpPolicy = 'auto'`).

## 8. Cartographer Integration
- `CartographerHookGateway.notifyTravelPanel` sendet `TravelPanelUpdateDTO` an `apps/cartographer/travel/panel`.
- Hooks `cartographer_event` erhalten Payload `{ travelId, calendarId, eventId, occurrence }`.
- Travel-Leaf mount/unmount Signale:
  ```ts
  interface TravelLeafLifecycleGateway {
    onTravelStart(callback: (travelId: string) => void): Unsubscribe;
    onTravelEnd(callback: (travelId: string) => void): Unsubscribe;
  }
  ```
- Default-Änderungen werden an Cartographer gemeldet, damit Reise-Dropdowns aktualisiert werden (`CartographerController.refreshCalendarOptions`).

## 9. Testbare Verträge
- Alle Gateways mit Interfaces + `__mock__` Implementierung für Tests (siehe [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md)).
- Schemas validieren via `ajv` oder `zod` in Domain-Tests.

## 10. Verweise
- UX-Flows: [UX_SPEC.md](./UX_SPEC.md)
- Zustandslogik: [STATE_MACHINE.md](./STATE_MACHINE.md)
- Komponenten: [COMPONENTS.md](./COMPONENTS.md)
