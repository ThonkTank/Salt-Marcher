# Almanac Workmode – API Contracts
Dieses Dokument beschreibt Schnittstellen zwischen UI, Domain, Persistenz und Cartographer. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [STATE_MACHINE.md](./STATE_MACHINE.md) und [COMPONENTS.md](./COMPONENTS.md).

## 1. Übersicht
- Alle Typen sind in `src/apps/almanac/mode/contracts.ts` zu zentralisieren.
- JSON-Schemas dienen als Persistenzformat (z.B. `JsonStore`).
- Versionierung erfolgt über `schemaVersion`-Felder (SemVer). Migrationen dokumentiert in §7.

### 1.1 Naming & Scope
| Bereich | Typ/Enum | Werte | Hinweis |
| --- | --- | --- | --- |
| Almanac-Modus | `AlmanacMode` | `'dashboard' | 'manager' | 'events'` | Travel wird über `TravelLeafPrefsDTO` gesteuert. |
| Manager-View | `CalendarManagerViewMode` | `'calendar' | 'overview'` | Persistiert in `managerUiState`. |
| Events-View | `EventsViewMode` | `'timeline' | 'table' | 'map'` | Telemetrie-Labels folgen den Enum-Werten. |
| Travel-Modus | `TravelCalendarMode` | `'month' | 'week' | 'day' | 'upcoming'` | Wird im Cartographer gespeichert. |
| Default-Scopes | `DefaultScope` | `'global' | 'travel'` | `travelId` optional für reisenspezifische Defaults. |

## 2. DTOs {#dtos}
### 2.1 Kalender
```ts
interface CalendarSchemaDTO {
  id: string;
  name: string;
  description?: string;
  weeksPerMonth?: number; // optional für spezielle Systeme
  daysPerWeek: number;
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute?: number;
  minuteStep: number;
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
  timeDefinition: TimeDefinitionDTO;
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
  hour?: number; // 0..hoursPerDay-1, wenn precision >= minute
  minute?: number; // 0..minutesPerHour-1
  second?: number; // optional, Schemaabhängig
  precision: 'day' | 'minute' | 'second';
}
interface CalendarRangeDTO {
  calendarId: string;
  start: CalendarDateDTO;
  end: CalendarDateDTO;
  zoom: 'month' | 'week' | 'day' | 'hour' | 'upcoming';
  timeSlice?: 'day' | 'hour' | 'minute';
}
interface TimeDefinitionDTO {
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute?: number;
  minuteStep: number; // kleinste auswählbare Einheit
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
  allDay: boolean;
  startTime?: { hour: number; minute: number; second?: number };
  endTime?: { hour: number; minute: number; second?: number };
  durationMinutes?: number;
  timePrecision: 'day' | 'minute' | 'second';
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
  timePolicy: 'all_day' | 'fixed' | 'offset';
  startTime?: { hour: number; minute: number; second?: number };
  durationMinutes?: number;
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
  timeLabel: string; // formatierter Zeitstring, leer falls Ganztag
  category?: string;
}
interface CalendarGridEventDTO {
  id: string;
  title: string;
  start: CalendarDateDTO;
  end?: CalendarDateDTO;
  allDay: boolean;
  timePrecision: 'day' | 'minute' | 'second';
  category?: string;
  isRecurring: boolean;
}
interface CalendarTravelEventDTO extends CalendarUpcomingEventDTO {
  priority: 'high' | 'medium' | 'low';
  followUpRequired: boolean;
  occurrencePrecision: 'day' | 'minute' | 'second';
}
```


