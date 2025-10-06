# Calendar Workmode – API & Persistenzverträge
Dieses Dokument definiert Contracts zwischen UI, Domain, Persistenz und Cartographer-Integration. Es ergänzt [STATE_MACHINE.md](./STATE_MACHINE.md) und [COMPONENTS.md](./COMPONENTS.md).

## 1. Domain-Typen
```ts
// src/apps/calendar/domain/types.ts
export interface CalendarSchema {
  id: string;
  name: string;
  description?: string;
  weekLength: number; // z.B. 10 für 10-Tage-Woche
  months: Array<{
    id: string;
    name: string;
    length: number; // Tage pro Monat
    intercalary?: boolean; // Schaltmonat
  }>;
  leapRules?: Array<LeapRule>; // z.B. alle 4 Jahre zusätzlicher Tag
  startYear: number;
  epochDate: CalendarDate; // 0-basierter Startpunkt
  metadata: Record<string, unknown>;
}

export interface CalendarDate {
  year: number;
  monthIndex: number; // 0-basiert
  day: number; // 1-basiert
}

export type CalendarDateDisplay = CalendarDate & {
  dayOfWeek: number;
  formatted: string; // Presenter setzt via Domain helper
};

export interface CalendarEventBase {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  notes?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventSingle extends CalendarEventBase {
  type: 'single';
  date: CalendarDate;
}

export interface CalendarEventRecurring extends CalendarEventBase {
  type: 'recurring';
  rule: RepeatRule;
  start?: CalendarDate;
  end?: CalendarDate | { occurrences: number };
}

export type CalendarEvent = CalendarEventSingle | CalendarEventRecurring;

export type RepeatRule =
  | { type: 'annual'; offset: number } // offset ab Jahresanfang
  | { type: 'monthly_position'; monthIndex?: number; week: number; dayIndex: number }
  | { type: 'weekly'; dayIndex: number }
  | { type: 'custom_hook'; hookId: string; payload?: Record<string, unknown> };

export interface LeapRule {
  type: 'interval' | 'custom';
  intervalYears?: number;
  customEvaluatorHook?: string; // hookId
}
```

## 2. Repository-Schnittstellen
```ts
// src/apps/calendar/CalendarRepository.ts
export interface CalendarRepository {
  list(): Promise<CalendarSchema[]>;
  get(calendarId: string): Promise<CalendarSchema | null>;
  create(input: CalendarSchemaInput): Promise<CalendarSchema>;
  update(calendarId: string, input: CalendarSchemaInput): Promise<CalendarSchema>;
  delete(calendarId: string): Promise<void>;
}

export interface CalendarSchemaInput {
  name: string;
  description?: string;
  weekLength: number;
  months: CalendarSchema['months'];
  leapRules?: LeapRule[];
  startYear: number;
  epochDate: CalendarDate;
  metadata?: Record<string, unknown>;
}

// src/apps/calendar/CalendarEventRepository.ts
export interface CalendarEventRepository {
  list(calendarId: string): Promise<CalendarEventCollection>;
  listByFilter(calendarId: string, filter: EventFilter): Promise<CalendarEventCollection>;
  create(calendarId: string, input: CalendarEventInput): Promise<CalendarEvent>;
  update(calendarId: string, eventId: string, input: CalendarEventInput): Promise<CalendarEvent>;
  delete(calendarId: string, eventId: string): Promise<void>;
}

export type CalendarEventCollection = {
  single: CalendarEventSingle[];
  recurring: CalendarEventRecurring[];
  templates: CalendarEvent[];
};

export type CalendarEventInput =
  | { type: 'single'; value: Omit<CalendarEventSingle, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'recurring'; value: Omit<CalendarEventRecurring, 'id' | 'createdAt' | 'updatedAt'> };
```

