# Calendar Workmode – Testplan
Dieser Testplan leitet sich aus den Spezifikationen unter `src/apps/calendar` ab. Er adressiert Domain-, Persistenz-, UI- und Integrationsszenarien inklusive Travel-Leaf und Default-Handling.

## 1. Ziele
- Sicherstellen, dass Mehrkalenderschemata, Default-Logik und Zoom-Ansichten korrekt funktionieren.
- Verifizieren, dass Sub-Tages-Zeitschritte (Stunden/Minuten) normalisiert, persistiert und in UI/Travel synchron angezeigt werden.
- Prüfen, dass Almanac-Modus & Events-Hub (Phänomene, Kategorien, Filter) konsistent mit Kalenderdaten laufen und Hooks korrekt dispatchen.
- Verifizieren, dass der Travel-Kalender mit Cartographer synchronisiert und Lifecycle-Events behandelt.
- Abdecken von Accessibility, Tastatursteuerung und Fokusmanagement.

## 2. Testarten
| Typ | Fokus | Referenzen |
| --- | --- | --- |
| Unit (Vitest) | Domain-Arithmetik, Recurrence-Engine, Default-Selektion | `src/apps/calendar/domain`, [API_CONTRACTS.md](../../../src/apps/calendar/mode/API_CONTRACTS.md) |
| Persistence/Repository | Laden/Speichern von Kalendern, Defaults, Travel-Prefs | `CalendarRepository`, `CalendarStateGateway` |
| Integration | Presenter + Mock-Gateways (Workmode, Manager, Travel) | [STATE_MACHINE.md](../../../src/apps/calendar/mode/STATE_MACHINE.md) |
| UI/Presenter | Komponenten-Interaktionen, Fokus, Shortcuts | [UX_SPEC.md](../../../src/apps/calendar/mode/UX_SPEC.md), [COMPONENTS.md](../../../src/apps/calendar/mode/COMPONENTS.md) |
| Regression | Cartographer-Reise mit Hooks, Default-Wechsel während Reise | `apps/cartographer/travel` |

## 3. Domain-Unit-Tests
- **Kalenderarithmetik**
  - Berechnung von Datum + Offset bei 10-Tage-Wochen, Schaltmonaten.
  - Validierung von Datum (Month Bounds, Negative Tage → Fehler).
- **Timestamp-Normalisierung**
  - Minuten/ Stunden-Roll-over (z.B. 23:90 → Folgetag 00:30) gemäß Schema `hoursPerDay`/`minutesPerHour`.
  - Präzisionswechsel (`precision='day'` → `precision='minute'`) behält Datum.
- **Recurrence-Engine**
  - Annual Offset (z.B. Tag 42) erzeugt korrekte Vorkommen über 3 Jahre inkl. Schaltmonate.
  - Monthly Position (zweiter Tag des dritten Monats) reagiert auf Schemaänderungen.
  - Weekly DayIndex funktioniert bei Tagen >7 (10-Tage-Woche -> Index 0..9).
  - Custom-Rule JSON Validation (syntaktischer Fehler → `validation_error`).
- **Event-Zeitlogik**
  - All-Day Ereignisse erhalten keine Zeit, zeitgebundene Events setzen `timePrecision='minute'`.
  - Überschneidungsprüfung (zwei Events 14:30–15:00) markiert Konflikt.
- **Default-Resolver**
  - Setzen eines neuen globalen Defaults deaktiviert vorherigen.
  - Löschen eines Default-Kalenders wählt fallback (erster verbleibender) und markiert Flag.
  - Reise-Default überschreibt globalen Default, fällt zurück wenn gelöscht.
- **Phänomen-Engine**
  - Annual / Monthly / Weekly Regeln erzeugen korrekte Occurrences pro Kalender (inkl. Zeitanteilen).
  - Astronomische Regel ohne Quelle → Fehler `astronomy_source_missing`.
  - Prioritätssortierung: bei gleichem Timestamp entscheidet `priority` + Kategorie-Fallback.
  - Hooks `cartographer_phenomenon` werden einmalig pro Trigger dispatcht.