### 2.4 Phänomene
```ts
type PhenomenonCategory = 'season' | 'astronomy' | 'weather' | 'tide' | 'holiday' | 'custom';
interface PhenomenonDTO {
  id: string;
  name: string;
  category: PhenomenonCategory;
  visibility: 'all_calendars' | 'selected';
  appliesToCalendarIds: ReadonlyArray<string>;
  rule: PhenomenonRuleDTO;
  timePolicy: 'all_day' | 'fixed' | 'offset';
  startTime?: { hour: number; minute: number; second?: number };
  durationMinutes?: number;
  effects?: ReadonlyArray<PhenomenonEffectDTO>;
  priority: number; // 0 = niedrig, höhere Zahl = höhere Priorität
  tags?: ReadonlyArray<string>;
  notes?: string;
  hooks?: ReadonlyArray<HookDescriptorDTO>;
  template?: boolean;
  schemaVersion: string;
}
interface PhenomenonRuleDTO {
  type: 'annual' | 'monthly_position' | 'weekly_dayIndex' | 'astronomical' | 'custom';
  offsetDayOfYear?: number;
  monthId?: string;
  weekIndex?: number; // z.B. 2 = zweite Woche
  dayIndex?: number; // 0..daysPerWeek-1
  customRuleId?: string; // Referenz auf Script/Hook
  astronomical?: { source: 'sunrise' | 'sunset' | 'moon_phase' | 'eclipse'; referenceCalendarId?: string; offsetMinutes?: number };
}
interface PhenomenonEffectDTO {
  type: 'weather' | 'narrative' | 'mechanical';
  payload: Record<string, unknown>; // z.B. { weather: 'storm', intensity: 2 }
  appliesTo?: ReadonlyArray<string>; // Kalender-IDs oder travel-IDs
}
interface PhenomenonSummaryDTO {
  id: string;
  name: string;
  category: PhenomenonCategory;
  nextOccurrence?: PhenomenonOccurrenceDTO;
  linkedCalendars: ReadonlyArray<string>;
  badge?: string;
}
interface PhenomenonOccurrenceDTO {
  calendarId: string;
  occurrence: CalendarDateDTO;
  timeLabel: string;
}
interface PhenomenonTriggerDTO {
  phenomenonId: string;
  occurrence: PhenomenonOccurrenceDTO;
  effects?: ReadonlyArray<PhenomenonEffectDTO>;
}
interface PhenomenonLinkUpdate {
  phenomenonId: string;
  calendarLinks: ReadonlyArray<{ calendarId: string; priority: number; hook?: HookDescriptorDTO }>;
}
interface PhenomenonTemplateDTO {
  id: string;
  name: string;
  category: PhenomenonCategory;
  rule: PhenomenonRuleDTO;
  effects?: ReadonlyArray<PhenomenonEffectDTO>;
}
```
### 2.5 Regeln & Hooks
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

### 2.6 Filter & Log
```ts
interface CalendarEventFilterState {
  timeRange: { preset: 'next30' | 'next90' | 'prev30' | 'custom'; start?: CalendarDateDTO; end?: CalendarDateDTO };
  types: ReadonlyArray<'single' | 'recurring'>;
  tags: ReadonlyArray<string>;
  includeDefaultOnly: boolean;
  includeTimedOnly?: boolean;
}
interface CalendarOverviewFilterState {
  query: string;
  schemaTypes: ReadonlyArray<'gregorian' | 'custom' | 'tenDay'>;
  defaultScope?: 'global' | 'travel';
}
type EventsViewMode = 'timeline' | 'table' | 'map';
type EventsSort = 'next_occurrence' | 'priority_desc' | 'category_asc';
interface EventsFilterState {
  timeWindow: { start: CalendarDateDTO; end: CalendarDateDTO };
  categories: ReadonlyArray<PhenomenonCategory>;
  calendarIds: ReadonlyArray<string>;
  effects: ReadonlyArray<string>;
  includeTemplates?: boolean;
}
interface CalendarLogEntryDTO {
  id: string;
  timestamp: string; // ISO
  message: string;
  severity: 'info' | 'warning' | 'error';
  linkedEventId?: string;
}
```

### 2.6 Snapshots & Präferenzen
```ts
type AlmanacMode = 'dashboard' | 'manager' | 'events';
interface AlmanacStatusSummary {
  zoomLabel?: string;
  filterCount?: number;
}
interface AlmanacModeSnapshotDTO {
  mode: AlmanacMode;
  statusSummary?: AlmanacStatusSummary;
  lastZoom?: Record<AlmanacMode, string | null>;
  lastFilters?: Partial<Record<'manager' | 'events', unknown>>;
}
interface CalendarStateSnapshotDTO {
  calendars: ReadonlyArray<CalendarSummaryDTO>;
  activeCalendarId?: string;
  defaultCalendarId?: string;
  travelDefaultCalendarId?: string;
  currentTimestamp: CalendarDateDTO;
  timeDefinition: TimeDefinitionDTO;
  minuteStep: number;
  upcomingEvents: ReadonlyArray<CalendarUpcomingEventDTO>;
  upcomingPhenomena: ReadonlyArray<PhenomenonSummaryDTO>;
  triggeredEvents: ReadonlyArray<CalendarEventDTO>;
  triggeredPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  skippedEvents: ReadonlyArray<CalendarEventDTO>;
  skippedPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  pendingFollowUps?: ReadonlyArray<CalendarEventDTO>;
  eventsPreferences?: EventsPreferenceDTO;
  travelState?: {
    currentTimestamp?: CalendarDateDTO;
    mode?: TravelCalendarMode;
    lastQuickStep?: { preset: 'minute' | 'hour' | 'day'; amount: number };
  };
}
interface EventsPreferenceDTO {
  viewMode: EventsViewMode;
  filters: EventsFilterState;
  sort: EventsSort;
  lastLoadedRange?: { start: CalendarDateDTO; end: CalendarDateDTO };
}
```

