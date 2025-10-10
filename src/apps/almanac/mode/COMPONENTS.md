# Almanac Workmode – Komponenten
Dieses Dokument beschreibt UI-Komponenten für den Almanac-Workmode. Es ergänzt [UX_SPEC.md](./UX_SPEC.md), [WIREFRAMES.md](./WIREFRAMES.md) und die State-Definitionen in [STATE_MACHINE.md](./STATE_MACHINE.md).

## 1. Übersicht

> **Hinweis:** Das Almanac-Frontend wurde vollständig entfernt. Die folgenden Abschnitte dokumentieren den vorherigen Stand und dienen nur noch als Archiv.

- Alle Komponenten waren in `src/apps/almanac/mode/components` vorgesehen.
- Styling erfolgte primär über bestehende Tokens aus `src/ui/tokens` und Utility-Klassen (`ui/Flex`, `ui/Grid`).
- Props wurden mit `Readonly`-Interfaces versehen; Events folgten dem Muster `on<Event>` und lieferten Domain-DTOs aus [API_CONTRACTS.md](./API_CONTRACTS.md).

### 1.1 Layer & Prefix-Naming
| Layer | Präfix | Inhalt | Notizen |
| --- | --- | --- | --- |
| Shell | `almanac` | `AlmanacShell`, Switcher, Statusleiste | Kapselt ausschließlich `Almanac › Dashboard/Manager/Events`; bietet Travel-Indikator. |
| Mode | `dashboard`, `manager`, `events` | Bildschirm-spezifische Container und Editor-Komponenten | Jede Mode-Komponente konsumiert Domain-DTOs, keine direkten Repository-Aufrufe. |
| Shared | `calendar`, `event`, `phenomenon` | Tabellen, Filter, Dialoge, Rule-Editoren | Wiederverwendbar zwischen Modi. |
| Travel (Cartographer) | `travel` | Kompakte Leaf-Komponenten für Reisemodus | Wird von `apps/cartographer/travel` gemountet; nutzt gemeinsame DTOs. |

- Alle Komponenten exportieren zusätzlich `displayName` für Debugging (`AlmanacShell.displayName = 'AlmanacShell'`).
- Cross-Layer-Komposition erfolgt nur top-down (Shell → Mode → Shared). Travel importiert ausschließlich Shared-Komponenten und eigene Travel-spezifische Wrapper.

## 2. Shell-Layer {#almanac-komponenten}

### 2.1 Split-View-Layout (**NEU**)
Ab der aktuellen Version nutzt Almanac ein Split-View-Layout mit zwei Hauptbereichen:

#### 2.1.1 `CalendarViewContainer` (Oberer Bereich)
- **Responsibility**: Persistente Kalenderansicht mit 4 Modi (Monat/Woche/Tag/Nächste Events)
- **Location**: `src/apps/almanac/mode/components/calendar-view-container.ts`
- **Verwendet**: Shared `createTabNavigation()` aus `ui/workmode`
- **Props**:
  ```ts
  interface CalendarViewContainerConfig {
    readonly state: CalendarViewState;
    readonly onModeChange: (mode: CalendarViewMode) => void;
    readonly onNavigate: (direction: 'prev' | 'next' | 'today') => void;
    readonly onEventSelect: (eventId: string) => void;
  }
  ```
- **Enthält**: Tab-Navigation, Kalender-Grid/Timeline/Liste, Navigation-Controls

#### 2.1.2 `AlmanacContentContainer` (Unterer Bereich)
- **Responsibility**: Tabbed Content-Bereich für Dashboard/Events/Manager
- **Location**: `src/apps/almanac/mode/components/almanac-content-container.ts`
- **Verwendet**: Shared `createTabNavigation()` aus `ui/workmode`
- **Props**:
  ```ts
  interface AlmanacContentContainerConfig {
    readonly mode: AlmanacMode; // 'dashboard' | 'events' | 'manager'
    readonly onModeChange: (mode: AlmanacMode) => void;
  }
  ```
- **Enthält**: Tab-Navigation, Container-Elemente für jeden Modus (`getSection(mode)` liefert das Host-Element)

