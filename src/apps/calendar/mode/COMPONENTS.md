# Calendar Workmode – Komponenten-Spezifikation
Dieses Dokument listet alle Calendar-Workmode Komponenten, beschreibt Props/Events und verknüpft sie mit der [UX-Spezifikation](./UX_SPEC.md) sowie der [Zustandsmaschine](./STATE_MACHINE.md).

## 1. Übersicht
- Komponenten sind in `src/apps/calendar/mode/components/*` zu platzieren.
- Styling basiert auf `src/ui` Tokens (`Stack`, `Table`, `Button`, `Modal`, `Callout`).
- Namen folgen Präfix `Calendar` oder `Event` zur Wiedererkennung.

## 2. Komponentenliste

### 2.1 `CalendarDashboardView`
- **Responsibility**: Container für Dashboard-Screen inkl. Header, Panels, Eventlog.
- **Props**
  ```ts
  interface CalendarDashboardViewProps {
    state: CalendarDashboardState; // siehe STATE_MACHINE.md
    onSelectCalendar: (calendarId: string) => void;
    onQuickAdvance: (step: AdvanceStep) => void;
    onOpenAdvanceDialog: () => void;
    onOpenJumpDialog: () => void;
    onOpenCalendarManager: () => void;
    onOpenEventManager: () => void;
  }
  ```
- **Events/Callbacks**: siehe Props; zusätzlich `onRetryLoad` (für Fehlerbanner).
- **Interner Zustand**: keiner (Pure Presenter); Loading/Empty über Props gesteuert.
- **Styling**: nutzt `ui/layout/Stack`, `ui/panels/Card`, `ui/table/Table`.
- **Fehler/Leerstaaten**: Rendert `state.errors` als `Callout`; `state.calendars.length === 0` zeigt Leerstaat.

### 2.2 `CalendarHeaderBar`
- **Responsibility**: Header mit Dropdown, Quick Actions, Secondary Actions.
- **Props**
  ```ts
  interface CalendarHeaderBarProps {
    calendars: Array<{ id: string; name: string; scope: 'global' | 'travel'; active: boolean }>;
    onSelect: (id: string) => void;
    onCreateCalendar: () => void;
    onQuickAdvance: (step: AdvanceStep) => void;
    onOpenJump: () => void;
    shortcuts: HeaderShortcutConfig; // labels + key hints
    disabled?: boolean;
  }
  ```
- **Events**: `onSelect`, `onQuickAdvance`, `onOpenJump`, `onCreateCalendar`.
- **Interner Zustand**: Dropdown open/close (via `useState`), Quick Action loading indicator.
- **Styling**: `ui/toolbar/Toolbar`, Buttons mit `variant="primary"` für Quick Actions.
- **Fehler/Leerstaat**: Wenn `calendars` leer, Dropdown zeigt CTA (prop `disabled` true).

### 2.3 `CalendarDatePanel`
- **Responsibility**: Zeigt aktuelles Datum, Woche, Schema-spezifische Infos.
- **Props**
  ```ts
  interface CalendarDatePanelProps {
    date: CalendarDateDisplay;
    schemaSummary: SchemaSummary;
    onCopyToClipboard?: () => void;
  }
  ```
- **Events**: optional Copy.
- **Styling**: `ui/panels/MetricCard` + `ui/badge/Badge`.
- **Leerstaat**: Rendert Placeholder wenn `date` null (z.B. beim Laden).

### 2.4 `UpcomingEventsTable`
- **Responsibility**: Liste kommender Ereignisse mit Aktionen.
- **Props**
  ```ts
  interface UpcomingEventsTableProps {
    events: UpcomingEventRow[];
    loading: boolean;
    onOpenEvent: (eventId: string) => void;
    onMarkComplete: (eventId: string) => void;
    filterSummary: string;
  }
  ```
- **Events**: `onOpenEvent`, `onMarkComplete`.
- **Styling**: `ui/table/Table`, `ui/button/IconButton`.
- **Fehler/Leerstaaten**: Wenn `events.length === 0`, zeigt Leerstaat mit CTA „Ereignis hinzufügen“ (via Render Prop `onCreateEvent`).

### 2.5 `EventLogAccordion`
- **Responsibility**: Expand/Collapse Liste ausgelöster Events.
- **Props**
  ```ts
  interface EventLogAccordionProps {
    log: TriggeredEventLogEntry[];
    isOpen: boolean;
    onToggle: () => void;
    onInspectEvent: (eventId: string) => void;
  }
  ```
- **Styling**: `ui/accordion/Accordion`, `ui/badge/StatusBadge` für Hook-Status.

### 2.6 `CalendarManagerModal`
- **Responsibility**: Umbrella-Komponente für Listen- und Formularzustände im Modal.
- **Props**
  ```ts
  interface CalendarManagerModalProps {
    view: 'list' | 'form';
    listProps?: CalendarManagerListProps;
    formProps?: CalendarFormProps;
    onClose: () => void;
  }
  ```
- **Styling**: `ui/modal/Modal` mit `size="large"`.
- **Fehler**: Zeigt `formProps?.errors` als Inline-Alerts.