- **Zeitfortschritt**
  - Advance über 30 Tage chunked (max 365) ruft Hook pro Event exakt einmal.
  - Advance +120 Minuten → 2 Stunden Fortschritt inkl. Normalisierung.
  - Negative Advance (Rücksprung) liefert `skipped`-Liste.

## 4. Repository-/Gateway-Tests
- `CalendarRepository`
  - CRUD für Kalender inkl. `schemaVersion` und `leapRules`.
  - Persistenz von `hoursPerDay`, `minutesPerHour`, `minuteStep` (Default-Fallback bei Migration 1.2 → 1.3).
  - Persistenz von `isDefaultGlobal`, `defaultTravelIds`.
  - Migration von Version `1.0.0` → `1.1.0` (Defaults-Datei).
  - Migration von Version `1.2.0` → `1.3.0` (TimeDefinition-Backfill, Events `allDay`).
- `CalendarStateGateway`
  - `loadSnapshot` liefert aktiven Kalender + Defaults + Travel-Prefs inkl. `currentTimestamp` & `timeDefinition`.
  - `setActiveCalendar` schreibt global/ Reise-spezifisch (Mock-Storage prüft).
  - `setTravelLeafPreferences` persistiert `mode`/`visible`/`lastViewedTimestamp`/`quickStep`.
- Travel-Prefs Speicher (`calendar.travelPrefs.json`) wird pro Reise isoliert.
- `AlmanacRepository`
  - `listPhenomena` respektiert Filter (Kategorie, Kalender, Zeitraum) und Pagination (`cursor`).
  - `upsertPhenomenon` speichert neue/aktualisierte Phänomene inkl. `schemaVersion`.
  - `updateLinks` überschreibt Prioritäten atomar und verhindert Entfernen des letzten Kalenders.
  - Migration 1.3 → 1.4 erzeugt leere `almanac.phenomena.json` + `almanac.mode.json` falls nicht vorhanden.
- Events-Präferenzen (`events.preferences.json`) persistieren `viewMode`/Filter und werden bei Snapshot geladen.

## 5. Integrationstests (Presenter)
- **Dashboard Presenter**
  - Initialisierung ohne Kalender → Leerstaat + CTA.
  - Wechsel aktiver Kalender → Trigger `CALENDAR_SELECTED`, UI-Refresh, Telemetrie-Spy.
  - Quick-Actions `+1 Stunde`/`+15 Min` senden `TIME_ADVANCE_REQUESTED` mit korrektem Payload.
- **Manager Presenter**
  - Moduswechsel `calendar ↔ overview` erhält Filterzustand.
  - Zoom-Wechsel (Monat → Woche) ruft `fetchEventsForRange` mit korrektem `CalendarRangeDTO`.
  - Default-Toggle im Kontextmenü → `DEFAULT_SET_REQUESTED` → `DEFAULT_SET_CONFIRMED` → Badge.
- **Almanac Shell Presenter**
  - Moduswechsel `dashboard ↔ events` persistiert `AlmanacModeSnapshotDTO` und lädt Zustand nur beim ersten Eintritt.
  - Mobile Drawer schließt nach Auswahl, Fokus springt auf Content Heading.
- **Events Presenter**
  - Filteränderung dispatcht `EVENTS_DATA_REQUESTED` und reduziert Ergebnisse nach Kategorie/Zeitraum.
  - `PHENOMENON_SAVE_REQUESTED` mit neuem Draft → Mock `AlmanacRepository.upsertPhenomenon` aufgerufen, Snapshot aktualisiert, Timeline zeigt neuen Eintrag.
  - Link-Drawer `updateLinks` verhindert Entfernen des letzten Kalenders (Expect Error Toast).
  - Export-Flow: `EVENTS_EXPORT_REQUESTED` -> Mock Export liefert Blob, Presenter zeigt Toast & Download-Link.
- **Event Flow**
  - Inline-Erstellung in Grid (Double-Click) öffnet Dialog mit Datum/Zeit (`precision='minute'`).
  - Speichern Recurring → `preview`-Mock validiert 5 Vorkommen inkl. Uhrzeit.
