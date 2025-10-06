# Calendar Workmode – Zustandsmaschine & Ablaufdiagramme
Dieses Dokument beschreibt die State-Slices, Events und Nebenwirkungen des Calendar-Workmodes. Es ergänzt [UX_SPEC.md](./UX_SPEC.md) und [COMPONENTS.md](./COMPONENTS.md).

## 1. Globale State-Slices
| Slice | Beschreibung | Quelle/Persistenz |
| --- | --- | --- |
| `calendarState` | Domaindaten: aktive Kalender-ID, aktuelles Datum, Schema, Pending Events. | `CalendarStateGateway` + `CalendarRepository` |
| `calendarList` | Liste aller verfügbaren Kalender inkl. Metadata. | `CalendarRepository.list()` |
| `eventCollections` | Map pro Kalender mit Ereignissen (Single/Recurring/Vorlagen). | `CalendarEventRepository` |
| `uiState` | UI-Flags (Loading, Dialoge, Filter, Fehler). | Presenter interner Zustand / `ModeStore` |
| `eventLog` | Chronik ausgelöster Ereignisse. | `CalendarEventEngine` (Persistenz optional) |
| `travelSync` | Spiegelung Travel-Integration (Status, pendingHooks). | `CartographerTravelGateway` |

### State-Typen
```ts
type CalendarModeState = {
  calendarState: {
    activeCalendarId: string | null;
    currentDate: CalendarDateDisplay | null;
    schema: CalendarSchema | null;
    pendingEvents: TriggeredEventSummary[];
  };
  calendarList: CalendarListRow[];
  eventCollections: Record<string, CalendarEventCollection>;
  uiState: {
    isLoading: boolean;
    dialogs: {
      manager: 'closed' | 'list' | { mode: 'create' | 'edit'; calendarId?: string };
      eventModal: 'closed' | { mode: 'single' | 'recurring'; eventId?: string };
      advance: boolean;
      jump: boolean;
    };
    filters: EventFilter;
    errors: CalendarModeError[];
  };
  eventLog: TriggeredEventLogEntry[];
  travelSync: {
    status: 'idle' | 'advancing' | 'error';
    lastAdvanceId?: string;
    pendingHooks: PendingHookExecution[];
  };
};
```

## 2. Events/Actions
| Event | Payload | Beschreibung |
| --- | --- | --- |
| `CALENDAR_LIST_LOADED` | `CalendarListRow[]` | Initiales Laden / Refresh der Kalenderliste. |
| `CALENDAR_SELECTED` | `{ calendarId: string; scope: 'global' | 'travel' }` | Nutzer:in oder Reise wählt aktiven Kalender. |
| `CALENDAR_CREATED` | `{ calendar: CalendarSchema }` | Neuer Kalender angelegt. |
| `CALENDAR_UPDATED` | `{ calendar: CalendarSchema; conflicts?: MigrationConflict[] }` | Schema bearbeitet. |
| `CALENDAR_DELETED` | `{ calendarId: string }` | Kalender entfernt. |
| `EVENT_CREATED` | `{ calendarId: string; event: CalendarEvent }` | Neues Ereignis (single/recurring). |
| `EVENT_UPDATED` | `{ calendarId: string; event: CalendarEvent }` | Ereignis bearbeitet. |
| `EVENT_DELETED` | `{ calendarId: string; eventId: string }` | Ereignis gelöscht. |
| `EVENT_FILTER_CHANGED` | `EventFilter` | UI-Filter aktualisiert. |
| `TIME_ADVANCE_REQUESTED` | `AdvanceRequest` | Quick Action oder Dialog.
| `TIME_ADVANCED` | `AdvanceResult` | Domain hat Advance durchgeführt. |
| `TIME_ADVANCE_FAILED` | `AdvanceError` | Fehler bei Advance. |
| `TIME_JUMP_REQUESTED` | `JumpRequest` | Datum setzen Dialog. |
| `TIME_JUMPED` | `JumpResult` | Domain hat Datum gesetzt. |
| `TIME_JUMP_FAILED` | `JumpError` | Fehler beim Setzen. |
| `TRAVEL_SYNC_STARTED` | `{ advanceId: string }` | Cartographer-Advance begonnen. |
| `TRAVEL_SYNC_COMPLETED` | `{ advanceId: string; result: AdvanceResult }` | Reise-Sync abgeschlossen. |
| `TRAVEL_SYNC_FAILED` | `{ advanceId: string; error: AdvanceError }` | Reise-Sync fehlgeschlagen. |
| `ERROR_DISMISSED` | `{ errorId: string }` | Nutzer:in schließt Fehlermeldung. |

