# Almanac Workmode – Zustandsmaschine
Dieses Dokument beschreibt State-Slices, Events, Transitionen und Effekte des Almanac-Workmodes. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [COMPONENTS.md](./COMPONENTS.md) und [API_CONTRACTS.md](./API_CONTRACTS.md).

## 1. Überblick
- Architektur: Presenter (StateMachine) + ViewModel. State wird über `immer` oder äquivalent immutable gehalten.
- Gliederung in fünf Hauptslices:
  - `calendarState` (Domain-nah: aktive Kalender, Datum, Ereignisse, Phänomen-Vorschau)
  - `almanacUiState` (Modus, Breadcrumbs, Persistenz letzter Zustände)
  - `managerUiState` (Workmode/Manager-spezifische UI-Flags)
  - `eventsUiState` (Events-Modus: Filter, View-Mode, Pagination, Auswahl)
  - `travelLeafState` (Reisemodus-spezifische Sichtbarkeit und Modus)
- Persistenz über `CalendarStateGateway` (siehe [API_CONTRACTS.md](./API_CONTRACTS.md#gateways)).

### 1.1 Mode-Hierarchie & Naming
| Ebene | State-Slice | Werte | Persistenz | Hinweise |
| --- | --- | --- | --- | --- |
| Almanac Shell | `almanacUiState.mode` | `'dashboard' | 'manager' | 'events'` | Gateway (`lastMode`) | Travel ist ausgeschlossen; Umschalten dispatcht `ALMANAC_MODE_SELECTED`. |
| Almanac Detail | `managerUiState.viewMode` | `'calendar' | 'overview'` | Session | Gilt nur in `Almanac › Manager`. |
| Almanac Detail | `eventsUiState.viewMode` | `'timeline' | 'table' | 'map'` | Gateway (lazy) | Spezifisch für `Almanac › Events`. |
| Cartographer Leaf | `travelLeafState.mode` | `'month' | 'week' | 'day' | 'upcoming'` | Travel Settings | Eigenes Lifecycle (`TRAVEL_LEAF_MOUNTED`/`DISMISSED`). |

- Breadcrumb-State (`almanacUiState.modeHistory`) speichert Parent → Child Pfade; Travel-Leaf verwaltet eigene Historie in `travelLeafState`.

## 2. State-Slices
| Slice | Schlüssel | Beschreibung | Persistenz |
| --- | --- | --- | --- |
| `calendarState` | `activeCalendarId`, `defaultCalendarId`, `travelDefaultCalendarId`, `currentTimestamp`, `timeDefinition`, `minuteStep`, `pendingTimeSlice`, `lastAdvanceStep`, `upcomingEvents`, `upcomingPhenomena`, `triggeredEvents`, `triggeredPhenomena`, `skippedEvents` | Domain-Daten (Kalender + Phänomene), vom Gateway geladen/geschrieben. | Persistiert (Gateway) |
| `calendarState.calendars` | Map `calendarId -> CalendarSummaryDTO` | Cache der bekannten Kalender (Name, Schema, Flags). | Persistiert (Repository) |
| `almanacUiState` | `mode`, `modeHistory`, `statusSummary`, `drawerOpen`, `lastZoomByMode`, `lastFiltersByMode` | UI-Kontext für Moduswechsel, Breadcrumbs, Mobile-Drawer. | Persistiert (Gateway für Modus, rest Session) |
| `managerUiState` | `viewMode`, `zoom`, `filters`, `overviewLayout`, `selection`, `isLoading`, `error`, `timeControls` (`preset`, `customStep`) | UI-spezifische Flags für Manager/Übersicht inkl. Quick-Steps. | Nicht persistiert (Session) |
| `managerUiState.form` | `currentDialog` (`'calendar' | 'event' | 'time' | null`), `dialogData` | Offene Dialoge und deren Parameter. | Nicht persistiert |
| `eventsUiState` | `viewMode`, `filters`, `sort`, `pagination`, `isLoading`, `error`, `selectedPhenomenonId`, `editorDraft`, `linkDrawerOpen` | Zustand des Events-Modus inkl. Formular/Drawer. | Modus/Filter persistiert, Rest Session |
| `travelLeafState` | `travelId`, `visible`, `mode`, `currentTimestamp`, `minuteStep`, `lastQuickStep`, `isLoading`, `error` | Zustand des Travel-Leaves inkl. Anzeigepräferenzen und letztem Quick-Step. | Teilweise (sichtbarkeit/modus) |
| `telemetryState` | `lastEvents` | Meta-Informationen für Logging (z.B. Default-/Mode-Wechsel). | Nicht persistiert |

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
| `MANAGER_ZOOM_CHANGED` | `{ zoom: 'month' | 'week' | 'day' | 'hour' }` | Kalenderansicht Zoom. |
| `MANAGER_FILTER_CHANGED` | `CalendarOverviewFilterState` | Übersicht-Filter. |
| `EVENT_FORM_OPENED` | `{ mode: 'single' | 'recurring'; timestamp?: CalendarTimestampDTO }` | Öffnet Event-Dialog. |
| `EVENT_SAVE_REQUESTED` | `CalendarEventFormState` | Formular Submit. |
| `EVENT_SAVE_CONFIRMED` | `CalendarEventDTO` | Persistenz bestätigt. |
| `EVENT_DELETE_REQUESTED` | `{ eventId: string }` | Delete CTA. |
| `EVENT_DELETE_CONFIRMED` | `{ eventId: string }` | Delete erfolgreich. |
| `TIME_ADVANCE_REQUESTED` | `AdvanceRequestDTO` | Zeit voran (inkl. Minuten/Stunden). |
| `TIME_ADVANCE_CONFIRMED` | `AdvanceResultDTO` | Domain bestätigt Advance. |
| `TIME_JUMP_REQUESTED` | `JumpRequestDTO` | Direktes Datum & Uhrzeit setzen. |
| `TIME_JUMP_CONFIRMED` | `JumpResultDTO` | Ergebnis inkl. übersprungener Events & Normalisierungshinweisen. |
| `TIME_SLICE_PRESET_CHANGED` | `{ scope: 'dashboard' | 'travel'; preset: 'minute' | 'hour' | 'day'; amount: number }` | Aktualisiert Quick-Step-Voreinstellung. |
| `TIME_DEFINITION_UPDATED` | `{ calendarId: string; timeDefinition: TimeDefinitionDTO }` | Schema-Anpassung ändert Stunden/Minuten. |
| `ALMANAC_MODE_SELECTED` | `{ mode: AlmanacMode }` | Nutzer:in wählt `Almanac › Dashboard`, `Almanac › Manager` oder `Almanac › Events`. |
| `ALMANAC_MODE_RESTORED` | `AlmanacModeSnapshot` | Gateway stellt letzten Modus + Status wieder her. |
| `EVENTS_VIEW_MODE_CHANGED` | `{ viewMode: EventsViewMode }` | Timeline/Tabelle/Karte umschalten. |
| `EVENTS_FILTER_CHANGED` | `EventsFilterState` | Filterchips aktualisieren. |
| `EVENTS_SORT_CHANGED` | `EventsSort` | Sortierreihenfolge ändern. |
| `EVENTS_DATA_REQUESTED` | `{ viewMode: EventsViewMode; filters: EventsFilterState }` | Startet Ladeprozess für Phänomene. |
| `EVENTS_DATA_LOADED` | `EventsDataBatchDTO` | Ergebnis eines Loads (Phänomene + Pagination). |
| `EVENTS_EXPORT_REQUESTED` | `{ format: 'csv' | 'json' }` | Export startet; Presenter ruft Gateway an. |
| `PHENOMENON_EDIT_REQUESTED` | `{ phenomenonId?: string; templateId?: string }` | Öffnet Editor (neu/bearbeiten/vorlage). |
| `PHENOMENON_DRAFT_UPDATED` | `PhenomenonDraftDTO` | Formularänderung. |
| `PHENOMENON_SAVE_REQUESTED` | `PhenomenonDraftDTO` | Submit Editor. |
| `PHENOMENON_SAVE_CONFIRMED` | `PhenomenonDTO` | Persistenz bestätigt; Liste aktualisieren. |
| `PHENOMENON_LINKS_UPDATE_REQUESTED` | `PhenomenonLinkUpdate` | Drawer speichert Kalender/Hooks. |
| `PHENOMENON_LINKS_UPDATE_CONFIRMED` | `PhenomenonDTO` | Links erfolgreich gespeichert. |
| `PHENOMENON_DELETE_REQUESTED` | `{ phenomenonId: string }` | Entfernen eines Phänomens. |
| `PHENOMENON_DELETE_CONFIRMED` | `{ phenomenonId: string }` | Erfolgreiches Löschen. |

| `TRAVEL_LEAF_MOUNTED` | `{ travelId: string }` | Travel-Modus gestartet (`handleTravelLeafMounted` lädt Präferenzen). |
| `TRAVEL_MODE_CHANGED` | `{ mode: TravelCalendarMode }` | Travel-Leaf Tab gewechselt; wird persistiert. |
| `TRAVEL_TIME_ADVANCE_REQUESTED` | `AdvanceRequestDTO` | Quick-Action im Travel-Leaf (Minuten/Stunden/Tage). |
| `TRAVEL_QUICK_STEP_APPLIED` | `{ delta: AdvanceRequestDTO }` | Travel-Leaf speichert letzten Quick-Step. |
| `TRAVEL_LEAF_DISMISSED` | `void` | Leaf geschlossen (Nutzer:in oder Hook). |
| `ERROR_OCCURRED` | `UIErrorState & { scope: 'dashboard' | 'manager' | 'travel' }` | Fehlerbanner anzeigen. |
| `ERROR_RESOLVED` | `{ scope: 'dashboard' | 'manager' | 'travel' }` | Fehler zurücksetzen. |

## 4. Transitionstabellen
### 4.1 Almanac-Modus
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `almanacUiState.mode = m` | `ALMANAC_MODE_SELECTED(n)` | `mode = n`, `modeHistory.push(m)` | Persistiere Modus im Gateway, lade Zustand falls nötig |
| `almanacUiState.mode` | `ALMANAC_MODE_RESTORED(snapshot)` | `mode = snapshot.mode`, `statusSummary = snapshot.statusSummary`, `lastZoomByMode = snapshot.lastZoom`, `lastFiltersByMode = snapshot.lastFilters` | Rehydrate UI, trigger Lazy-Load falls Cache leer |
| `almanacUiState.drawerOpen = true` | `ALMANAC_MODE_SELECTED` (mobile) | `drawerOpen = false` | Drawer schließen nach Auswahl |

### 4.2 Events-Modus
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `eventsUiState.viewMode = 'timeline'` | `EVENTS_VIEW_MODE_CHANGED('table')` | `viewMode = 'table'` | Persistiere ViewMode, starte `EVENTS_DATA_REQUESTED` falls Daten fehlen |
| `eventsUiState.filters` | `EVENTS_FILTER_CHANGED(next)` | `filters = next`, `pagination.cursor = null`, `isLoading = true` | Debounced fetch → dispatch `EVENTS_DATA_REQUESTED` |
| `eventsUiState.sort` | `EVENTS_SORT_CHANGED(next)` | `sort = next`, `isLoading = true` | Trigger Datenabruf |
| `isLoading = true` | `EVENTS_DATA_LOADED(batch)` | `isLoading = false`, `pagination = batch.pagination`, `eventsCache = merge` | Aktualisiere `calendarState.upcomingPhenomena`, Telemetrie `events.load_duration` |
| `eventsUiState.selectedPhenomenonId = null` | `PHENOMENON_EDIT_REQUESTED({ phenomenonId })` | `selectedPhenomenonId = phenomenonId`, `editorDraft = loadFromCache` | Öffne Editor, setze Fokus |
| `eventsUiState.editorDraft` | `PHENOMENON_DRAFT_UPDATED(draft)` | `editorDraft = draft` | Kein zusätzlicher Effekt |
| `eventsUiState.isSaving = false` | `PHENOMENON_SAVE_REQUESTED(draft)` | `isSaving = true` | Trigger Persistenz `upsertPhenomenon` |
| `isSaving = true` | `PHENOMENON_SAVE_CONFIRMED(dto)` | `isSaving = false`, `editorDraft = null`, `selectedPhenomenonId = dto.id` | Aktualisiere Cache, Toast, schließe Modal |
| `eventsUiState.linkDrawerOpen = true` | `PHENOMENON_LINKS_UPDATE_CONFIRMED` | `linkDrawerOpen = false` | Aktualisiere `calendarState.upcomingPhenomena` |
| `eventsUiState` | `PHENOMENON_DELETE_CONFIRMED` | Entferne Phänomen aus Cache, `selectedPhenomenonId = null` | Telemetrie `events.delete` |

### 4.3 Kalenderauswahl & Defaults
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `calendarState.activeCalendarId = A` | `CALENDAR_SELECT_REQUESTED(B)` | `pending` Flag | Trigger Persistenz (`Gateway.setActiveCalendar`) |
| `pending` | `CALENDAR_SELECTED(B)` | `activeCalendarId = B`, `currentDate`, `upcomingEvents` aktualisiert | Aktualisiere Cache, lade Events; Telemetrie `calendar.telemetry.active_changed` |
| `defaultCalendarId = A` | `DEFAULT_SET_REQUESTED(B, global)` | `pendingDefault = B` | Gateway Update starten |
| `pendingDefault = B` | `DEFAULT_SET_CONFIRMED` | `defaultCalendarId = B`, `activeCalendarId` ggf. fallback | UI-Badge aktualisieren, Travel-Leaf re-render |
| `travelDefaultCalendarId = A` | `DEFAULT_SET_REQUESTED(B, travel)` | `pendingTravelDefault = B` | Gateway Update starten |
| `pendingTravelDefault` | `DEFAULT_SET_CONFIRMED` | `travelDefaultCalendarId = B` | Travel-Leaf highlight |
| `timeDefinition = old` | `TIME_DEFINITION_UPDATED(newDef)` | `timeDefinition = newDef`, `minuteStep = derive(newDef.minuteStep)` | Normalisiere `currentTimestamp` & `travelLeafState.currentTimestamp`, invalide Caches |

### 4.4 Manager UI
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `viewMode = 'calendar'` | `MANAGER_VIEW_MODE_CHANGED('overview')` | `viewMode = 'overview'` | Persistiere Modus in SessionStorage, lade Übersichtsdaten |
| `zoom = 'month'` | `MANAGER_ZOOM_CHANGED('week')` | `zoom = 'week'` | Re-request Range/Events (`Gateway.fetchEventsForRange`) |
| `filters` | `MANAGER_FILTER_CHANGED(next)` | `filters = next` | Debounced fetch, Telemetrie `calendar.telemetry.filter_applied` |
| `form.currentDialog = null` | `EVENT_FORM_OPENED(mode)` | `form.currentDialog = 'event'`, `dialogData = mode` | Fokus setzen, Prefill | 
| `form.currentDialog = 'event'` | `EVENT_SAVE_CONFIRMED` | `form.currentDialog = null` | Toast, Liste aktualisieren |

### 4.5 Zeitfortschritt
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `currentTimestamp = T`, `pendingTimeSlice = S` | `TIME_SLICE_PRESET_CHANGED(preset)` | `pendingTimeSlice = preset` | Speichere in `managerUiState.timeControls`, Telemetrie `calendar.telemetry.slice_changed` |
| `currentTimestamp = T` | `TIME_ADVANCE_REQUESTED(delta)` | `isLoading = true`, `calendarState.lastAdvanceStep = delta` | Call `Gateway.advanceTime`, Travel-Leaf Loading |
| `isLoading = true` | `TIME_ADVANCE_CONFIRMED(result)` | `currentTimestamp = result.newTimestamp`, `triggeredEvents = result.triggered`, `skippedEvents = result.skipped` | Append Log (inkl. Minuten), Travel-Leaf refresh, Hooks dispatch |
| `currentTimestamp = T` | `TIME_JUMP_REQUESTED` | `isLoading = true` | Call `Gateway.setDateTime` |
| `isLoading = true` | `TIME_JUMP_CONFIRMED(result)` | `currentTimestamp = result.timestamp`, `skippedEvents = result.skipped`, `normalizationWarnings = result.warnings` | Zeige Dialog-Result, Travel-Leaf update |
| `travelLeafState.visible = true` | `TRAVEL_TIME_ADVANCE_REQUESTED(delta)` | `travelLeafState.isLoading = true`, `travelLeafState.lastQuickStep = delta` | Gateway Advance mit `scope: travel` (`handleTimeAdvance`)|
| `travelLeafState.visible = true` | `TRAVEL_QUICK_STEP_APPLIED(delta)` | `travelLeafState.lastQuickStep = delta` | UI-Badge „zuletzt: ±X“ aktualisieren |
| `travelLeafState.isLoading = true` | `TIME_ADVANCE_CONFIRMED` | `travelLeafState.isLoading = false`, `events` aktualisiert, `currentTimestamp = result.newTimestamp` | Leaf UI refresh |

### 4.6 Travel Leaf Lifecycle {#cartographer-travel-leaf}
| Vorher | Event | Nachher | Aktionen |
| --- | --- | --- | --- |
| `visible = false` | `TRAVEL_LEAF_MOUNTED(travelId)` | `visible = true`, `mode = storedMode || 'upcoming'`, `isLoading = true` | Lade Daten (`handleTravelLeafMounted`) |
| `visible = true` | `TRAVEL_MODE_CHANGED(mode)` | `mode = mode` | Persistiere Mode im Gateway (per-travel) |
| `visible = true` | `TRAVEL_LEAF_DISMISSED` | `visible = false` | Persistiere Sichtbarkeit, Telemetrie `calendar.travel.leaf_closed` |

## 5. Ablaufdiagramme {#ablaufdiagramme}
### 5.1 Almanac-Moduswechsel
`Start → ALMANAC_MODE_SELECTED → Persistiere Modus → (Daten bereits geladen?) → [Ja] Zustand wiederherstellen → Ende / [Nein] EVENTS_DATA_REQUESTED (falls Ziel = Events) → Daten laden → Ende`

### 5.2 Events-Daten laden
`Start → EVENTS_FILTER_CHANGED/EVENTS_VIEW_MODE_CHANGED → isLoading = true → EVENTS_DATA_REQUESTED → Gateway.fetchPhenomena → (Erfolg?) → [Ja] EVENTS_DATA_LOADED → Cache aktualisieren → Ende / [Nein] ERROR_OCCURRED(scope=events)`

### 5.3 Default setzen
`Start → DEFAULT_SET_REQUESTED → Gateway.updateDefault → (Erfolg?) → [Ja] DEFAULT_SET_CONFIRMED → Update State/Broadcast → Ende / [Nein] ERROR_OCCURRED(scope=manager)`

### 5.4 Manager Moduswechsel
`Start → MANAGER_VIEW_MODE_CHANGED → Update viewMode → (Mode == 'calendar'?) → [Ja] ensure zoom data loaded → Ende / [Nein] load overview data → Ende`

### 5.5 Travel-Leaf Advance
`Start → TRAVEL_TIME_ADVANCE_REQUESTED → travelLeafState.isLoading = true → Gateway.advanceTime(scope=travel) → (Erfolg?) → [Ja] TIME_ADVANCE_CONFIRMED → Update travelLeafState, calendarState → Ende / [Nein] ERROR_OCCURRED(scope=travel)`

### 5.6 Quick-Step anpassen
`Start → TIME_SLICE_PRESET_CHANGED(scope, preset) → Update managerUiState.timeControls → persistTimePreset → Ende`

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
| `advanceTime` | `TIME_ADVANCE_REQUESTED`, `TRAVEL_TIME_ADVANCE_REQUESTED` | Führt Advance (Minuten/Stunden/Tage) aus, löst Hooks (`CartographerHookGateway`) aus. |
| `setDate` | `TIME_JUMP_REQUESTED` | Setzt Datum/Uhrzeit + Konfliktliste. |
| `persistTimePreset` | `TIME_SLICE_PRESET_CHANGED` | Speichert Quick-Step-Präferenz (`managerUiState.timeControls`) im Gateway (Scope global/travel). |
| `normalizeTimestamp` | `TIME_DEFINITION_UPDATED` | Berechnet neue Zeitbasis, passt `currentTimestamp`, `pendingEvents` an. |
| `syncTravelTimestamp` | `TIME_ADVANCE_CONFIRMED`, `TIME_JUMP_CONFIRMED` | Überträgt neue Zeitpunkte an Travel-Leaf und Cartographer. |
| `mountTravelLeaf` | `TRAVEL_LEAF_MOUNTED` | Öffnet Leaf, lädt Daten, registriert Telemetrie. |
| `unmountTravelLeaf` | `TRAVEL_LEAF_DISMISSED` | Persistiert Off-State, deregistriert Listener. |
| `logTelemetry` | Diverse (Default, ModeChange, TravelMount) | Sendet `calendar.telemetry.*` (siehe [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md#telemetrie--observability)). |

## 7. Fehlerbehandlung
- Jeder Effekt fangt Fehler und dispatcht `ERROR_OCCURRED` mit Scope.
- Presenter bietet `retryEffect(scope)` → triggert letzten Effekt erneut (z.B. `loadCalendarData`).
- Bei `ERROR_OCCURRED` werden Loading-Flags zurückgesetzt, Dialoge geschlossen.

## 8. Persistenznotizen
- `defaultCalendarId`, `travelDefaultCalendarId`, `travelLeafState.mode`, `travelLeafState.visible`, `almanacUiState.mode` werden im Gateway persistiert (Vault + Reise-spezifisch).
- Travel-Leaf-Präferenzen (inkl. `lastViewedTimestamp`) werden über `persistTravelLeafPreferences` pro Travel-ID gespeichert.
- `managerUiState.viewMode` optional in `localStorage` (User-Preference).
- `eventsUiState.viewMode`, `eventsUiState.filters`, `eventsUiState.sort` werden im Gateway gespeichert (pro Vault) um Rückkehrpunkte zu ermöglichen.

## 9. Verweise
- UX-Flows: [UX_SPEC.md §3](./UX_SPEC.md#3-workflows)
- Komponenten: [COMPONENTS.md](./COMPONENTS.md)
- API: [API_CONTRACTS.md](./API_CONTRACTS.md)
- Tests: [../../tests/apps/almanac/TEST_PLAN.md](../../../tests/apps/almanac/TEST_PLAN.md)