## 3. Gateway & Services
```ts
// src/apps/calendar/domain/CalendarStateGateway.ts
export interface CalendarStateGateway {
  loadActiveCalendar(scope: 'global' | { travelId: string }): Promise<CalendarSnapshot | null>;
  setActiveCalendar(scope: 'global' | { travelId: string }, calendarId: string): Promise<void>;
  advance(request: AdvanceRequest): Promise<AdvanceResult>;
  jump(request: JumpRequest): Promise<JumpResult>;
  getEventLog(calendarId: string, limit?: number): Promise<TriggeredEventLogEntry[]>;
}

export interface CalendarSnapshot {
  calendarId: string;
  schema: CalendarSchema;
  currentDate: CalendarDate;
  pendingEvents: TriggeredEventSummary[];
}

export interface AdvanceRequest {
  calendarId: string;
  step: { value: number; unit: 'day' | 'week' | 'month'; direction: 'forward' | 'backward' };
  autoTriggerEvents: boolean;
  context: 'mode' | { travelId: string };
}

export interface AdvanceResult {
  calendarId: string;
  previousDate: CalendarDate;
  newDate: CalendarDate;
  triggeredEvents: TriggeredEventLogEntry[];
  hookDispatch: HookDispatchResult;
  telemetry: AdvanceTelemetry;
}

export interface JumpRequest {
  calendarId: string;
  targetDate: CalendarDate;
  autoTriggerEvents: boolean;
  context: 'mode' | { travelId: string };
}

export interface JumpResult {
  calendarId: string;
  previousDate: CalendarDate;
  newDate: CalendarDate;
  skippedEvents: TriggeredEventLogEntry[];
  hookDispatch: HookDispatchResult;
}

export interface HookDispatchResult {
  dispatched: string[]; // hookIds
  failed: Array<{ hookId: string; error: string }>;
}

export interface AdvanceTelemetry {
  durationMs: number;
  triggeredCount: number;
  skippedCount: number;
}
```

## 4. Cartographer Hooks
```ts
// src/apps/cartographer/travel/calendar-integration.ts
export interface CartographerCalendarHooks {
  onCalendarAdvance(result: AdvanceResult): Promise<void>;
  onCalendarError(error: CalendarGatewayError): Promise<void>;
}
```
- `CartographerController` ruft `CalendarStateGateway.advance`/`jump` auf und übergibt Rückgaben an diese Hooks.
- Travel-Panel konsumiert `AdvanceResult` (Datum, Events, HookStatus).

## 5. DTO- & JSON-Schemas
### CalendarSchema JSON
```json
{
  "$id": "calendar.schema.v1",
  "type": "object",
  "required": ["id", "name", "weekLength", "months", "startYear", "epochDate"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "weekLength": { "type": "integer", "minimum": 1, "maximum": 20 },
    "months": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "length"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "length": { "type": "integer", "minimum": 1, "maximum": 80 },
          "intercalary": { "type": "boolean" }
        }
      }
    },
    "leapRules": { "type": "array", "items": { "$ref": "#/$defs/leapRule" } },
    "startYear": { "type": "integer" },
    "epochDate": { "$ref": "#/$defs/date" },
    "metadata": { "type": "object", "additionalProperties": true }
  },
  "$defs": {
    "date": {
      "type": "object",
      "required": ["year", "monthIndex", "day"],
      "properties": {
        "year": { "type": "integer" },
        "monthIndex": { "type": "integer", "minimum": 0 },
        "day": { "type": "integer", "minimum": 1 }
      }
    },
    "leapRule": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "enum": ["interval", "custom"] },
        "intervalYears": { "type": "integer", "minimum": 1 },
        "customEvaluatorHook": { "type": "string" }
      }
    }
  }
}
```

