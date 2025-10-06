# Calendar Workmode – Testplan
Dieser Testplan leitet sich aus den Spezifikationen unter `src/apps/calendar` ab. Er adressiert Domain-, Persistenz-, UI- und Integrationsszenarien inklusive Travel-Leaf und Default-Handling.

## 1. Ziele
- Sicherstellen, dass Mehrkalenderschemata, Default-Logik und Zoom-Ansichten korrekt funktionieren.
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
- **Recurrence-Engine**
  - Annual Offset (z.B. Tag 42) erzeugt korrekte Vorkommen über 3 Jahre inkl. Schaltmonate.
  - Monthly Position (zweiter Tag des dritten Monats) reagiert auf Schemaänderungen.
  - Weekly DayIndex funktioniert bei Tagen >7 (10-Tage-Woche -> Index 0..9).
  - Custom-Rule JSON Validation (syntaktischer Fehler → `validation_error`).
- **Default-Resolver**
  - Setzen eines neuen globalen Defaults deaktiviert vorherigen.
  - Löschen eines Default-Kalenders wählt fallback (erster verbleibender) und markiert Flag.
  - Reise-Default überschreibt globalen Default, fällt zurück wenn gelöscht.
- **Zeitfortschritt**
  - Advance über 30 Tage chunked (max 365) ruft Hook pro Event exakt einmal.
  - Negative Advance (Rücksprung) liefert `skipped`-Liste.

## 4. Repository-/Gateway-Tests
- `CalendarRepository`
  - CRUD für Kalender inkl. `schemaVersion` und `leapRules`.
  - Persistenz von `isDefaultGlobal`, `defaultTravelIds`.
  - Migration von Version `1.0.0` → `1.1.0` (Defaults-Datei).
- `CalendarStateGateway`
  - `loadSnapshot` liefert aktiven Kalender + Defaults + Travel-Prefs.
  - `setActiveCalendar` schreibt global/ Reise-spezifisch (Mock-Storage prüft).
  - `setTravelLeafPreferences` persistiert `mode`/`visible`.
- Travel-Prefs Speicher (`calendar.travelPrefs.json`) wird pro Reise isoliert.

## 5. Integrationstests (Presenter)
- **Dashboard Presenter**
  - Initialisierung ohne Kalender → Leerstaat + CTA.
  - Wechsel aktiver Kalender → Trigger `CALENDAR_SELECTED`, UI-Refresh, Telemetrie-Spy.
- **Manager Presenter**
  - Moduswechsel `calendar ↔ overview` erhält Filterzustand.
  - Zoom-Wechsel (Monat → Woche) ruft `fetchEventsForRange` mit korrektem `CalendarRangeDTO`.
  - Default-Toggle im Kontextmenü → `DEFAULT_SET_REQUESTED` → `DEFAULT_SET_CONFIRMED` → Badge.
- **Event Flow**
  - Inline-Erstellung in Grid (Double-Click) öffnet Dialog mit Datum.
  - Speichern Recurring → `preview`-Mock validiert 5 Vorkommen.
- **Travel Presenter**
  - Travel-Start Hook → `TRAVEL_LEAF_MOUNTED`, Leaf visible, Mode aus Prefs.
  - Quick-Actions `+1 Tag` dispatchen `TRAVEL_TIME_ADVANCE_REQUESTED` und aktualisieren `CalendarEventLog`.
  - Leaf Close → Persistiert `visible=false` und Telemetrie-Ereignis.
- **Cartographer Sync**
  - Mock `CartographerHookGateway` erfasst `notifyTravelPanel` mit identischen Events wie UI.
  - Fehlerfall (`io_error`) → Presenter dispatcht `ERROR_OCCURRED(scope='travel')` und zeigt Banner.

## 6. UI/Accessibility-Tests
- **Keyboard Navigation**
  - Tab-Reihenfolge im Dashboard (Toolbar → Cards → Filter → Log).
  - Kalenderansicht: Arrow-Keys navigieren zwischen Tagen (Focus Management), `Enter` öffnet Event.
  - Travel-Leaf Shortcuts `Ctrl+Alt+Shift+1..4` wechseln Modi.
- **Screenreader**
  - Kalender-Grid hat `aria-roledescription="calendar"`.
  - Default-Badge `aria-label="Globaler Standard"`.
- **Focus Trap**
  - `CalendarFormDialog`, `EventFormDialog`, `TimeAdvanceDialog` lassen Fokus nicht entweichen.

## 7. Regression & Scenario Tests
- **Reise mit Feiertagen**
  - Setup: Reise `travel-1`, Kalender (10-Tage-Woche) + Markt-Events wöchentlich.
  - Scenario: Advance 12 Tage → 1 Hook, 2 Übersprungene Events, Travel-Leaf Banner.
- **Default-Wechsel während Reise**
  - Reise startet mit globalem Default A → Travel-Leaf.
  - Nutzer:in setzt globalen Default auf B → Travel-Leaf zeigt Hinweis, Dropdown aktualisiert, Cartographer-Panel erhält Update.
- **Schemaänderung Migration**
  - Kalender bearbeitet (Monat eingefügt) → Migration migriert Ereignisse, zeigt Konfliktliste (Snapshot-Assertion).

## 8. Fixtures
- **Kalender**
  - `gregorian.json`: 12 Monate, 7 Tage, Leap alle 4 Jahre.
  - `ten-day.json`: 10 Tage Woche, 6 Monate mit var. Länge, Leap alle 5 Jahre.
- **Ereignisse** (6 Typen)
  1. Einmalig: `Festival of Light` (gregorian, 12/12).
  2. Wiederkehrend Annual offset: `Harvest` (dayOfYear 180).
  3. Wiederkehrend Weekly: `Market Day` (DayIndex 4) – 10-Tage-Woche.
  4. Wiederkehrend Monthly position: `Council` (Monat 3, Tag 1).
  5. Custom Hook: `Dragon Sign` (custom JSON, triggers script).
  6. Einmalig Vergangenheit: `Old War` (Markiert als nachzuholen).

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
| Datum setzen/jump | TimeAdvanceDialog Jump, Domain JumpValidation |
| Ereignisliste filtern/suchen | Dashboard Filter Presenter, UI Filter Reset |
| Kalender bearbeiten | Migration Test, Integration Editor Save |
| Travel-Kalender anzeigen | Travel Mount Integration, UI Mode Shortcuts |
| Reise-Sync (Cartographer) | Regression Travel Panel Sync, Hook Dispatch |

## 10. Tools & Automatisierung
- Test Runner: `vitest` (`npm run test`).
- Optional: Storybook/Visual Regression für Grid/Leaf (falls `storybook` verfügbar) – Snapshots 960px & 320px.
- Accessibility Checks: `@testing-library/jest-dom` + `axe-core` (in UI Tests) für Hauptscreens.

## 11. Offene Punkte
- Entscheidung zu Persistenz-Backend (Datei vs. Obsidian Vault API) beeinflusst Repository-Mocks.
- E2E-Tests mit tatsächlichem Cartographer-Modul pending (Abhängigkeit vom Travel-System).
