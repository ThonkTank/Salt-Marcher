# Calendar Workmode – Implementierungsplan
Dieser Plan fasst die anstehenden Arbeitsschritte für den neuen Calendar-Workmode zusammen und beschreibt Architektur, Abhängigkeiten sowie Testanker im Austausch mit bestehenden Apps (insbesondere Cartographer).

## Problem
- Reisen im Cartographer benötigen eine robuste Zeitleiste, die Tagesfortschritt und Ereignisse abbildet.
- Spieler:innen wünschen sich mehrere, frei definierbare Kalender (z.B. 10-Tage-Wochen, abweichende Feiertage) statt eines festen gregorianischen Schemas.
- Ereignisse können wiederkehrend (Feiertage, Markttermine) oder einmalig (Story-Meilensteine) sein und sollten zentral gepflegt werden.
- Aktuell fehlt ein Ort, der aktuelle Tagesinformationen, anstehende Ereignisse und Calendar-spezifische Aktionen bündelt.

## Ziel
- Bereitstellen eines Calendar-Workmodes innerhalb der Apps-Schicht, der sich nahtlos in `CartographerController` einklinkt und dort den Zeitfortschritt steuert.
- Ermöglichen, eigene Kalender zu definieren, inklusive benutzerdefinierter Monate, Wochenlängen und Feiertage.
- Verwaltung sowohl wiederkehrender als auch einmaliger Ereignisse mit klaren Persistenz- und Trigger-Regeln.
- Anzeige eines kompakten Dashboards mit aktuellem Datum, anstehenden Ereignissen und Quick-Actions für Zeitvor- und -rücksprünge.

## Lösung
### Architekturüberblick
1. **Domain-Layer (`src/apps/calendar/domain`)**
   - Enthält `CalendarSchema` (Monate, Wochen, Schaltjahre) sowie `CalendarEvent` (Recurring vs. Single).
   - Stellt Services zum Berechnen des nächsten Ereignisses, Normalisieren von Datumsangaben und Fortschreiben der Zeit bereit.
   - Nutzt ggf. vorhandene Hilfen aus `core/time` (falls nicht vorhanden, wird ein dedizierter Zeitservice eingeführt).

2. **Persistence & Integration**
   - Nutzung von `core/persistence` (z.B. `JsonStore`) für benutzerdefinierte Kalenderdefinitionen und Event-Sammlungen.
   - Schnittstelle `CalendarStateGateway`, die Cartographer-Reisen Zugriff auf den aktiven Kalender und aktuelle Zeit gibt.
   - Synchronisationspunkte mit `apps/cartographer/travel` (z.B. beim Start einer Reise den aktiven Kalender laden, bei Zeitsprüngen Ereignisse prüfen).

3. **UI/Workmode Layer (`src/apps/calendar/mode`)**
   - Presenter, der das Dashboard rendert: aktuelles Datum, Liste bevorstehender Ereignisse, Buttons für „Tag voran“, „Woche voran“, „Zeit setzen“.
   - Editor-Dialoge für Kalenderdefinitionen und Eventverwaltung, inspiriert von vorhandenen Patterns aus `apps/library` (Modal/Edit-Flow).
   - Re-usable UI-Bausteine nutzen Komponenten aus `src/ui` (z.B. Tables, Buttons, Toggles).

4. **Event Engine**
   - Wiederkehrende Ereignisse bekommen Regeln (z.B. `repeat: { type: "annual", offset: dayOfYear }`).
   - Einmalige Ereignisse speichern absolutes Datum im Kontext des Kalenders.
   - Engine löst Hooks aus, die Cartographer konsumiert (z.B. „Reise erreicht Feiertag“).

5. **Inspirationsquelle**
   - Das vorhandene `calendarium/main.js` dient als Referenz für Eventmodelle, UI-Flows und Persistenz. Teile werden modularisiert und in TypeScript übertragen.

### Phasenplan
1. **Phase 1 – Domain-Grundlage & Datenmodelle**
   - Definiere `CalendarSchema`, `CalendarDate`, `CalendarEvent` Typen.
   - Implementiere Normalisierungs- und Vergleichslogik.
   - Schreibe Unit-Tests (Vitest) für Berechnungen (inkl. Kantenfälle wie Monatsüberläufe).
   - Deliverable: Domain-Module + Tests, noch keine UI.

2. **Phase 2 – Persistenz & Gateway**
   - Erstelle `CalendarRepository` (Persistenz) und `CalendarStateGateway` für Cartographer.
   - Implementiere Laden/Speichern von mehreren Kalendern und Zuordnung eines aktiven Kalenders zur Reise.
   - Integrationstests gegen Mock-Dateisystem (analog zu bestehenden Tests in `tests/apps/cartographer`).
   - Deliverable: Persistente Speicherung + API für andere Apps, Protokoll in README/AGENTS.

3. **Phase 3 – Workmode UI & Interaktion**
   - Baue den Calendar-Workmode mit Dashboard, Navigation und Eventlisten.
   - Ergänze Dialoge für Kalenderdefinition und Eventverwaltung (wiederkehrend & einmalig).
   - Stelle Quick-Actions bereit, die den Zeitservice nutzen und Cartographer benachrichtigen.
   - Schreibe UI-nahe Tests (z.B. Presenter-Tests) und Storybook-/Screenshot-Anker falls vorhanden.

4. **Phase 4 – Cartographer-Integration & Reisezeit**
   - Verknüpfe den Workmode mit `CartographerController` (Modedeskriptor, Lazy-Load).
   - Synchronisiere Reisezeitfortschritt: `advanceTime`-Aufrufe aktualisieren Domain, lösen Ereignisse aus und melden Feedback ins Travel-UI.
   - Ergänze Regressionstests, die Reiseabläufe mit Ereignissen simulieren.
   - Dokumentiere neue Commands, Settings und UI-Flows.

5. **Phase 5 – Polish & Observability**
   - Logging, Telemetry-Hooks (falls vorhanden), Fehlermeldungen.
   - UX-Optimierungen (Filter für Ereignisse, Search) und Accessibility-Check.
   - Aktualisiere `apps/README.md`, Release-Notes, Screenshots.

## Tests
- **Phase 1:** Vitest-Unit-Tests für Kalenderarithmetik und Ereignisberechnung (`tests/apps/calendar/domain.spec.ts`).
- **Phase 2:** Persistenz-Mocks + Integrationstests (`tests/apps/calendar/persistence.spec.ts`).
- **Phase 3:** Presenter-Tests (z.B. mit DOM-Adapter oder Snapshot) + Interaktions-Mocks.
- **Phase 4:** Ende-zu-Ende-ähnliche Tests, die Cartographer-Reisen mit aktivem Kalender simulieren.
- **Phase 5:** Manuelle Tests in Obsidian-Sandbox, ggf. visuelle Regressionen.

## Offene Fragen
- Müssen Kalender global oder pro Vault gespeichert werden? (Entscheidung beeinflusst `core/persistence`).
- Wird es mehrere parallele aktive Kalender geben (z.B. Region A und B)? Falls ja, muss die Domain mehrere Zeitleisten verwalten.
- Sollen Ereignisse Automatisierungen in anderen Apps auslösen (Encounter, Library)? Evaluierung nach Phase 3.