### 2.7 `CalendarManagerList`
- **Responsibility**: Tabelle aller Kalender.
- **Props**
  ```ts
  interface CalendarManagerListProps {
    calendars: CalendarListRow[];
    onCreate: () => void;
    onEdit: (calendarId: string) => void;
    onDuplicate: (calendarId: string) => void;
    onDelete: (calendarId: string) => void;
  }
  ```
- **Styling**: `ui/table/Table` + `ui/button/ButtonGroup`.
- **Fehler**: Delete-Confirm via `ui/modal/ConfirmDialog`.

### 2.8 `CalendarForm`
- **Responsibility**: Formular für Neu/Bearbeiten.
- **Props**
  ```ts
  interface CalendarFormProps {
    value: CalendarFormValue;
    errors: Partial<Record<CalendarFormFieldKey, string>>;
    mode: 'create' | 'edit' | 'duplicate';
    preview: CalendarSchemaPreview;
    onChange: (value: CalendarFormValue) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onAdvancedOptions?: () => void;
  }
  ```
- **Events**: `onChange`, `onSubmit`, `onCancel`.
- **Styling**: `ui/form/FormLayout`, `ui/tabs/Tabs`.
- **Leerstaaten**: Default Monat-Liste mit einem vorbefüllten Monat; Buttons „Monat hinzufügen“.

### 2.9 `EventManagerView`
- **Responsibility**: Tabs für „Kommend“, „Alle“, „Vorlagen“ + Filter.
- **Props**
  ```ts
  interface EventManagerViewProps {
    state: EventManagerState;
    onCreate: (type: 'single' | 'recurring') => void;
    onEdit: (eventId: string) => void;
    onDuplicate: (eventId: string) => void;
    onDelete: (eventId: string) => void;
    onFilterChange: (filter: EventFilter) => void;
    onImportTemplate: () => void;
  }
  ```
- **Styling**: `ui/tabs/Tabs`, `ui/table/Table`, `ui/tag/TagInput`.
- **Fehler/Leerstaat**: Tab-spezifische Callouts; `state.errors.recurringConflict` zeigt Banner.

### 2.10 `EventFormModal`
- **Responsibility**: Modal für Einmalig/Wiederkehrend.
- **Props**
  ```ts
  interface EventFormModalProps {
    mode: 'single' | 'recurring';
    singleProps?: SingleEventFormProps;
    recurringProps?: RecurringEventFormProps;
    templateOptions: EventTemplateOption[];
    onSwitchMode: (mode: 'single' | 'recurring') => void;
    onClose: () => void;
  }
  ```
- **Styling**: `ui/modal/Modal`.
- **Fehler**: Zeigt JSON-Parsing-Fehler im Custom-Hook-Feld als Inline-Alert.

### 2.11 `SingleEventForm`
- **Props**
  ```ts
  interface SingleEventFormProps {
    value: SingleEventFormValue;
    errors: Partial<Record<'title' | 'date' | 'category', string>>;
    schema: CalendarSchemaPreview;
    onChange: (value: SingleEventFormValue) => void;
    onSubmit: () => void;
    onAddAnotherChange: (checked: boolean) => void;
  }
  ```
- **Styling**: `ui/form/FormSection`, `ui/date/CalendarPicker` (schema-aware Variante).

### 2.12 `RecurringEventForm`
- **Props**
  ```ts
  interface RecurringEventFormProps {
    value: RecurringEventFormValue;
    errors: Partial<Record<string, string>>;
    schema: CalendarSchemaPreview;
    preview: RecurrencePreview;
    onChange: (value: RecurringEventFormValue) => void;
    onSubmit: () => void;
    onValidateRule: (rule: RepeatRuleDraft) => void;
  }
  ```
- **Styling**: `ui/form/Fieldset`, `ui/code/CodeInput` für Custom-Hook Payload.

### 2.13 `RecurrencePreviewPanel`
- **Responsibility**: Zeigt nächste fünf Vorkommen + Konfliktstatus.
- **Props**
  ```ts
  interface RecurrencePreviewPanelProps {
    preview: RecurrencePreview;
    conflicts: RecurrenceConflict[];
  }
  ```
- **Styling**: `ui/list/List`, `ui/callout/WarningCallout`.

### 2.14 `TimeAdvanceDialog`
- **Responsibility**: Dialog für Zeitfortschritt.
- **Props**
  ```ts
  interface TimeAdvanceDialogProps {
    options: AdvanceOption[]; // +1 Tag etc.
    customValue: AdvanceCustomValue;
    errors: Partial<Record<'custom', string>>;
    summary: AdvanceSummary | null;
    isSubmitting: boolean;
    onSelectOption: (optionId: string) => void;
    onCustomChange: (value: AdvanceCustomValue) => void;
    onToggleAutoTrigger: (enabled: boolean) => void;
    onSubmit: () => void;
    onCancel: () => void;
  }
  ```
- **Styling**: `ui/modal/Dialog`, `ui/radio/RadioGroup`.
- **Fehler**: Inline bei `errors.custom`; Summary Panel zeigt Hook-Fehler.