#### 2.1.3 Shared UI Infrastructure
Die Split-View-Komponenten nutzen wiederverwendbare UI-Komponenten aus `src/ui/workmode`:
- `createTabNavigation()` - Tab-Navigation mit Keyboard-Support
- `createSplitView()` - Resizable Split-Container
- `BaseModeRenderer` - Basis-Renderer-Pattern
- `WatcherHub` - Generischer File-Watcher-Hub

### 2.2 `AlmanacShell` (Legacy/Deprecated)
- **Responsibility**: Parent-Layout für `Almanac › Dashboard`, `Almanac › Manager`, `Almanac › Events` inkl. Mode-Persistenz, Statusleiste und Travel-Status-Indikator.
- **Note**: Diese Komponente wird durch das neue Split-View-Layout ersetzt.
- **Props**
  ```ts
  interface AlmanacShellProps {
    activeMode: AlmanacMode; // 'dashboard' | 'manager' | 'events'
    modeOptions: ReadonlyArray<{ mode: AlmanacMode; label: string; badgeCount?: number; icon: string }>;
    statusSummary?: AlmanacStatusSummary; // z.B. { zoomLabel: string; filterCount: number }
    isLoading: boolean;
    onSelectMode: (mode: AlmanacMode) => void;
    onOpenSettings: () => void;
    travelStatus: TravelPresenceSummary; // { isActive: boolean; label: string }
    onOpenTravelLeaf: () => void;
    children: React.ReactNode;
  }
  interface TravelPresenceSummary {
    isActive: boolean;
    hasPendingFollowUps: boolean;
    label: string; // i18n z.B. "Reise aktiv"
  }
  ```
- **Events**: `onSelectMode` dispatcht `ALMANAC_MODE_SELECTED` (siehe [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)).
- **Interner Zustand**: Fokus-Management (lastFocusedElement), Drawer-Visibility für Mobile.
- **Styling**: Container nutzt `ui/SplitPane` (Sidebar + Content); Statusleiste `ui/Badge` für Filtercount; Travel-Indikator als `ui/Pill` rechtsbündig.
- **Fehler/Leer**: Slot `errorFallback` (Banner) und `emptyState` (CTA „Kalender anlegen“ / „Phänomen hinzufügen“).

### 2.2 `AlmanacModeSwitcher`
- **Responsibility**: Sidebar/Dropdown zur Moduswahl mit Tastaturnavigation.
- **Props**
  ```ts
  interface AlmanacModeSwitcherProps {
    modes: ReadonlyArray<{ mode: AlmanacMode; label: string; description: string; hotkey?: string; disabled?: boolean; badgeCount?: number }>;
    activeMode: AlmanacMode;
    layout: 'sidebar' | 'dropdown';
    onSelect: (mode: AlmanacMode) => void;
  }
  ```
- **Events**: `onSelect` → `ALMANAC_MODE_SELECTED`.
- **Styling**: Sidebar nutzt `ui/NavList`, Dropdown `ui/Menu`; aktive Einträge mit Accent-Border.
- **Accessibility**: `role="tablist"` im Sidebar-Modus, `aria-activedescendant` für Screenreader.

## 3. Mode-Komponenten – Almanac {#calendar-ui-komponenten}
### 3.1 Almanac › Dashboard
#### 3.1.1 `CalendarDashboard`
- **Responsibility**: Container des Dashboard-Leaves inkl. Toolbar, Datumskarte, Upcoming-Liste, Filter, Log.
- **Props**
  ```ts
  interface CalendarDashboardProps {
    activeCalendar?: CalendarSummaryDTO;
    currentTimestamp: CalendarTimestampDTO;
    timeDefinition: TimeDefinitionDTO;
    upcomingEvents: ReadonlyArray<CalendarUpcomingEventDTO>;
    filters: CalendarEventFilterState;
    logEntries: ReadonlyArray<CalendarLogEntryDTO>;
    isLoading: boolean;
    onSelectCalendar: () => void;
    onOpenManager: () => void;
    onManageEvents: () => void;
    onAdvance: (payload: AdvanceRequestDTO) => void;
    onSetDateTime: () => void;
    onFilterChange: (next: CalendarEventFilterState) => void;
  }
  ```
