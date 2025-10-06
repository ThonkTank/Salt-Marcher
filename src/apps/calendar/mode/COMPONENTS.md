# Calendar Workmode – Komponenten
Dieses Dokument beschreibt UI-Komponenten für den Calendar-Workmode. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [WIREFRAMES.md](./WIREFRAMES.md) und die State-Definitionen in [STATE_MACHINE.md](./STATE_MACHINE.md).

## 1. Übersicht
- Alle Komponenten sind in `src/apps/calendar/mode/components` zu platzieren.
- Styling erfolgt primär über bestehende Tokens aus `src/ui/tokens` und Utility-Klassen (`ui/Flex`, `ui/Grid`).
- Props werden mit `Readonly`-Interfaces versehen; Events folgen dem Muster `on<Event>` und liefern Domain-DTOs aus [API_CONTRACTS.md](./API_CONTRACTS.md).

## 2. Calendar UI Komponenten {#calendar-ui-komponenten}
### 2.1 `CalendarDashboard`
- **Responsibility**: Container des Dashboard-Leaves inkl. Toolbar, Datumskarte, Upcoming-Liste, Filter, Log.
- **Props**
  ```ts
  interface CalendarDashboardProps {
    activeCalendar?: CalendarSummaryDTO;
    currentDate: CalendarDateDTO;
    upcomingEvents: ReadonlyArray<CalendarUpcomingEventDTO>;
    filters: CalendarEventFilterState;
    logEntries: ReadonlyArray<CalendarLogEntryDTO>;
    isLoading: boolean;
    onSelectCalendar: () => void;
    onOpenManager: () => void;
    onManageEvents: () => void;
    onAdvance: (payload: AdvanceRequestDTO) => void;
    onSetDate: () => void;
    onFilterChange: (next: CalendarEventFilterState) => void;
  }
  ```