### 2.15 `TimeJumpDialog`
- **Props**
  ```ts
  interface TimeJumpDialogProps {
    targetDate: CalendarDateInput;
    errors: Partial<Record<'date', string>>;
    summary: JumpSummary | null;
    skippedEvents: TriggeredEventLogEntry[];
    warnOversized: boolean;
    onDateChange: (value: CalendarDateInput) => void;
    onToggleBackfill: (enabled: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
  }
  ```
- **Styling**: `ui/modal/Dialog`, `ui/date/CalendarPicker`.

### 2.16 `TravelSyncBanner`
- **Responsibility**: Feedback im Travel-Panel.
- **Props**
  ```ts
  interface TravelSyncBannerProps {
    calendarName: string;
    date: CalendarDateDisplay;
    pendingEvents: TriggeredEventLogEntry[];
    status: 'ok' | 'error';
    onResolveEvent: (eventId: string) => void;
    onOpenCalendarMode: () => void;
  }
  ```
- **Styling**: `ui/banner/Banner`.

### 2.17 `EventFilterPanel`
- **Responsibility**: Filter/Suche.
- **Props**
  ```ts
  interface EventFilterPanelProps {
    filter: EventFilter;
    quickFilters: QuickFilterChip[];
    onFilterChange: (filter: EventFilter) => void;
    onReset: () => void;
  }
  ```
- **Styling**: `ui/filter/FilterPanel`, `ui/chip/Chip`.

## 3. Kompositionsdiagramm (textuell)
```
CalendarModeRoot
└── CalendarDashboardView
    ├── CalendarHeaderBar
    ├── CalendarDatePanel
    ├── UpcomingEventsTable
    ├── EventLogAccordion
    └── TravelSyncBanner (optional, wenn in Travel-Kontext eingebettet)

CalendarManagerModal
├── CalendarManagerList
└── CalendarForm (je nach view)

EventManagerView
├── EventFilterPanel
├── UpcomingEventsTable (Tab „Kommend“)
├── GenericEventsTable (Tab „Alle“)
├── TemplateLibraryTable (Tab „Vorlagen“)
└── EventFormModal (als Portalled)

EventFormModal
├── SingleEventForm
├── RecurringEventForm
└── RecurrencePreviewPanel

TimeAdvanceDialog & TimeJumpDialog → nutzen Domain-Services via Presenter und aktualisieren CalendarModeRoot-State.
```

## 4. Fehler- & Leerstaaten pro Komponente
| Komponente | Leerstaat | Fehlerverhalten |
| --- | --- | --- |
| `CalendarDashboardView` | Zeigt `ui/empty/EmptyState` mit CTA „Kalender anlegen“ wenn `state.hasCalendars === false`. | Banner `ui/alert/Error` mit `onRetryLoad`. |
| `UpcomingEventsTable` | Render Prop `emptyContent` mit CTA „Ereignis hinzufügen“. | Fehlertooltip pro Zeile bei Hook-Fehler, globaler Banner bei Ladefehler. |
| `CalendarForm` | Erstellt automatisch einen Standardmonat „Monat 1“ | Zeigt Feldfehler, Focus auf erstes invalides Feld. |
| `RecurringEventForm` | Vorschau zeigt Platzhalter „Keine Vorschau“. | Konflikte als Liste mit Checkbox „Konflikt akzeptieren“. |
| `TimeAdvanceDialog` | Zusammenfassung zeigt „Noch keine Vorschau“ | Inline-Fehler im benutzerdefinierten Feld, Banner bei Hook-Dispatch-Fehler. |
| `TimeJumpDialog` | Skipped-Liste zeigt Text „Keine Ereignisse übersprungen“ | Warnbanner bei >500 Events, Feldfehler bei ungültigem Datum. |
| `TravelSyncBanner` | Wenn keine Events, zeigt Status „Keine Aktionen erforderlich“. | Wechselt zu `status="error"`, zeigt Retry-Button. |

## 5. Accessibility Hooks
- Alle Dialoge nutzen `ui/modal` Fokus-Trap; Buttons liefern `aria-label` bei Icon-Only Varianten.
- Tabellen unterstützen Tastatur (Pfeiltasten, `Enter` für Aktionen). `UpcomingEventsTable` liefert `rowProps.getKeyHandlers()` aus Presenter.

## 6. Internationalisierung
- Props enthalten keine lokalisierten Strings; Presenter wandelt Domaindaten in `LocalizedString` mittels `i18n.t('calendar.mode.*')` um.
- Datumsanzeigen nutzen `formatCalendarDate(date, schema)` (siehe [API_CONTRACTS](./API_CONTRACTS.md#helper-funktionen)).

## 7. Persistenz-Touchpoints
- `CalendarManagerModal` → `CalendarRepository` (`create`, `update`, `delete`).
- `EventManagerView` → `CalendarEventRepository` Methoden (`list`, `filter`, `create`, `update`).
- `TimeAdvanceDialog`/`TimeJumpDialog` → `CalendarStateGateway.advance` / `setDate`.

Assumption: Komponenten bleiben Presenter-getrieben und speichern keinen Persistenzstatus lokal.