## 3. Gateways {#gateways}
### 3.1 `CalendarStateGateway`
```ts
interface CalendarStateGateway {
  loadSnapshot(options?: { travelId?: string | null }): Promise<CalendarStateSnapshotDTO>;
  setActiveCalendar(calendarId: string, options?: { travelId?: string | null; initialTimestamp?: CalendarDateDTO }): Promise<void>;
  setDefaultCalendar(calendarId: string, options?: { scope: 'global' | 'travel'; travelId?: string | null }): Promise<void>;
  setCurrentTimestamp(timestamp: CalendarDateDTO, options?: { travelId?: string | null }): Promise<void>;
  advanceTimeBy(amount: number, unit: 'minute' | 'hour' | 'day', options?: { travelId?: string | null; hookContext?: HookDispatchContextDTO }): Promise<AdvanceResultDTO>;
  loadPreferences(): Promise<AlmanacPreferencesDTO>;
  savePreferences(partial: Partial<AlmanacPreferencesDTO>): Promise<void>;
  getCurrentTimestamp(options?: { travelId?: string | null }): CalendarDateDTO | null;
  getActiveCalendarId(options?: { travelId?: string | null }): string | null;
  getTravelLeafPreferences(travelId: string): Promise<TravelLeafPrefsDTO | null>;
  saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPrefsDTO): Promise<void>;
}
```
interface HookDispatchContextDTO {
  scope: 'global' | 'travel';
  travelId?: string | null;
  reason: 'advance' | 'jump';
}
interface AlmanacPreferencesDTO {
  lastMode?: AlmanacMode;
  managerViewMode?: CalendarManagerViewMode;
  eventsViewMode?: EventsViewMode;
  eventsFilters?: EventsFilterState;
  lastSelectedPhenomenonId?: string;
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

### 3.3 `AlmanacRepository`
```ts
interface AlmanacRepository {
  listPhenomena(input: { viewMode: EventsViewMode; filters: EventsFilterState; sort: EventsSort; pagination?: EventsPaginationState }): Promise<EventsDataBatchDTO>;
  getPhenomenon(id: string): Promise<PhenomenonDTO | null>;
  upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO>;
  deletePhenomenon(id: string): Promise<void>;
  updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO>;
  listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>>;
}
interface EventsPaginationState {
  cursor?: string;
  limit: number;
}
interface EventsDataBatchDTO {
  items: ReadonlyArray<PhenomenonSummaryDTO>;
  pagination: { cursor?: string; hasMore: boolean };
  generatedAt: string;
}
```

### 3.4 `EventRepository`
```ts
interface EventRepository {
  listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>>;
  listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarUpcomingEventDTO>>;
  createEvent(event: CalendarEventDTO): Promise<void>;
  updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
```

### 3.5 `CartographerHookGateway`
```ts
interface CartographerHookGateway {
  dispatchHooks(events: ReadonlyArray<CalendarEventDTO>, phenomena: ReadonlyArray<PhenomenonTriggerDTO>, context: { travelId?: string; scope: 'global' | 'travel' }): Promise<void>;
  notifyTravelPanel(payload: TravelPanelUpdateDTO): Promise<void>;
}
```

## 4. Request/Response DTOs für Zeitfortschritt
```ts
interface AdvanceRequestDTO {
  calendarId: string;
  amount: number; // kann negativ sein
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'custom';
  customRange?: { start: CalendarDateDTO; end: CalendarDateDTO; normalize?: boolean };
  followUpMode: 'auto' | 'manual';
}
interface AdvanceResultDTO {
  newTimestamp: CalendarDateDTO;
  triggered: ReadonlyArray<CalendarEventDTO>;
  triggeredPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  skipped: ReadonlyArray<CalendarEventDTO>;
  skippedPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  normalization?: { carriedMinutes: number; carriedHours: number };
}
interface JumpRequestDTO {
  calendarId: string;
  target: CalendarDateDTO;
  followUpMode: 'auto' | 'manual';
}
interface JumpResultDTO {
  timestamp: CalendarDateDTO;
  skipped: ReadonlyArray<CalendarEventDTO>;
  skippedPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  warnings?: ReadonlyArray<{ code: 'normalized' | 'out_of_bounds'; message: string }>;
}
interface TravelLeafPrefsDTO {
  mode: TravelCalendarMode;
  visible: boolean;
  lastViewedTimestamp: CalendarDateDTO;
  quickStep?: { preset: 'minute' | 'hour' | 'day'; amount: number };
}
interface TravelPanelUpdateDTO {
  currentTimestamp: CalendarDateDTO;
  triggeredEvents: ReadonlyArray<CalendarEventDTO>;
  triggeredPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
  skippedEvents: ReadonlyArray<CalendarEventDTO>;
  skippedPhenomena: ReadonlyArray<PhenomenonTriggerDTO>;
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
    "hoursPerDay": { "type": "integer", "minimum": 1, "default": 24 },
    "minutesPerHour": { "type": "integer", "minimum": 1, "default": 60 },
    "secondsPerMinute": { "type": "integer", "minimum": 1, "default": 60 },
    "minuteStep": { "type": "integer", "minimum": 1, "default": 15 },
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
  "required": ["mode", "visible", "lastViewedTimestamp"],
  "properties": {
    "mode": { "enum": ["month", "week", "day", "upcoming"] },
    "visible": { "type": "boolean" },
    "lastViewedTimestamp": { "$ref": "#/definitions/timestamp" },
    "quickStep": {
      "type": "object",
      "required": ["preset", "amount"],
      "properties": {
        "preset": { "enum": ["minute", "hour", "day"] },
        "amount": { "type": "integer" }
      }
    }
  },
  "definitions": {
    "timestamp": {
      "type": "object",
      "required": ["calendarId", "year", "monthId", "day", "precision"],
      "properties": {
        "calendarId": { "type": "string" },
        "year": { "type": "integer" },
        "monthId": { "type": "string" },
        "day": { "type": "integer" },
        "hour": { "type": "integer", "minimum": 0 },
        "minute": { "type": "integer", "minimum": 0 },
        "second": { "type": "integer", "minimum": 0 },
        "precision": { "enum": ["day", "minute", "second"] }
      }
    }
  }
}
```
### 5.4 Phänomenpersistenz
```json
{
  "$id": "almanac.phenomena",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "category", "rule", "priority", "schemaVersion"],
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string", "minLength": 1 },
      "category": { "enum": ["season", "astronomy", "weather", "tide", "holiday", "custom"] },
      "visibility": { "enum": ["all_calendars", "selected"], "default": "all_calendars" },
      "appliesToCalendarIds": { "type": "array", "items": { "type": "string" } },
      "rule": { "type": "object", "properties": { "type": { "enum": ["annual", "monthly_position", "weekly_dayIndex", "astronomical", "custom"] } }, "additionalProperties": true },
      "timePolicy": { "enum": ["all_day", "fixed", "offset"], "default": "all_day" },
      "startTime": { "type": "object", "properties": { "hour": { "type": "integer" }, "minute": { "type": "integer" }, "second": { "type": "integer" } } },
      "durationMinutes": { "type": "integer", "minimum": 0 },
      "effects": { "type": "array", "items": { "type": "object", "required": ["type"], "properties": { "type": { "enum": ["weather", "narrative", "mechanical"] }, "payload": { "type": "object" } } } },
      "priority": { "type": "integer", "minimum": 0 },
      "tags": { "type": "array", "items": { "type": "string" } },
      "hooks": { "type": "array" },
      "template": { "type": "boolean", "default": false },
      "schemaVersion": { "type": "string" }
    }
  }
}
```

### 5.5 Almanac-Mode Persistenz
```json
{
  "$id": "almanac.mode",
  "type": "object",
  "required": ["mode"],
  "properties": {
    "mode": { "enum": ["dashboard", "manager", "events", "travel"] },
    "statusSummary": {
      "type": "object",
      "properties": {
        "zoomLabel": { "type": "string" },
        "filterCount": { "type": "integer", "minimum": 0 }
      }
    },
    "lastZoom": { "type": "object", "additionalProperties": { "type": ["string", "null"] } },
    "lastFilters": { "type": "object", "additionalProperties": true }
  }
}
```


## 6. Fehlerobjekte
```ts
interface CalendarError {
  code: 'validation_error' | 'conflict' | 'io_error' | 'not_found' | 'time_range_invalid' | 'phenomenon_conflict' | 'astronomy_source_missing';
  scope: 'calendar' | 'event' | 'phenomenon' | 'default' | 'travel' | 'events';
  message: string;
  details?: Record<string, unknown>;
}
```
- `validation_error`: Feldfehler (z.B. Wochenlänge 0, Custom-Rule invalid).
- `conflict`: Default-Verletzung (zwei globale Defaults) oder Eventkollision.
- `phenomenon_conflict`: Phänomen kollidiert mit bestehendem Ereignis/Hook (siehe [UX_SPEC.md §3.4](./UX_SPEC.md#34-phaenomen-kalender-verknuepfen--hooks-konfigurieren)).
- `astronomy_source_missing`: Astronomische Berechnung erfordert Quelle (z.B. Referenzkalender) – siehe [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md#edge-cases--performance).
- `io_error`: Persistenz-/Dateifehler.
- `not_found`: Kalender/Ereignis existiert nicht (z.B. gelöscht).
- `time_range_invalid`: Uhrzeit außerhalb Schema (`hoursPerDay`, `minuteStep`).

Fehler werden an UI via `ERROR_OCCURRED` (siehe [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)) propagiert.

## 7. Versionierung & Migrationen
| Version | Änderung | Migration |
| --- | --- | --- |
| `1.0.0` | Basis-Schema (Kalender, Events) | Initiale Anlage |
| `1.1.0` | Default-Flags (`isDefaultGlobal`, `defaultTravelIds`), Travel-Leaf-Präferenzen | Migration: `defaults.global`/`defaults.travel` Datei anlegen, vorhandene Kalender ohne Default → `null` |
| `1.2.0` | Zoom-optimierte Event-Snapshots (Cached ranges) | Migration: Precompute Range-Caches (lazy on demand) |
| `1.3.0` | Sub-Tages-Zeitmodell (Stunden/Minuten) | Migration: Felder `hoursPerDay`, `minutesPerHour`, `minuteStep` ergänzen; Events ohne Zeit → `allDay=true` |
| `1.4.0` | Almanac-Modus, Phänomen-Repository, Events-Präferenzen | Migration: `almanac.phenomena.json` + `almanac.mode.json` anlegen; bestehende Daten initial leer; Events-Preferences optional migrieren |

Migration-Schritte:
1. `CalendarRepository` führt Schema-Version-Check aus (`schemaVersion`).
2. Bei fehlendem Default-Speicher legt Migration `calendar.defaults.json` an und weist globalen Default heuristisch (erster Kalender) zu.
3. Travel-Leaf Prefs: Standard `{ mode: 'upcoming', visible: false, lastViewedTimestamp = currentTimestamp }`; Quick-Step `{ preset: 'day', amount: 1 }`.
4. Fehlende Felder in Events werden mit Defaults ergänzt (`followUpPolicy = 'auto'`, `allDay = true`, `timePrecision = 'day'`).
5. Bei Migration auf 1.3.0: `minuteStep` = 60/`hoursPerDay` falls nicht angegeben, `secondsPerMinute` = 60.

## 8. Cartographer Integration
- `CartographerHookGateway.notifyTravelPanel` sendet `TravelPanelUpdateDTO` an `apps/cartographer/travel/panel`.
- Hooks `cartographer_event` erhalten Payload `{ travelId, calendarId, eventId, occurrence }`; Phänomene verwenden `cartographer_phenomenon` mit `{ travelId, phenomenonId, occurrence, effects }`.
- Travel-Leaf mount/unmount Signale:
  ```ts
  interface TravelLeafLifecycleGateway {
    onTravelStart(callback: (travelId: string) => void): Unsubscribe;
    onTravelEnd(callback: (travelId: string) => void): Unsubscribe;
  }
  ```
- Default-Änderungen werden an Cartographer gemeldet, damit Reise-Dropdowns aktualisiert werden (`CartographerController.refreshCalendarOptions`).

## 9. Testbare Verträge
- Alle Gateways mit Interfaces + `__mock__` Implementierung für Tests (siehe [../../tests/apps/almanac/TEST_PLAN.md](../../../tests/apps/almanac/TEST_PLAN.md)).
- Schemas validieren via `ajv` oder `zod` in Domain-Tests.

## 10. Verweise
- UX-Flows: [UX_SPEC.md](./UX_SPEC.md)
- Zustandslogik: [STATE_MACHINE.md](./STATE_MACHINE.md)
- Komponenten: [COMPONENTS.md](./COMPONENTS.md)