- **Travel Presenter**
  - Travel-Start Hook → `TRAVEL_LEAF_MOUNTED`, Leaf visible, Mode aus Prefs.
  - Quick-Actions `+1 Tag`/`+1 Stunde`/`+15 Min` dispatchen `TRAVEL_TIME_ADVANCE_REQUESTED` mit unterschiedlichem Payload und aktualisieren `CalendarEventLog`.
  - Leaf Close → Persistiert `visible=false` und Telemetrie-Ereignis.
- **Cartographer Sync**
  - Mock `CartographerHookGateway` erfasst `notifyTravelPanel` mit identischen Events wie UI.
  - Fehlerfall (`io_error`) → Presenter dispatcht `ERROR_OCCURRED(scope='travel')` und zeigt Banner.
  - Advance +15 Minuten via Travel-Leaf aktualisiert `TravelPanelUpdateDTO.currentTimestamp` synchron zur UI.

## 6. UI/Accessibility-Tests
- **Keyboard Navigation**
  - Tab-Reihenfolge im Dashboard (Toolbar → Cards → Filter → Log).
  - Kalenderansicht: Arrow-Keys navigieren zwischen Tagen (Focus Management), `Enter` öffnet Event.
  - Travel-Leaf Shortcuts `Ctrl+Alt+Shift+1..4` wechseln Modi.
  - Time-Picker: Pfeiltasten erhöhen Stunde/Minute, `PageUp/Down` ±10 Minuten, `Esc` schließt Dialog.
  - Events-Modus Timeline: `j/k` oder `ArrowUp/Down` bewegt zwischen Phänomenen, `Enter` öffnet Editor, `Shift+Enter` Link-Drawer.
- **Screenreader**
  - Kalender-Grid hat `aria-roledescription="calendar"`.
  - Default-Badge `aria-label="Globaler Standard"`.
  - Time-Picker gibt `aria-valuetext="Stunde 5 von 10"` wieder.
  - Events-Timeline nutzt `role="list"` mit `aria-describedby` für Kategorie & Auswirkungen; Export-Toast `aria-live="polite"`.
- **Focus Trap**
  - `CalendarFormDialog`, `EventFormDialog`, `TimeAdvanceDialog` lassen Fokus nicht entweichen.

## 7. Regression & Scenario Tests
- **Reise mit Feiertagen**
  - Setup: Reise `travel-1`, Kalender (10-Tage-Woche) + Markt-Events wöchentlich.
  - Scenario: Advance 12 Tage → 1 Hook, 2 Übersprungene Events, Travel-Leaf Banner.
- **Default-Wechsel während Reise**
  - Reise startet mit globalem Default A → Travel-Leaf.
  - Nutzer:in setzt globalen Default auf B → Travel-Leaf zeigt Hinweis, Dropdown aktualisiert, Cartographer-Panel erhält Update.
- **Almanac Events (Wetter & Gezeiten)**
  - Setup: Phänomen `Sturmfront` (Weather, Dauer 12h) + `Spring Tide` (Tide).
  - Szenario: Advance +6h löst Sturm-Hook → Travel-Panel erhält Wetter-Update; Jump über Zeitraum listet `skippedPhenomena`.
- **Almanac Mode Persistenz**
  - Nutzer:in wechselt zu Events, setzt Filter, verlässt Mode → `getAlmanacMode` Snapshot liefert Mode + Filter beim Neustart.
- **Schemaänderung Migration**
  - Kalender bearbeitet (Monat eingefügt) → Migration migriert Ereignisse, zeigt Konfliktliste (Snapshot-Assertion).
- **Sub-Tages-Aufgabe**
  - Ereignis `Council Briefing` (15 Minuten) wird beim Advance `+30 Minuten` ausgelöst; Nacharbeit-Liste zeigt Restereignis.

## 8. Fixtures
- **Kalender**
  - `gregorian.json`: 12 Monate, 7 Tage, Leap alle 4 Jahre, `hoursPerDay=24`, `minuteStep=15`.
  - `ten-day.json`: 10 Tage Woche, 6 Monate mit var. Länge, Leap alle 5 Jahre, `hoursPerDay=10`, `minutesPerHour=100`, `minuteStep=10`.