## 3. Transitionstabelle (Auszug)
| Vorheriger State | Event | Neuer State | Zusatzaktionen |
| --- | --- | --- | --- |
| `uiState.isLoading=true` | `CALENDAR_LIST_LOADED` | `isLoading=false`, `calendarList` aktualisiert. | Wenn `activeCalendarId` leer → `dialogs.manager='list'` (Leerstaat). |
| Beliebig | `CALENDAR_SELECTED` | `calendarState.activeCalendarId` gesetzt, `uiState.isLoading=true`. | Trigger `CalendarStateGateway.loadCalendar(calendarId)` (Effect). |
| `calendarState.activeCalendarId` gesetzt | `TIME_ADVANCE_REQUESTED` | `travelSync.status='advancing'`, `uiState.dialogs.advance=false`. | Effect: `CalendarStateGateway.advance(request)`.
| Advance pending | `TIME_ADVANCED` | `calendarState.currentDate` aktualisiert, `eventLog` append, `travelSync.status='idle'`. | Persistiere `currentDate`, dispatch Hooks (Effect). |
| Advance pending | `TIME_ADVANCE_FAILED` | `travelSync.status='error'`, `uiState.errors` append. | Zeige Banner, biete Retry. |
| Jump pending | `TIME_JUMPED` | `currentDate` gesetzt, `eventLog` append (skipped). | Persistiere Datum, optional `backfillQueue` abarbeiten. |
| Jump pending | `TIME_JUMP_FAILED` | `uiState.errors` append. | Markiere Feldfehler, belasse Dialog offen. |
| `eventCollections` vorhanden | `EVENT_FILTER_CHANGED` | `uiState.filters` aktualisiert. | Presenter filtert Liste (kein Effect). |
| `travelSync.status='advancing'` | `TRAVEL_SYNC_COMPLETED` | `status='idle'`, synchronisiere `eventLog`. | Update Travel-Panel (`CartographerTravelGateway.notify`). |
| `travelSync.status='advancing'` | `TRAVEL_SYNC_FAILED` | `status='error'`, `uiState.errors` append. | Rollback `currentDate` falls Advance-Result vorhanden. |
| Beliebig | `ERROR_DISMISSED` | Entferne Eintrag aus `uiState.errors`. | Keine Effekte. |

## 4. Ablaufdiagramme (Detail)
### 4.1 Zeit fortschreiten (UI-Trigger)
```
[Quick Action]
   ↓
TIME_ADVANCE_REQUESTED
   ↓ (Effect)
CalendarStateGateway.advance
   ↙                 ↘
TIME_ADVANCED      TIME_ADVANCE_FAILED
   ↓                 ↓
State aktualisieren  Fehlerbanner + retry
   ↓
Cartographer Hooks dispatch
   ↓
EventLog Append
```

### 4.2 Datum setzen (Jump)
```
[Dialog Submit]
   ↓
TIME_JUMP_REQUESTED → Domain.validateJump
   ↙                          ↘
TIME_JUMPED               TIME_JUMP_FAILED
   ↓                          ↓
State aktualisieren         Dialog bleibt offen
Skipped Events Panel        Fehler fokussieren
```

### 4.3 Kalender erstellen
```
[Form Submit]
   ↓
CalendarRepository.create
   ↓
CALENDAR_CREATED → Append to calendarList
   ↓
(optional) CALENDAR_SELECTED → Lade Schema, Datum
```

### 4.4 Reise-Sync
```
Cartographer.advanceTime
   ↓
TRAVEL_SYNC_STARTED → travelSync.status='advancing'
   ↓ (Effect)
CalendarStateGateway.advance
   ↙                             ↘
TRAVEL_SYNC_COMPLETED         TRAVEL_SYNC_FAILED
   ↓                             ↓
Travel panel update            Fehlerbanner + rollback
```

## 5. Effekte (Side Effects)
| Effekt | Auslöser | Beschreibung |
| --- | --- | --- |
| `loadCalendar(calendarId)` | `CALENDAR_SELECTED` | Lädt Schema, currentDate, Events aus Repository. |
| `persistActiveCalendar` | `CALENDAR_SELECTED` | Speichert Auswahl (global oder Reise). |
| `createCalendar(data)` | `CALENDAR_CREATED` (post event) | Schreibt Schema in Repository. |
| `updateCalendar(data)` | `CALENDAR_UPDATED` | Persistiert Schema und Migrationsergebnisse. |
| `deleteCalendar(id)` | `CALENDAR_DELETED` | Entfernt Schema und verknüpfte Events. |
| `saveEvent(event)` | `EVENT_CREATED`/`EVENT_UPDATED` | Persistiert Event; aktualisiert Recurrence-Cache. |
| `removeEvent(id)` | `EVENT_DELETED` | Löscht Event; invalidiert Caches. |
| `advance(request)` | `TIME_ADVANCE_REQUESTED` | Berechnet neue Zeit, Events, Hooks. |
| `setDate(request)` | `TIME_JUMP_REQUESTED` | Setzt Datum, listet übersprungene Events. |
| `dispatchHooks(events)` | `TIME_ADVANCED`, `TIME_JUMPED` (wenn `backfill=true`) | Sendet Ereignisse an Cartographer/Encounter/Library Gateways. |
| `logTelemetry(event)` | Alle kritischen Operationen | Schreibt Metriken (siehe Implementierungsplan). |

## 6. Fehlerobjekte im State
```ts
interface CalendarModeError {
  id: string;
  type: 'validation' | 'io_error' | 'conflict' | 'hook_failure';
  message: string; // i18n key
  details?: Record<string, unknown>;
  retryAction?: () => void;
}
```
- Fehler erscheinen im Dashboard-Banner und ggf. in Formularen.

## 7. Persistenz & Synchronisation
- `calendarState` wird beim Wechsel des aktiven Kalenders aus dem Repository neu geladen.
- `eventCollections` werden demand-geladen (Lazy) und bei Änderungen invalidiert.
- `travelSync.status` bestimmt UI-Feedback im Travel-Panel ([WIREFRAMES](./WIREFRAMES.md#5-reise-sync-feedback-im-travel-panel)).

## 8. Annahmen
- Assumption: Presenter verwaltet State über `ModeStore` (ähnlich Library-Workflows) mit Actions/Reducers.
- Assumption: Advance/Jump sind atomar – Domain liefert sowohl neues Datum als auch Liste der ausgelösten Events, damit UI keine separaten Calls benötigt.
