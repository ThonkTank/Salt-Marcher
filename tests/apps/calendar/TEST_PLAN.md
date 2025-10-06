# Calendar Workmode – Testplan
Dieser Plan beschreibt Testarten, Suites und Fixtures für den Calendar-Workmode. Er ergänzt [src/apps/calendar/IMPLEMENTATION_PLAN.md](../../src/apps/calendar/IMPLEMENTATION_PLAN.md) sowie die Spezifikationen in `src/apps/calendar/mode/*`.

## 1. Teststrategien
| Ebene | Ziel | Tools | Dateipfade |
| --- | --- | --- | --- |
| Domain-Unit | Kalenderarithmetik, Recurrence, Schema-Migration | Vitest | `tests/apps/calendar/domain/*.spec.ts` |
| Repository/Gateway | Persistenz, Round-Trip, Fehlerbehandlung | Vitest + `vi.fn()` Mocks | `tests/apps/calendar/persistence/*.spec.ts` |
| Presenter/UI | Interaktionen, Fokusmanagement, Tastatur | Vitest + DOM Testing Library | `tests/apps/calendar/mode/*.spec.tsx` |
| Integration Cartographer | Reise-Sync, Hooks, Fehlerszenarien | Vitest + mocked `CartographerController` | `tests/apps/calendar/integration/*.spec.ts` |
| Visual/Story (optional) | Screenshot-Regression für Dialoge | Storybook/Chromatic (falls Pipeline) | `stories/apps/calendar/*.stories.tsx` |

## 2. Unit-Tests (Domain)
- **Kalenderarithmetik**: `calculateNextDate`, `normalizeDate`, Handling 10-Tage-Wochen, Schaltmonate.
- **Recurrence-Engine**: Annual, Monthly Position, Weekly, Custom Hook stub → validiert Konflikt-Detection & Vorschau.
- **Schema-Migration**: Migration bei Änderung der Monatslänge, Konflikt-Erkennung `date_out_of_range`.
- **Event Sorting**: Priorisierung in Dashboard (nächste Events, tie-breaker Tags).
- **Validation**: Ensure `CalendarSchemaValidator` wirft `validation_error` für invalid input.

### Beispielstruktur (`tests/apps/calendar/domain/calendar-arithmetic.spec.ts`)
```ts
// tests/apps/calendar/domain/calendar-arithmetic.spec.ts – prüft Normalisierung für 10-Tage-Woche
```
- Arrange: Lade Fixture `fixtures/ten-day-calendar.ts`.
- Act: Advance + Normalize.
- Assert: Datum wrappt korrekt, `dayOfWeek` im Bereich 0..9.

## 3. Repository/Gateway-Tests
- **CalendarRepository**: CRUD, Concurrency (simulierter Parallelzugriff), Schema-Versionierung.
- **CalendarEventRepository**: Filter/Sortierung, Template-Import, Fehler `io_error` (z.B. Schreibfehler, Mock wirft).
- **CalendarStateGateway**: Advance/Jump mit Mocked Domain; persistiert `activeCalendarId` (global vs. travel).
- **Cartographer Hooks**: Ensure `AdvanceResult` wird an Hook-Ports durchgereicht, Fehler propagiert.

Mocks: Verwende `tests/mocks/json-store.ts` analog zu bestehenden Apps; Travel-Hooks in `tests/apps/cartographer` referenzieren.

## 4. Presenter/UI-Tests
- **DashboardPresenter**: Render Quick Actions, Dropdown, Leerstaaten; testet Tastatur (Space/Enter) und `aria`-Attribute.
- **CalendarFormPresenter**: Validierung (Inline-Fehler), Tabs, Focus-Rückgabe.
- **EventManagerPresenter**: Filterwechsel, Tab-Sync, Recurrence-Konfliktbanner.
- **TimeAdvanceDialogPresenter**: Zusammenfassung, Fehlerpfade, Hook-Fehler-Banner.
- **TravelSyncBanner**: Statuswechsel (ok → error) & Buttons.

Technik: `@testing-library/dom` mit `@testing-library/user-event`. Presenter generiert DOM über `render` Helper aus `tests/ui`.