- **Ereignisse** (8 Typen)
  1. Einmalig: `Festival of Light` (gregorian, 12/12, ganztägig).
  2. Wiederkehrend Annual offset: `Harvest` (dayOfYear 180).
  3. Wiederkehrend Weekly: `Market Day` (DayIndex 4) – 10-Tage-Woche.
  4. Wiederkehrend Monthly position: `Council` (Monat 3, Tag 1).
  5. Custom Hook: `Dragon Sign` (custom JSON, triggers script).
  6. Einmalig Vergangenheit: `Old War` (Markiert als nachzuholen).
  7. Zeitgebunden: `Council Briefing` (gregorian, Start 14:30, Dauer 60 Minuten).
  8. Zeitgebunden wiederkehrend: `Night Watch` (offset 22:00 täglich, Dauer 120 Minuten).
- **Phänomene**
  1. `Spring Bloom` (Season, all calendars, annual offset Tag 90).
  2. `Stormfront` (Weather, selected calendars, Dauer 12h, Effekt `weather=storm`).
  3. `Harvest Moon` (Astronomy, Mondphase, Offset +30 Minuten).
  4. `Spring Tide` (Tide, priority 8, Hook `cartographer_phenomenon`).
  5. `Aurora` (Custom Hook, nur Kalender Oberwasser).

## 9. Acceptance Mapping
| Use Case | Tests |
| --- | --- |
| Aktiven Kalender wählen | Integration: Dashboard Presenter „Aktiven Kalender wechseln“, UI Test Dropdown Fokus |
| Default-Kalender verwalten | Domain Default-Resolver, Integration Manager Default Toggle |
| Kalender-Manager – Modus wechseln | Integration Manager Moduswechsel, UI Snapshot Tabs |
| Neuen Kalender anlegen | UI Dialog Submit, Repository create + Default Flag |
| Ereignis anlegen (einmalig) | EventFormDialog Submit Single, Presenter Update Upcoming |
| Ereignis anlegen (wiederkehrend) | Recurrence-Engine Preview, EventFormDialog Recurring |
| Zeit fortschreiten | Domain Advance, Integration Travel Quick-Actions |
| Datum und Zeit setzen | TimeAdvanceDialog Jump (Minutenpräzision), Domain JumpValidation |
| Ereignisliste filtern/suchen | Dashboard Filter Presenter, UI Filter Reset |
| Kalender bearbeiten | Migration Test, Integration Editor Save |
| Travel-Kalender anzeigen | Travel Mount Integration, UI Mode Shortcuts |
| Reise-Sync (Cartographer) | Regression Travel Panel Sync, Hook Dispatch |
| Almanac-Modus wechseln | Integration Almanac Shell Presenter, Mobile Drawer Fokus-Test |
| Events-Modus navigieren & filtern | Integration Events Presenter Filter, UI Accessibility (Timeline Navigation) |
| Phänomen anlegen/bearbeiten | Domain Phänomen-Engine + UI Editor Submit + Preview Snapshot |
| Phänomen Kalender verknüpfen | Integration Link-Drawer, Repository UpdateLinks Konflikttest |

## 10. Tools & Automatisierung
- Test Runner: `vitest` (`npm run test`).
- Optional: Storybook/Visual Regression für Grid/Leaf (falls `storybook` verfügbar) – Snapshots 960px & 320px.
- Accessibility Checks: `@testing-library/jest-dom` + `axe-core` (in UI Tests) für Hauptscreens.
- Zeitabhängige Tests nutzen `vi.useFakeTimers()` für sub-tägliche Schritte und Snapshot-Vergleiche auf Minutenebene.

## 11. Offene Punkte
- Entscheidung zu Persistenz-Backend (Datei vs. Obsidian Vault API) beeinflusst Repository-Mocks.
- E2E-Tests mit tatsächlichem Cartographer-Modul pending (Abhängigkeit vom Travel-System).