### CalendarEvent JSON
```json
{
  "$id": "calendar.event.v1",
  "oneOf": [
    {
      "type": "object",
      "required": ["id", "type", "title", "date"],
      "properties": {
        "id": { "type": "string" },
        "type": { "const": "single" },
        "title": { "type": "string" },
        "date": { "$ref": "calendar.schema.v1#/$defs/date" },
        "category": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "notes": { "type": "string" },
        "color": { "type": "string" }
      }
    },
    {
      "type": "object",
      "required": ["id", "type", "title", "rule"],
      "properties": {
        "id": { "type": "string" },
        "type": { "const": "recurring" },
        "title": { "type": "string" },
        "rule": {
          "oneOf": [
            { "type": "object", "required": ["type", "offset"], "properties": { "type": { "const": "annual" }, "offset": { "type": "integer", "minimum": 0 } } },
            { "type": "object", "required": ["type", "week", "dayIndex"], "properties": { "type": { "const": "monthly_position" }, "monthIndex": { "type": "integer", "minimum": 0 }, "week": { "type": "integer", "minimum": 1, "maximum": 6 }, "dayIndex": { "type": "integer", "minimum": 0 } } },
            { "type": "object", "required": ["type", "dayIndex"], "properties": { "type": { "const": "weekly" }, "dayIndex": { "type": "integer", "minimum": 0 } } },
            { "type": "object", "required": ["type", "hookId"], "properties": { "type": { "const": "custom_hook" }, "hookId": { "type": "string" }, "payload": { "type": "object", "additionalProperties": true } } }
          ]
        },
        "start": { "$ref": "calendar.schema.v1#/$defs/date" },
        "end": {
          "oneOf": [
            { "$ref": "calendar.schema.v1#/$defs/date" },
            { "type": "object", "required": ["occurrences"], "properties": { "occurrences": { "type": "integer", "minimum": 1 } } }
          ]
        }
      }
    }
  ]
}
```

## 6. Fehlerobjekte & Codes
```ts
export type CalendarGatewayError =
  | { code: 'validation_error'; field?: string; message: string }
  | { code: 'conflict'; conflictType: 'duplicate_rule' | 'schema_migration'; details?: unknown }
  | { code: 'io_error'; operation: string; message: string }
  | { code: 'hook_failure'; hookId: string; message: string };
```
- UI mappt `code` auf Banner/Texte (siehe [UX_SPEC](./UX_SPEC.md#4-fehler-und-leerstaaten)).
- `validation_error` enthält `field` Key (z.B. `months[2].length`).

## 7. Helper-Funktionen
```ts
export interface CalendarFormattingService {
  formatDate(date: CalendarDate, schema: CalendarSchema, options?: { withWeek?: boolean }): string;
  formatRange(start: CalendarDate, end: CalendarDate, schema: CalendarSchema): string;
  dayOfYear(date: CalendarDate, schema: CalendarSchema): number;
}

export interface RecurrenceEngine {
  preview(rule: RepeatRule, schema: CalendarSchema, start: CalendarDate | undefined, limit: number): CalendarDate[];
  conflicts(events: CalendarEventRecurring[], rule: RepeatRule): RecurrenceConflict[];
}
```

## 8. Versionierung & Migration
- JSON-Dateien speichern `schemaVersion` (initial `1`).
- Bei Schema-Änderung wird `CalendarSchemaMigration` angewandt:
  ```ts
  interface CalendarSchemaMigration {
    fromVersion: number;
    toVersion: number;
    migrateSchema(schema: CalendarSchema): CalendarSchema;
    migrateEvents(events: CalendarEvent[], oldSchema: CalendarSchema, newSchema: CalendarSchema): MigrationResult;
  }
  interface MigrationResult {
    migrated: CalendarEvent[];
    conflicts: MigrationConflict[];
  }
  interface MigrationConflict {
    eventId: string;
    reason: 'date_out_of_range' | 'duplicate_after_migration' | 'custom';
    suggestedFix?: string;
  }
  ```
- Persistenz speichert Konflikte im Event (`event.metadata.conflict=true`) bis Nutzer:in löst.

## 9. Persistenzspeicher
- Standard: `JsonStore<CalendarSchema>` unter `data/calendar-schemas.json`, `JsonStore<CalendarEvent>` unter `data/calendar-events.json`.
- Assumption: Repository kapselt File-Locks; Schreiboperationen atomar via temporäre Datei + rename.

## 10. Telemetriepayloads
```ts
export interface CalendarTelemetryPort {
  log(event: {
    name: 'calendar.time.advance' | 'calendar.time.jump' | 'calendar.schema.migrate' | 'calendar.event.create';
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): void;
}
```
- Presenter ruft `CalendarTelemetryPort.log` nach erfolgreichen Operationen auf.

## 11. Assumptions & TODO
- Assumption: Cartographer-Integration akzeptiert `AdvanceResult` unverändert (keine zusätzlichen Mapping nötig).
- TODO (Implementierung): Konkrete Dateipfade in Repository finalisieren und mit `core/persistence` abstimmen.