- **Events/Callbacks**: siehe Props; `onAdvance` dispatcht `TIME_ADVANCE_REQUESTED` (vgl. [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)).
- **Interner Zustand**: UI-Only (z.B. Expanded Panels).
- **Styling**: Layout via `Flex`/`Grid`, Quick-Action-Buttons nutzen `PrimaryButton`/`SecondaryButton` aus `src/ui`.
- **Fehler/Leer**: Wenn `activeCalendar` fehlt → `EmptyState`-Slot (siehe [UX_SPEC §4](./UX_SPEC.md#4-fehler-und-leerstaaten)).

### 2.2 `CalendarManagerHeader`
- **Responsibility**: Headerleiste des Manager-Leaves (Zurück, Tabs, Aktionen, Zoom-Toolbar).
- **Props**
  ```ts
  interface CalendarManagerHeaderProps {
    viewMode: CalendarManagerViewMode; // 'calendar' | 'overview'
    zoom: CalendarViewZoom; // 'month' | 'week' | 'day'
    canZoom: boolean;
    isTravelContext: boolean;
    onBack: () => void;
    onViewModeChange: (mode: CalendarManagerViewMode) => void;
    onZoomChange: (zoom: CalendarViewZoom) => void;
    onCreateCalendar: () => void;
    onImportCalendar: () => void;
    onDefaultAction: () => void;
  }
  ```
- **Events**: dispatchen `MANAGER_VIEW_MODE_CHANGED`, `MANAGER_ZOOM_CHANGED`.
- **Styling**: Sticky Header, Buttons mit Icon+Label; unter 520px Icon-only.
- **Accessibility**: Tabs als `role="tablist"`, Buttons mit `aria-keyshortcuts` (siehe [UX_SPEC §5](./UX_SPEC.md#5-accessibility--i18n)).

### 2.3 `CalendarGridView`
- **Responsibility**: Visualisiert Monat/Woche/Tag gemäß Zoom, inkl. Inline-Interaktion.
- **Props**
  ```ts
  interface CalendarGridViewProps {
    zoom: CalendarViewZoom;
    range: CalendarRangeDTO; // Start/End inkl. Schema-Infos
    events: ReadonlyArray<CalendarGridEventDTO>;
    localeSchema: CalendarSchemaDTO;
    selection?: CalendarGridSelection;
    onNavigate: (direction: 'prev' | 'next' | 'today') => void;
    onDatePick: (target: CalendarDateDTO) => void;
    onCreateInline: (target: CalendarDateDTO) => void;
    onSelectEvent: (eventId: string) => void;
    onHoverEvent?: (eventId: string | null) => void;
  }
  ```
- **Events**: `onCreateInline` → öffnet Event-Dialog; `onSelectEvent` dispatcht `EVENT_SELECTED`.
- **Interner Zustand**: Drag-Selection (nur UI, optional), Hover.
- **Styling**: Verwendung `Grid`-Layout, Multi-day Events stapeln per `position: relative`; Schema-spezifische Labels (z.B. 10-Tage-Woche) aus Props.
- **Fehler/Leer**: Wenn `events` leer → Textoverlay „Keine Ereignisse“. Ladefehler via `ErrorBoundary`-Slot.

### 2.4 `CalendarEventPopover`
- **Responsibility**: Kontextmenü für Ereignisse in Grid/Woche/Tag.
- **Props**
  ```ts
  interface CalendarEventPopoverProps {
    event: CalendarEventSummaryDTO;
    anchorRect: DOMRect;
    isDefaultCalendar: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onMarkDefault: (calendarId: string) => void;
    onClose: () => void;
  }
  ```
- **Events**: `onMarkDefault` nur sichtbar, wenn Nutzer:in Default ändern darf.
- **Styling**: `Popover` aus `src/ui`, Buttons im Footer.

### 2.5 `CalendarOverviewList`
- **Responsibility**: Listen-/Kachelansicht der Kalender inkl. Filter, Bulk-Actions.
- **Props**
  ```ts
  interface CalendarOverviewListProps {
    calendars: ReadonlyArray<CalendarOverviewItemDTO>;
    filters: CalendarOverviewFilterState;
    selection: ReadonlySet<string>;
    layout: 'grid' | 'list';
    isLoading: boolean;
    onFilterChange: (next: CalendarOverviewFilterState) => void;
    onSelectionChange: (ids: ReadonlySet<string>) => void;
    onOpenCalendar: (id: string) => void;
    onEditCalendar: (id: string) => void;
    onDeleteCalendars: (ids: ReadonlyArray<string>) => void;
    onSetDefault: (id: string) => void;
    onImportToEditor: (id: string) => void;
  }
  ```
- **Events**: Bulk-Löschen, Default-Setzen, Import → dispatchen entsprechende STATE_MACHINE-Events.
- **Styling**: Responsive Breakpoints (Grid zu 1 Spalte <640px). Badges `Default`/`Reise`.
- **Fehler/Leer**: Props `isLoading` + `calendars.length===0` → `EmptyState` (Hero). Fehler-Banner per Slot.

### 2.6 `CalendarFormDialog`
- **Responsibility**: Formular zum Erstellen/Bearbeiten eines Kalenders (Tabs, Validierung, Vorschau).
- **Props**
  ```ts
  interface CalendarFormDialogProps {
    mode: 'create' | 'edit';
    initialValue?: CalendarSchemaFormState;
    isDefaultGlobal: boolean;
    isTravelContext: boolean;
    isSaving: boolean;
    errors: Partial<Record<keyof CalendarSchemaFormState, string>>;
    onSubmit: (value: CalendarSchemaFormState) => void;
    onCancel: () => void;
    onToggleDefaultGlobal: (next: boolean) => void;
    onToggleDefaultTravel?: (next: boolean) => void;
  }
  ```
- **Interner Zustand**: Tab-Index, Vorschau-Scroll.
- **Styling**: Modal über `ui/Modal`, Tabs `ui/Tabs`.
- **Fehler/Leer**: Validierungsfehler inline; bei Laden `Skeleton`.

### 2.7 `EventFormDialog`
- **Responsibility**: Formular für einmalige/wiederkehrende Ereignisse.
- **Props**
  ```ts
  interface EventFormDialogProps {
    mode: 'single' | 'recurring';
    initialValue?: CalendarEventFormState;
    schema: CalendarSchemaDTO;
    isSaving: boolean;
    preview: ReadonlyArray<CalendarDateDTO>;
    errors: CalendarEventFormErrors;
    onSubmit: (value: CalendarEventFormState) => void;
    onCancel: () => void;
    onValidateCustomRule?: (input: string) => ValidationResult;
  }
  ```
- **Events**: `onSubmit` dispatcht `EVENT_SAVE_REQUESTED`; `onValidateCustomRule` optional async.
- **Styling**: `ui/Form`, `ui/SegmentedControl` für Modus, `ui/CodeEditor` für Custom-Hooks.

### 2.8 `TimeAdvanceDialog`
- **Responsibility**: Dialog für benutzerdefinierten Zeitfortschritt/Datumssprung.
- **Props**
  ```ts
  interface TimeAdvanceDialogProps {
    mode: 'advance' | 'jump';
    currentDate: CalendarDateDTO;
    schema: CalendarSchemaDTO;
    pendingEvents: ReadonlyArray<CalendarEventSummaryDTO>;
    isApplying: boolean;
    onConfirm: (payload: AdvanceRequestDTO | JumpRequestDTO) => void;
    onCancel: () => void;
  }
  ```
- **Fehler**: Wenn `pendingEvents` > 50 → Hinweis „Viele Ereignisse“.

### 2.9 `CalendarEventLog`
- **Responsibility**: Zeigt ausgelöste/übersprungene Ereignisse.
- **Props**
  ```ts
  interface CalendarEventLogProps {
    entries: ReadonlyArray<CalendarLogEntryDTO>;
    scope: 'dashboard' | 'travel';
    onFollowUp?: (entryId: string) => void;
  }
  ```
- **Styling**: `ui/List`, farbliche Badges pro Event-Typ.

### 2.10 `TravelCalendarLeaf`
- **Responsibility**: Kompaktes Leaf im Reisemodus (Monat/Woche/Tag/Nächste).
- **Props**
  ```ts
  interface TravelCalendarLeafProps {
    mode: TravelCalendarMode; // 'month' | 'week' | 'day' | 'upcoming'
    visible: boolean;
    activeCalendar?: CalendarSummaryDTO;
    date: CalendarDateDTO;
    range: CalendarRangeDTO;
    events: ReadonlyArray<CalendarTravelEventDTO>;
    skippedEvents: ReadonlyArray<CalendarEventSummaryDTO>;
    isLoading: boolean;
    onModeChange: (mode: TravelCalendarMode) => void;
    onAdvance: (payload: AdvanceRequestDTO) => void;
    onJump: () => void;
    onClose: () => void;
    onFollowUp: (eventId: string) => void;
  }
  ```
- **Events**: `onAdvance` dispatcht `TRAVEL_TIME_ADVANCE_REQUESTED`; `onModeChange` → `TRAVEL_MODE_CHANGED`.
- **Styling**: Pane-Breite 320-360px; Buttons icon-only bei <320px.
- **Fehler/Leer**: Zeigt Banner/EmptyState analog [UX_SPEC §4](./UX_SPEC.md#4-fehler-und-leerstaaten).

### 2.11 `TravelCalendarToolbar`
- **Responsibility**: Toolbar innerhalb des Travel-Leafs.
- **Props**
  ```ts
  interface TravelCalendarToolbarProps {
    mode: TravelCalendarMode;
    canStepBackward: boolean;
    canStepForward: boolean;
    onChangeMode: (mode: TravelCalendarMode) => void;
    onStepBackward: () => void;
    onStepForward: () => void;
    onJump: () => void;
    onClose: () => void;
  }
  ```
- **Accessibility**: Buttons mit `aria-keyshortcuts` (`Ctrl+Alt+Shift+1..4`).

### 2.12 `DefaultBadge`
- **Responsibility**: Kennzeichnet Default-Kalender in Listen/Dropdowns.
- **Props**
  ```ts
  interface DefaultBadgeProps {
    scope: 'global' | 'travel';
    label?: string; // optional override via i18n
  }
  ```
- **Styling**: `Badge` aus `src/ui`, Farbe `--color-accent` für global, `--color-secondary` für Reise.

## 3. Komposition
Textuelles Diagramm (→ inkludiert/enthält):
```
CalendarDashboard
 ├─ CalendarDashboardToolbar (Teil von Header, reuse ui/ButtonGroup)
 ├─ CurrentDateCard
 ├─ UpcomingEventsList
 ├─ EventFilterPanel
 └─ CalendarEventLog

CalendarManagerView
 ├─ CalendarManagerHeader
 ├─ (viewMode === 'calendar') CalendarGridView
 │    └─ CalendarEventPopover (on demand)
 └─ (viewMode === 'overview') CalendarOverviewList

CalendarDialogs
 ├─ CalendarFormDialog (nutzt CalendarPreview, DefaultBadge)
 ├─ EventFormDialog
 └─ TimeAdvanceDialog

TravelCalendarLeaf
 ├─ TravelCalendarToolbar
 ├─ TravelCalendarModeView (intern: MonthGrid | WeekList | DayTimeline | UpcomingList)
 └─ CalendarEventLog (scope='travel')
```

## 4. Fehler- & Leerstaat-Slots
- Alle Hauptcontainer (`CalendarDashboard`, `CalendarGridView`, `CalendarOverviewList`, `TravelCalendarLeaf`) besitzen Props `error?: UIErrorState` und `emptyState?: UIEmptyStateConfig` (siehe unten) zur Konsistenz.
  ```ts
  interface UIErrorState {
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }
  interface UIEmptyStateConfig {
    icon?: string;
    title: string;
    description?: string;
    primaryAction?: { label: string; onAction: () => void };
    secondaryAction?: { label: string; onAction: () => void };
  }
  ```
- Travel-spezifische Banner erhalten `scope: 'travel'` für Telemetrie (siehe [STATE_MACHINE.md](./STATE_MACHINE.md#effekte)).

## 5. Persistenz-Touchpoints
- Komponenten selbst speichern nichts; Events rufen Presenter-Logik, die Gateways aus [API_CONTRACTS.md](./API_CONTRACTS.md) verwendet.
- Default-Toggle in `CalendarFormDialog`/`CalendarOverviewList` ruft `CalendarRepository.updateDefault` über Presenter.

## 6. Verweise
- State-Events: [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)
- API-DTOs: [API_CONTRACTS.md](./API_CONTRACTS.md#dtos)
- Testszenarien: [../../tests/apps/calendar/TEST_PLAN.md](../../../tests/apps/calendar/TEST_PLAN.md)
