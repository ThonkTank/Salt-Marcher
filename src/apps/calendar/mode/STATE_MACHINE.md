# Calendar Workmode – Zustandsmaschine
Dieses Dokument beschreibt State-Slices, Events, Transitionen und Effekte des Calendar-Workmodes. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [COMPONENTS.md](./COMPONENTS.md) und [API_CONTRACTS.md](./API_CONTRACTS.md).

## 1. Überblick
- Architektur: Presenter (StateMachine) + ViewModel. State wird über `immer` oder äquivalent immutable gehalten.
- Gliederung in drei Hauptslices:
  - `calendarState` (Domain-nah: aktive Kalender, Datum, Ereignisse)
  - `managerUiState` (Workmode/Manager-spezifische UI-Flags)
  - `travelLeafState` (Reisemodus-spezifische Sichtbarkeit und Modus)
- Persistenz über `CalendarStateGateway` (siehe [API_CONTRACTS.md](./API_CONTRACTS.md#gateways)).

## 2. State-Slices
| Slice | Schlüssel | Beschreibung | Persistenz |
| --- | --- | --- | --- |
| `calendarState` | `activeCalendarId`, `defaultCalendarId`, `travelDefaultCalendarId`, `currentDate`, `upcomingEvents`, `triggeredEvents`, `skippedEvents` | Domain-Daten, die vom Gateway geladen/geschrieben werden. | Persistiert (Gateway) |
| `calendarState.calendars` | Map `calendarId -> CalendarSummaryDTO` | Cache der bekannten Kalender (Name, Schema, Flags). | Persistiert (Repository) |
| `managerUiState` | `viewMode`, `zoom`, `filters`, `overviewLayout`, `selection`, `isLoading`, `error` | UI-spezifische Flags für Manager/Übersicht. | Nicht persistiert (Session) |
| `managerUiState.form` | `currentDialog` (`'calendar' | 'event' | 'time' | null`), `dialogData` | Offene Dialoge und deren Parameter. | Nicht persistiert |
| `travelLeafState` | `visible`, `mode`, `isLoading`, `error`, `range`, `events`, `skippedEvents`, `lastSync` | Zustand des Travel-Leaves. | Teilweise (sichtbarkeit/modus) |
| `telemetryState` | `lastEvents` | Meta-Informationen für Logging (z.B. Default-Wechsel). | Nicht persistiert |

## 3. Events/Actions {#eventsactions}
| Event | Payload | Beschreibung |
| --- | --- | --- |
| `INIT_CALENDAR_MODE` | `{ scope: 'global' | 'travel', travelId?: string }` | Initialisiert Dashboard/Manager, lädt Gateways. |
| `CALENDAR_DATA_LOADED` | `CalendarStateSnapshotDTO` | Resultat des Gateways (Kalenderliste, Defaults, Datum, Events). |
| `CALENDAR_SELECT_REQUESTED` | `{ calendarId: string; scope: 'global' | 'travel'; travelId?: string }` | Nutzer:in wählt aktiven Kalender. |
| `CALENDAR_SELECTED` | `Same as requested` | Bestätigung nach erfolgreicher Persistenz. |
| `DEFAULT_SET_REQUESTED` | `{ calendarId: string; scope: 'global' | 'travel'; travelId?: string }` | Toggle für Default. |
| `DEFAULT_SET_CONFIRMED` | `{ defaultCalendarId: string; travelId?: string }` | Persistenz bestätigt neuen Default. |
| `MANAGER_VIEW_MODE_CHANGED` | `{ viewMode: 'calendar' | 'overview' }` | Tab-Wechsel in Manager. |
| `MANAGER_ZOOM_CHANGED` | `{ zoom: 'month' | 'week' | 'day' }` | Kalenderansicht Zoom. |
| `MANAGER_FILTER_CHANGED` | `CalendarOverviewFilterState` | Übersicht-Filter. |
| `EVENT_FORM_OPENED` | `{ mode: 'single' | 'recurring'; date?: CalendarDateDTO }` | Öffnet Event-Dialog. |
| `EVENT_SAVE_REQUESTED` | `CalendarEventFormState` | Formular Submit. |
| `EVENT_SAVE_CONFIRMED` | `CalendarEventDTO` | Persistenz bestätigt. |
| `EVENT_DELETE_REQUESTED` | `{ eventId: string }` | Delete CTA. |
| `EVENT_DELETE_CONFIRMED` | `{ eventId: string }` | Delete erfolgreich. |
| `TIME_ADVANCE_REQUESTED` | `AdvanceRequestDTO` | Zeit voran. |
| `TIME_ADVANCE_CONFIRMED` | `AdvanceResultDTO` | Domain bestätigt Advance. |
| `TIME_JUMP_REQUESTED` | `JumpRequestDTO` | Direktes Datum setzen. |
| `TIME_JUMP_CONFIRMED` | `JumpResultDTO` | Ergebnis inkl. übersprungener Events. |
| `TRAVEL_LEAF_MOUNTED` | `{ travelId: string }` | Travel-Modus gestartet. |
| `TRAVEL_MODE_CHANGED` | `{ mode: TravelCalendarMode }` | Travel-Leaf Tab gewechselt. |
| `TRAVEL_TIME_ADVANCE_REQUESTED` | `AdvanceRequestDTO` | Quick-Action im Travel-Leaf. |
| `TRAVEL_LEAF_DISMISSED` | `void` | Leaf geschlossen (Nutzer:in oder Hook). |
| `ERROR_OCCURRED` | `UIErrorState & { scope: 'dashboard' | 'manager' | 'travel' }` | Fehlerbanner anzeigen. |
| `ERROR_RESOLVED` | `{ scope: 'dashboard' | 'manager' | 'travel' }` | Fehler zurücksetzen. |

## 4. Transitionstabellen
### 4.1 Kalenderauswahl & Defaults
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `calendarState.activeCalendarId = A` | `CALENDAR_SELECT_REQUESTED(B)` | `pending` Flag | Trigger Persistenz (`Gateway.setActiveCalendar`) |
| `pending` | `CALENDAR_SELECTED(B)` | `activeCalendarId = B`, `currentDate`, `upcomingEvents` aktualisiert | Aktualisiere Cache, lade Events; Telemetrie `calendar.telemetry.active_changed` |
| `defaultCalendarId = A` | `DEFAULT_SET_REQUESTED(B, global)` | `pendingDefault = B` | Gateway Update starten |
| `pendingDefault = B` | `DEFAULT_SET_CONFIRMED` | `defaultCalendarId = B`, `activeCalendarId` ggf. fallback | UI-Badge aktualisieren, Travel-Leaf re-render |
| `travelDefaultCalendarId = A` | `DEFAULT_SET_REQUESTED(B, travel)` | `pendingTravelDefault = B` | Gateway Update starten |
| `pendingTravelDefault` | `DEFAULT_SET_CONFIRMED` | `travelDefaultCalendarId = B` | Travel-Leaf highlight |

### 4.2 Manager UI
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `viewMode = 'calendar'` | `MANAGER_VIEW_MODE_CHANGED('overview')` | `viewMode = 'overview'` | Persistiere Modus in SessionStorage, lade Übersichtsdaten |
| `zoom = 'month'` | `MANAGER_ZOOM_CHANGED('week')` | `zoom = 'week'` | Re-request Range/Events (`Gateway.fetchEventsForRange`) |
| `filters` | `MANAGER_FILTER_CHANGED(next)` | `filters = next` | Debounced fetch, Telemetrie `calendar.telemetry.filter_applied` |
| `form.currentDialog = null` | `EVENT_FORM_OPENED(mode)` | `form.currentDialog = 'event'`, `dialogData = mode` | Fokus setzen, Prefill | 
| `form.currentDialog = 'event'` | `EVENT_SAVE_CONFIRMED` | `form.currentDialog = null` | Toast, Liste aktualisieren |

### 4.3 Zeitfortschritt
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `currentDate = D` | `TIME_ADVANCE_REQUESTED` | `isLoading = true` | Call `Gateway.advanceTime`, Travel-Leaf Loading |
| `isLoading = true` | `TIME_ADVANCE_CONFIRMED(result)` | `currentDate = result.newDate`, `triggeredEvents = result.triggered` | Append Log, Travel-Leaf refresh, Hooks dispatch |
| `currentDate = D` | `TIME_JUMP_REQUESTED` | `isLoading = true` | Call `Gateway.setDate` |
| `isLoading = true` | `TIME_JUMP_CONFIRMED(result)` | `currentDate = result.date`, `skippedEvents = result.skipped` | Zeige Dialog-Result, Travel-Leaf update |
| `travelLeafState.visible = true` | `TRAVEL_TIME_ADVANCE_REQUESTED` | `travelLeafState.isLoading = true` | Gateway Advance mit `scope: travel` |
| `travelLeafState.isLoading = true` | `TIME_ADVANCE_CONFIRMED` | `travelLeafState.isLoading = false`, `events` aktualisiert | Leaf UI refresh |

### 4.4 Travel Leaf Lifecycle
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `visible = false` | `TRAVEL_LEAF_MOUNTED(travelId)` | `visible = true`, `mode = storedMode || 'upcoming'`, `isLoading = true` | Lade Daten, Focus Toolbar |
| `visible = true` | `TRAVEL_MODE_CHANGED(mode)` | `mode = mode` | Persistiere Mode im Gateway (per-travel) |
| `visible = true` | `TRAVEL_LEAF_DISMISSED` | `visible = false` | Persistiere Sichtbarkeit, Telemetrie `calendar.travel.leaf_closed` |

## 5. Ablaufdiagramme {#ablaufdiagramme}
### 5.1 Default setzen
`Start → DEFAULT_SET_REQUESTED → Gateway.updateDefault → (Erfolg?) → [Ja] DEFAULT_SET_CONFIRMED → Update State/Broadcast → Ende / [Nein] ERROR_OCCURRED(scope=manager)`

### 5.2 Manager Moduswechsel
`Start → MANAGER_VIEW_MODE_CHANGED → Update viewMode → (Mode == 'calendar'?) → [Ja] ensure zoom data loaded → Ende / [Nein] load overview data → Ende`

### 5.3 Travel-Leaf Advance
`Start → TRAVEL_TIME_ADVANCE_REQUESTED → travelLeafState.isLoading = true → Gateway.advanceTime(scope=travel) → (Erfolg?) → [Ja] TIME_ADVANCE_CONFIRMED → Update travelLeafState, calendarState → Ende / [Nein] ERROR_OCCURRED(scope=travel)`

## 6. Effekte {#effekte}
| Effekt | Trigger | Beschreibung |
| --- | --- | --- |
| `loadCalendarData` | `INIT_CALENDAR_MODE` | Ruft Gateway (`CalendarStateGateway.loadSnapshot`) auf. |
| `persistActiveCalendar` | `CALENDAR_SELECT_REQUESTED` | Speichert aktiven Kalender (global oder Reise). |
| `persistDefault` | `DEFAULT_SET_REQUESTED` | Aktualisiert Default-Flags; bei globalem Default stellt sicher, dass kein zweiter Default existiert. |
| `fetchCalendarRange` | `MANAGER_VIEW_MODE_CHANGED('calendar')`, `MANAGER_ZOOM_CHANGED` | Ruft `CalendarRepository.fetchEvents(range)` für Zoom.
| `fetchOverviewData` | `MANAGER_VIEW_MODE_CHANGED('overview')`, `MANAGER_FILTER_CHANGED` | Lädt paginierte Übersichtsliste. |
| `saveCalendar` | `EVENT_SAVE_REQUESTED` (wenn `mode === 'calendar'` Dialog) | Verweist auf Domain-Service zum Erstellen/Bearbeiten (siehe [API_CONTRACTS.md](./API_CONTRACTS.md#repositories)). |
| `saveEvent` | `EVENT_SAVE_REQUESTED` (wenn `mode === 'event'`) | Persistiert Event, aktualisiert Caches. |
| `deleteEvent` | `EVENT_DELETE_REQUESTED` | Entfernt Event, aktualisiert Listen. |
| `advanceTime` | `TIME_ADVANCE_REQUESTED`, `TRAVEL_TIME_ADVANCE_REQUESTED` | Führt Advance aus, löst Hooks (`CartographerHookGateway`) aus. |
| `setDate` | `TIME_JUMP_REQUESTED` | Setzt Datum + Konfliktliste. |
| `mountTravelLeaf` | `TRAVEL_LEAF_MOUNTED` | Öffnet Leaf, lädt Daten, registriert Telemetrie. |
| `unmountTravelLeaf` | `TRAVEL_LEAF_DISMISSED` | Persistiert Off-State, deregistriert Listener. |
| `logTelemetry` | Diverse (Default, ModeChange, TravelMount) | Sendet `calendar.telemetry.*` (siehe [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md#telemetrie--observability)). |

## 7. Fehlerbehandlung
- Jeder Effekt fangt Fehler und dispatcht `ERROR_OCCURRED` mit Scope.
- Presenter bietet `retryEffect(scope)` → triggert letzten Effekt erneut (z.B. `loadCalendarData`).
- Bei `ERROR_OCCURRED` werden Loading-Flags zurückgesetzt, Dialoge geschlossen.

## 8. Persistenznotizen
- `defaultCalendarId`, `travelDefaultCalendarId`, `travelLeafState.mode`, `travelLeafState.visible` werden im Gateway persistiert (Vault + Reise-spezifisch).
- `managerUiState.viewMode` optional in `localStorage` (User-Preference).

## 9. Verweise
- UX-Flows: [UX_SPEC.md §3](./UX_SPEC.md#3-workflows)
- Komponenten: [COMPONENTS.md](./COMPONENTS.md)
- API: [API_CONTRACTS.md](./API_CONTRACTS.md)
- Tests: [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md)