- **Events/Callbacks**: siehe Props; `onAdvance` dispatcht `TIME_ADVANCE_REQUESTED` (vgl. [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)).
- **Interner Zustand**: UI-Only (z.B. Expanded Panels).
- **Styling**: Layout via `Flex`/`Grid`, Quick-Action-Buttons nutzen `PrimaryButton`/`SecondaryButton` aus `src/ui`; Sub-Day-Actions gruppiert als `ButtonGroup`.
- **Fehler/Leer**: Wenn `activeCalendar` fehlt → `EmptyState`-Slot (siehe [UX_SPEC §4](./UX_SPEC.md#4-fehler-und-leerstaaten)).

### 3.2 Almanac › Manager
#### 3.2.1 `CalendarManagerHeader`
- **Responsibility**: Headerleiste des Manager-Leaves (Zurück, Tabs, Aktionen).
- **Props**
  ```ts
  interface CalendarManagerHeaderProps {
    viewMode: CalendarManagerViewMode; // 'calendar' | 'overview'
    isTravelContext: boolean;
    onBack: () => void;
    onViewModeChange: (mode: CalendarManagerViewMode) => void;
    onCreateCalendar: () => void;
    onImportCalendar: () => void;
    onDefaultAction: () => void;
  }
  ```
- **Events**: dispatchen `MANAGER_VIEW_MODE_CHANGED`.
- **Styling**: Sticky Header, Buttons mit Icon+Label; unter 520px Icon-only.
- **Accessibility**: Tabs als `role="tablist"`, Buttons mit `aria-keyshortcuts` (siehe [UX_SPEC §5](./UX_SPEC.md#5-accessibility--i18n)).

#### 3.2.2 `CalendarGridView`
- **Responsibility**: Visualisiert Monat/Woche/Tag gemäß Zoom, inkl. Inline-Interaktion.
- **Props**
  ```ts
  interface CalendarGridViewProps {
    zoom: CalendarViewZoom;
    range: CalendarRangeDTO; // Start/End inkl. Zeitfenster
    events: ReadonlyArray<CalendarGridEventDTO>;
    localeSchema: CalendarSchemaDTO;
    hoursPerDay: number;
    timeDefinition: TimeDefinitionDTO;
    minuteStep: number;
    selection?: CalendarGridSelection;
    onNavigate: (direction: 'prev' | 'next' | 'today') => void;
    onDatePick: (target: CalendarTimestampDTO) => void;
    onCreateInline: (target: CalendarTimestampDTO) => void;
    onSelectEvent: (eventId: string) => void;
    onHoverEvent?: (eventId: string | null) => void;
  }
  ```
- **Events**: `onCreateInline` → öffnet Event-Dialog mit Timestamp; `onSelectEvent` dispatcht `EVENT_SELECTED`.
- **Interner Zustand**: Drag-Selection (nur UI, optional), Hover.
- **Styling**: Verwendung `Grid`-Layout, Multi-day Events stapeln per `position: relative`; Stunden-/Minutenraster anhand `hoursPerDay` und `minuteStep`, Schema-spezifische Labels (z.B. 10-Tage-Woche) aus Props.
- **Fehler/Leer**: Wenn `events` leer → Textoverlay „Keine Ereignisse“. Ladefehler via `ErrorBoundary`-Slot.

#### 3.2.3 `CalendarEventPopover`
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

#### 3.2.4 `CalendarOverviewList`
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

## 5. Shared Komponenten {#shared-komponenten}
### 5.1 `CalendarFormDialog`
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

### 5.2 `EventFormDialog`
- **Responsibility**: Formular für einmalige/wiederkehrende Ereignisse.
- **Props**
  ```ts
  interface EventFormDialogProps {
    mode: 'single' | 'recurring';
    initialValue?: CalendarEventFormState;
    schema: CalendarSchemaDTO;
    isSaving: boolean;
    preview: ReadonlyArray<CalendarTimestampDTO>;
    errors: CalendarEventFormErrors;
    onSubmit: (value: CalendarEventFormState) => void;
    onCancel: () => void;
    onValidateCustomRule?: (input: string) => ValidationResult;
  }
  ```
- **Events**: `onSubmit` dispatcht `EVENT_SAVE_REQUESTED`; `onValidateCustomRule` optional async.
- **Styling**: `ui/Form`, `ui/SegmentedControl` für Modus, `ui/CodeEditor` für Custom-Hooks`; Zeitfelder nutzen `CalendarTimePicker` (siehe §5.7) und `DurationInput`.

### 5.3 `TimeAdvanceDialog`
- **Responsibility**: Dialog für benutzerdefinierten Zeitfortschritt/Datumssprung.
- **Props**
  ```ts
  interface TimeAdvanceDialogProps {
    mode: 'advance' | 'jump';
    currentTimestamp: CalendarTimestampDTO;
    schema: CalendarSchemaDTO;
    pendingEvents: ReadonlyArray<CalendarEventSummaryDTO>;
    isApplying: boolean;
    onConfirm: (payload: AdvanceRequestDTO | JumpRequestDTO) => void;
    onCancel: () => void;
  }
  ```
- **Fehler**: Wenn `pendingEvents` > 50 → Hinweis „Viele Ereignisse“; wenn Zielzeit außerhalb `hoursPerDay` → Inline-Error.

### 5.4 `CalendarEventLog`
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

### 5.5 `DefaultBadge`
- **Responsibility**: Kennzeichnet Default-Kalender in Listen/Dropdowns.
- **Props**
  ```ts
  interface DefaultBadgeProps {
    scope: 'global' | 'travel';
    label?: string; // optional override via i18n
  }
  ```
- **Styling**: `Badge` aus `src/ui`, Farbe `--color-accent` für global, `--color-secondary` für Reise.

### 5.6 `CurrentTimestampCard`
- **Responsibility**: Zeigt aktuelles Datum/Uhrzeit inklusive Schema-Infos und Quick-Steps im Dashboard.
- **Props**
  ```ts
  interface CurrentTimestampCardProps {
    timestamp: CalendarTimestampDTO;
    calendarName?: string;
    timeDefinition: { hoursPerDay: number; minutesPerHour: number; minuteStep: number };
    disabled?: boolean;
    onAdvanceQuick: (payload: AdvanceRequestDTO) => void;
    onOpenSetDateTime: () => void;
  }
  ```
- **Styling**: Card mit `ui/Card`, sekundäre Actions als `ButtonGroup`. Zeitformat nutzt Formatter aus Domain.
- **Fehler/Leer**: Wenn `disabled`, zeigt Hinweis „Kein aktiver Kalender“.

### 5.7 `CalendarTimePicker`
- **Responsibility**: Schema-spezifische Zeitwahl für Stunden/Minuten (optional Sekunden).
- **Props**
  ```ts
  interface CalendarTimePickerProps {
    value: { hour: number; minute: number; second?: number };
    hoursPerDay: number;
    minutesPerHour: number;
    minuteStep: number;
    secondsPerMinute?: number;
    precision: 'minute' | 'second';
    disabled?: boolean;
    onChange: (value: { hour: number; minute: number; second?: number }) => void;
    onBlur?: () => void;
  }
  ```
- **Styling**: `ui/NumberInput` kombiniert mit `Dropdown` für Minuten; Pfeiltasten + Mousewheel unterstützen Step `minuteStep`.
- **Fehler**: Anzeige roter Umrandung + `aria-live` Hinweis „Zeit außerhalb 0–{hoursPerDay-1}“.

### 5.8 `DurationInput`
- **Responsibility**: Konvertiert Dauerangaben (Minuten) in formularfreundliche Eingabe (z.B. Stunden + Minuten).
- **Props**
  ```ts
  interface DurationInputProps {
    valueMinutes: number;
    minuteStep: number;
    maxMinutes?: number;
    onChange: (minutes: number) => void;
  }
  ```
- **Styling**: Zwei `NumberInput`-Felder (Stunden/Minuten) mit Suffix-Labels, validiert gegen `maxMinutes`.
- **Fehler**: Tooltip „Dauer überschreitet Tageslänge“.

### 5.9 `TravelQuickStepGroup`
- **Responsibility**: Rendert Quick-Step-Buttons (Tag/Stunde/Minute) im Travel-Leaf. Implementiert in [`travel/travel-quick-step-group.ts`](./travel/travel-quick-step-group.ts).
- **Props**
  ```ts
  interface TravelQuickStepGroupProps {
    minuteStep: number;
    disabled?: boolean;
    onAdvance: (payload: AdvanceRequestDTO) => void;
    lastStep?: { label: string; delta: AdvanceRequestDTO };
  }
  ```
- **Styling**: `ButtonGroup` mit IconButtons, Tooltips zeigen Tastaturkürzel.
- **Fehler/Leer**: Wenn `disabled`, Buttons im `aria-disabled` Zustand.

## 6. Cartographer Travel-Komponenten {#travel-komponenten}
### 6.1 `TravelCalendarLeaf`
- **Responsibility**: Kompaktes Leaf im Reisemodus (Monat/Woche/Tag/Nächste). Implementiert in [`travel/travel-calendar-leaf.ts`](./travel/travel-calendar-leaf.ts) und von der Cartographer-Sidebar eingebunden.
- **Props**
  ```ts
  interface TravelCalendarLeafProps {
    mode: TravelCalendarMode; // 'month' | 'week' | 'day' | 'upcoming'
    visible: boolean;
    activeCalendar?: CalendarSummaryDTO;
    currentTimestamp: CalendarTimestampDTO;
    range: CalendarRangeDTO;
    events: ReadonlyArray<CalendarTravelEventDTO>;
    skippedEvents: ReadonlyArray<CalendarEventSummaryDTO>;
    timeDefinition: TimeDefinitionDTO;
    minuteStep: number;
    isLoading: boolean;
    onModeChange: (mode: TravelCalendarMode) => void;
    onAdvance: (payload: AdvanceRequestDTO) => void;
    onJump: () => void;
    onClose: () => void;
    onFollowUp: (eventId: string) => void;
  }
  ```
- **Events**: `onAdvance` dispatcht `TRAVEL_TIME_ADVANCE_REQUESTED`; `onModeChange` → `TRAVEL_MODE_CHANGED`; `onJump` öffnet `TimeAdvanceDialog` im Travel-Kontext.
- **Styling**: Pane-Breite 320-360px; Buttons icon-only bei <320px; Quick-Steps gruppiert (`ButtonGroup` mit Tooltips „±1 Std“ etc.).
- **Fehler/Leer**: Zeigt Banner/EmptyState analog [UX_SPEC §4](./UX_SPEC.md#4-fehler-und-leerstaaten).

### 6.2 `TravelCalendarToolbar`
- **Responsibility**: Toolbar innerhalb des Travel-Leafs. Siehe [`travel/travel-calendar-toolbar.ts`](./travel/travel-calendar-toolbar.ts).
- **Props**
  ```ts
  interface TravelCalendarToolbarProps {
    mode: TravelCalendarMode;
    canStepBackward: boolean;
    canStepForward: boolean;
    onChangeMode: (mode: TravelCalendarMode) => void;
    onStepDay: (direction: 'backward' | 'forward') => void;
    onStepHour: (direction: 'backward' | 'forward') => void;
    onStepMinute: (direction: 'backward' | 'forward', amount?: number) => void;
    onJump: () => void;
    onClose: () => void;
  }
  ```
- **Accessibility**: Buttons mit `aria-keyshortcuts` (`Ctrl+Alt+Shift+1..4` für Modi, `Ctrl+Alt+.`/`,` für Stunden, `Ctrl+Alt+;`/`'` für Minuten). `aria-live`-Region kündigt neue Uhrzeit an. Wird indirekt über `TravelCalendarLeaf` angesprochen.


## 4. Mode-Komponenten – Almanac › Events {#events-komponenten}
### 4.1 `EventsModeView`
- **Responsibility**: Container für Timeline/Tabelle/Karte inkl. Filterzustände.
- **Props**
  ```ts
  interface EventsModeViewProps {
    viewMode: EventsViewMode; // 'timeline' | 'table' | 'map'
    filters: EventsFilterState;
    sort: EventsSort;
    pagination: EventsPaginationState;
    isLoading: boolean;
    hasMore: boolean;
    upcomingPhenomena: ReadonlyArray<PhenomenonSummaryDTO>;
    onViewModeChange: (mode: EventsViewMode) => void;
    onFilterChange: (next: EventsFilterState) => void;
    onSortChange: (next: EventsSort) => void;
    onLoadMore: () => void;
    onExport: (format: 'csv' | 'json') => void;
    onOpenPhenomenon: (phenomenonId: string) => void;
  }
  ```
- **Styling**: Layout per `ui/Stack`; Filterchips `ui/Tag` mit Badges.

### 4.2 `EventsToolbar`
- **Responsibility**: Filterleiste, View-Mode-Toggle, Export/Import.
- **Props**
  ```ts
  interface EventsToolbarProps {
    viewMode: EventsViewMode;
    filterCount: number;
    activeFilters: EventsFilterState;
    onToggleFilterPanel: () => void;
    onViewModeChange: (mode: EventsViewMode) => void;
    onExport: (format: 'csv' | 'json') => void;
    onImport: () => void;
  }
  ```
- **Accessibility**: Buttons mit `aria-pressed`; Filterpanel `aria-expanded`.

### 4.3 `EventsTimeline`
- **Responsibility**: Visualisiert Phänomene als chronologische Liste mit Gruppen.
- **Props**
  ```ts
  interface EventsTimelineProps {
    groups: ReadonlyArray<PhenomenonGroupDTO>; // { heading, items }
    zoomLabel: string;
    onNavigateRange: (direction: 'prev' | 'next' | 'today') => void;
    onOpenPhenomenon: (phenomenonId: string) => void;
  }
  ```
- **Styling**: Nutzt `ui/Timeline` (vertikal); Items mit Kategorie-Badge und Hook-Icons.
- **Fehler/Leer**: Fallback-Slots `emptyState`, `errorState`.

### 4.4 `EventsTable`
- **Responsibility**: Tabellarische Ansicht mit Sortier- und Spaltenoptionen.
- **Props**
  ```ts
  interface EventsTableProps {
    rows: ReadonlyArray<PhenomenonRowDTO>;
    sort: EventsSort;
    onSortChange: (next: EventsSort) => void;
    onOpenPhenomenon: (phenomenonId: string) => void;
    onToggleColumn: (column: EventsTableColumn) => void;
  }
  ```
- **Styling**: Basierend auf `ui/Table`; sticky Header; Sortiericons `ui/IconButton`.

### 4.5 `EventsMap`
- **Responsibility**: Raster-/Heatmap-Darstellung (optional, Feature-Flag).
- **Props**
  ```ts
  interface EventsMapProps {
    cells: ReadonlyArray<PhenomenonMapCellDTO>;
    focusRange: CalendarRangeDTO;
    onCellHover?: (cellId: string | null) => void;
    onCellSelect?: (cellId: string) => void;
  }
  ```
- **Styling**: Canvas/SVG mit `ui/Tooltip` für Hover.
- **Error/Empty**: Standard-Props `emptyState`, `errorMessage`.

### 4.6 `PhenomenonEditor`
- **Responsibility**: Formular zum Erstellen/Bearbeiten inkl. Vorschau.
- **Props**
  ```ts
  interface PhenomenonEditorProps {
    value: PhenomenonDraftDTO;
    calendars: ReadonlyArray<CalendarSummaryDTO>;
    templates: ReadonlyArray<PhenomenonTemplateDTO>;
    validationErrors?: PhenomenonValidationErrors;
    isSaving: boolean;
    onChange: (next: PhenomenonDraftDTO) => void;
    onSave: () => void;
    onCancel: () => void;
    onPreviewRequest: (draft: PhenomenonDraftDTO) => void;
  }
  ```
- **Styling**: Mehrspaltiges Formular (2-col grid), Time-Picker `ui/TimeField` (schema-aware), Kategorie-Icons `ui/IconSelect`.
- **Fehler/Leer**: Inline-Errors pro Feld; `validationSummary` oben.

### 4.7 `PhenomenonLinkDrawer`
- **Responsibility**: Drawer zur Kalenderzuordnung, Prioritäten und Hook-Konfiguration.
- **Props**
  ```ts
  interface PhenomenonLinkDrawerProps {
    phenomenon: PhenomenonDetailDTO;
    calendars: ReadonlyArray<CalendarSummaryDTO>;
    hooks: ReadonlyArray<PhenomenonHookOption>;
    isSaving: boolean;
    onUpdateLink: (payload: PhenomenonLinkUpdate) => void;
    onClose: () => void;
  }
  ```
- **Styling**: `ui/Drawer` rechts, Listen `ui/CheckboxList`, Prioritäten via `ui/SortableList`.
- **Fehler/Leer**: Zeigt Warning, wenn letzter Kalender entfernt werden soll.

### 4.8 `EventsEmptyState`
- **Responsibility**: Wiederverwendbarer Leerstaat mit CTA.
- **Props**
  ```ts
  interface EventsEmptyStateProps {
    headline: string;
    description?: string;
    primaryAction: ButtonProps;
    secondaryAction?: ButtonProps;
  }
  ```
- **Styling**: `ui/Illustration` + `ui/ButtonGroup`.

## 7. Komposition
Textuelles Diagramm (→ inkludiert/enthält):
```
AlmanacShell
 ├─ AlmanacModeSwitcher (sidebar/dropdown)
 ├─ StatusBar (anzeigt Zoom/Filter)
 └─ {slot} ActiveModeContent
      ├─ (dashboard) CalendarDashboard
      ├─ (manager)   CalendarManagerView
      └─ (events)    EventsModeView

CalendarDashboard
 ├─ CalendarDashboardToolbar (reuse ui/ButtonGroup)
 ├─ CurrentTimestampCard
 │    └─ (Quick-Steps) TravelQuickStepGroup (Dashboard-Variante)
 ├─ UpcomingEventsList
 ├─ EventFilterPanel
 └─ CalendarEventLog

CalendarManagerView
 ├─ CalendarManagerHeader
 ├─ (viewMode === 'calendar') CalendarGridView
 │    └─ CalendarEventPopover (on demand)
 └─ (viewMode === 'overview') CalendarOverviewList

EventsModeView
 ├─ EventsToolbar
 ├─ (viewMode === 'timeline') EventsTimeline
 ├─ (viewMode === 'table')    EventsTable
 ├─ (viewMode === 'map')      EventsMap
 └─ EventsEmptyState / ErrorBoundary

EventsDialogs
 ├─ PhenomenonEditor (Modal)
 └─ PhenomenonLinkDrawer (Drawer)

CalendarDialogs
 ├─ CalendarFormDialog (nutzt CalendarPreview, DefaultBadge, CalendarTimePicker)
 ├─ EventFormDialog (nutzt CalendarTimePicker, DurationInput)
 └─ TimeAdvanceDialog (nutzt CalendarTimePicker)

TravelCalendarLeaf (Cartographer)
 ├─ TravelCalendarToolbar
 ├─ TravelCalendarModeView (MonthGrid | WeekList | DayTimeline | UpcomingList)
 │    └─ (DayTimeline) CalendarTimePicker (readonly grid)
 └─ CalendarEventLog (scope='travel')
```

## 8. Fehler- & Leerstaat-Slots
- Alle Hauptcontainer (`AlmanacShell`, `CalendarDashboard`, `CalendarGridView`, `CalendarOverviewList`, `EventsModeView`, `TravelCalendarLeaf`) besitzen Props `error?: UIErrorState` und `emptyState?: UIEmptyStateConfig` (siehe unten) zur Konsistenz.
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

## 9. Persistenz-Touchpoints
- Komponenten selbst speichern nichts; Events rufen Presenter-Logik, die Gateways aus [API_CONTRACTS.md](./API_CONTRACTS.md) verwendet.
- Default-Toggle in `CalendarFormDialog`/`CalendarOverviewList` ruft `CalendarRepository.updateDefault` über Presenter.
- `PhenomenonEditor` speichert über `AlmanacRepository.upsertPhenomenon`; `PhenomenonLinkDrawer` nutzt `AlmanacRepository.updateLinks` und triggert Cache-Invalidierung.

## 10. Verweise
- State-Events: [STATE_MACHINE.md](./STATE_MACHINE.md#eventsactions)
- API-DTOs: [API_CONTRACTS.md](./API_CONTRACTS.md#dtos)
- Testszenarien: [../../tests/apps/almanac/TEST_PLAN.md](../../../tests/apps/almanac/TEST_PLAN.md)

## 11. Naming & Styling Konventionen {#20-naming--styling-konventionen}
- Präfixe laut [§1.1](#11-layer--prefix-naming) beibehalten; Komponenten aus anderen Layern nicht importieren (Shell → Mode → Shared → Travel).
- CSS: Verwende nur Tokens aus `src/ui/tokens`. Zusätzliche Klassen erhalten Namespace `sm-<layer>-<component>` (z.B. `sm-almanac-shell`).
- Events heißen `on<Event>` und dispatchen Actions aus [`STATE_MACHINE.md`](./STATE_MACHINE.md#eventsactions); keine anonymen inline-Funktionen bei Weitergabe.
- Shared-Komponenten dürfen keine Shell-spezifischen Props erwarten; Mode-Komponenten injizieren Layout-Container (`ui/Panels`).