## 5. Integrationstests
- **Advance & Hook Dispatch**: Simuliere Reise mit `MockCartographerController`, `CalendarStateGateway` stub → verifiziert Eventlog und Hook-Reihenfolge.
- **Jump & Backfill**: Prüft, dass übersprungene Events geloggt & optional dispatcht.
- **Schema Migration Flow**: Bearbeiten eines Kalenders, Migration-Konflikt → UI zeigt Liste, Domain rollback.
- **Multi-Calendar Reise**: Setze globalen und reisespezifischen Kalender, Cartographer wechselt korrekt.
- **Error Recovery**: `io_error` beim Speichern → UI bleibt offen, Retry sendet neuen Write.

## 6. Regressionstests
- Nachstellung bekannter Bugs: Reise mit Feiertagen & Marktterminen (Fixture) → Advance + Jump.
- Negative Sprünge (zurück in der Zeit) – sicherstellen, dass Eventlog korrekt abwärts sortiert.
- Doppelte Regeln: Speichern blockiert, Accept Conflict Option testet `conflict`-Pfad.

## 7. Testdaten-Fixtures
| Datei | Inhalt | Nutzung |
| --- | --- | --- |
| `fixtures/gregorian.ts` | 7-Tage-Woche, 12 Monate, Sample Events (Feiertage, Märkte). | Basis für Standardtests. |
| `fixtures/ten-day-calendar.ts` | 10-Tage-Woche, 8 Monate, Schaltmonat alle 5 Jahre. | Edge Cases für Arithmetik. |
| `fixtures/events-complex.ts` | 6 Ereignistypen: single future/past, recurring annual, monthly position, weekly, custom hook. | Recurrence & Filtertests. |
| `fixtures/travel-route.ts` | Reise Setup mit Checkpoints, Hook-Dummy. | Integration mit Cartographer. |

## 8. Akzeptanzkriterien-Matrix
| Use Case | Tests |
| --- | --- |
| Aktiven Kalender wählen | `mode/dashboard-presenter.spec.ts` (Dropdown), `integration/travel-sync.spec.ts` (Reise-Override) |
| Neuen Kalender anlegen | `mode/calendar-form.spec.ts` (Validation), `persistence/calendar-repository.spec.ts` (Create/Activate) |
| Ereignis anlegen (einmalig) | `mode/event-form-single.spec.ts`, `persistence/event-repository.spec.ts` |
| Ereignis anlegen (wiederkehrend) | `mode/event-form-recurring.spec.ts`, `domain/recurrence-engine.spec.ts` |
| Zeit fortschreiten | `mode/time-advance-dialog.spec.ts`, `integration/advance-hooks.spec.ts` |
| Datum setzen/jump | `mode/time-jump-dialog.spec.ts`, `integration/jump-backfill.spec.ts` |
| Ereignisliste filtern/suchen | `mode/event-manager.spec.ts`, `domain/filtering.spec.ts` |
| Kalender bearbeiten | `mode/calendar-form.spec.ts` (Migration-Vorschau), `domain/schema-migration.spec.ts` |
| Reise-Sync | `integration/travel-sync.spec.ts`, `cartographer/calendar-hook.spec.ts` |

## 9. Accessibility & i18n Tests
- `a11y` Smoke Tests via `axe-core` (wenn verfügbar) auf modalen Dialogen.
- Snapshot der `aria-labels` und Fokus-Reihenfolge.
- `i18n` Mock (Switch Sprache) → Buttons/Texte nutzen Keys.

## 10. Tooling & Automation
- npm Script `npm run test:calendar` (TODO) bündelt relevante Suites.
- CI: Tests parallelisieren (Domain vs UI) über Vitest Workspaces.
- Optional: `npm run storybook:snapshots` für visuelle Regression.

## 11. TODO Reihenfolge
1. Fixtures erstellen (`tests/apps/calendar/fixtures/*`).
2. Domain-Unit-Tests (Arithmetik, Recurrence, Migration).
3. Repository/Gateway Tests.
4. Presenter/UI Tests.
5. Integration & Regression.
6. Accessibility/i18n Checks.
7. Storybook/Visual Tests (falls Tooling bereitsteht).

Assumption: Bestehende Test-Hilfen (`tests/ui/render.ts`) können wiederverwendet werden; falls nicht, Analoge aus `apps/library` adaptieren.
