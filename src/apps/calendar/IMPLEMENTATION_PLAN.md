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

## UI- & Workflow-Spezifikation
- Detailangaben zu Layout, Komponenten und Workflows sind in [`mode/UX_SPEC.md`](./mode/UX_SPEC.md), [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md), [`mode/COMPONENTS.md`](./mode/COMPONENTS.md) und [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md) erfasst.
- API-Contracts und Persistenzverträge sind in [`mode/API_CONTRACTS.md`](./mode/API_CONTRACTS.md) dokumentiert.
- Fehler- und Leerstaaten sowie Telemetrieanforderungen sind in den folgenden Abschnitten zusammengefasst und verlinken auf die Detaildokumente.

### Workflow-Überblick
| Workflow | Ziel | Primärer Trigger | Domain-Auswirkungen | Referenz |
| --- | --- | --- | --- | --- |
| Aktiven Kalender wählen | Reise/Globalem Kontext einen Kalender zuordnen | Nutzer:in öffnet Dropdown/Command | Aktualisiert `activeCalendarId` im Gateway | [UX Spec §3.1](./mode/UX_SPEC.md#31-aktiven-kalender-waehlen) |
| Neuen Kalender anlegen | Schema konfigurieren & persistieren | CTA „Kalender anlegen“ | Erstellt Schema + Standardereignisse | [UX Spec §3.2](./mode/UX_SPEC.md#32-neuen-kalender-anlegen) |
| Ereignis anlegen – einmalig | Einmaliges Datum pflegen | CTA „Ereignis hinzufügen“ → „Einmalig“ | Schreibt `CalendarEventSingle` | [UX Spec §3.3.1](./mode/UX_SPEC.md#331-ereignis-anlegen-einmalig) |
| Ereignis anlegen – wiederkehrend | Regelbasierte Events abbilden | CTA „Ereignis hinzufügen“ → „Wiederkehrend“ | Schreibt `CalendarEventRecurring` | [UX Spec §3.3.2](./mode/UX_SPEC.md#332-ereignis-anlegen-wiederkehrend) |
| Zeit fortschreiten | Zeitlinie anpassen & Events prüfen | Quick-Action oder Cartographer-Hook | Mutiert `currentDate`, generiert `triggeredEvents` | [UX Spec §3.4](./mode/UX_SPEC.md#34-zeit-fortschreiten) |
| Datum setzen/jump | Direktes Datum mit Konfliktauflösung setzen | Quick-Action „Datum setzen“ | Setzt `currentDate`, markiert übersprungene Events | [UX Spec §3.5](./mode/UX_SPEC.md#35-datum-setzenjump) |
| Ereignisliste filtern/suchen | Überblick fokussieren | Filterpanel/Quick-Filter | Anpassung von `eventListFilter` | [UX Spec §3.6](./mode/UX_SPEC.md#36-ereignisliste-filternsuchen) |
| Kalender bearbeiten | Schema und Events migrieren | Aktion „Bearbeiten“ | Aktualisiert Schema, führt Migration aus | [UX Spec §3.7](./mode/UX_SPEC.md#37-kalender-bearbeiten) |
| Reise-Sync | Cartographer-Timehooks bedienen | Cartographer `advanceTime` | Bidirektionaler Sync, UI-Feedback | [UX Spec §3.8](./mode/UX_SPEC.md#38-reise-sync-cartographer) |

### Ablaufdiagramme & Zustände
- Textuelle Ablaufdiagramme für alle obenstehenden Workflows befinden sich in [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md#ablaufdiagramme) und ergänzen die UI-Perspektive aus [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md).
- State-Slices (`calendarState`, `uiState`) und Events sind im selben Dokument abgebildet und dienen als Grundlage für Presenter-Implementierungen.

### Akzeptanzkriterien (Kurzform)
- **Aktiven Kalender wählen**
  - [ ] Given ein aktiver Reise- oder globaler Kontext, When ein:e Nutzer:in einen Kalender aus dem Dropdown wählt, Then wird `activeCalendarId` persistiert und das Dashboard aktualisiert.
  - [ ] Given kein Kalender vorhanden, When Nutzer:in versucht zu wählen, Then erscheint der Leerstaat mit CTA „Kalender anlegen“.
- **Neuen Kalender anlegen**
  - [ ] Given der Kalender-Manager ist geöffnet, When Pflichtfelder (Name, Wochenlänge, Monate) valide ausgefüllt sind und Speichern ausgelöst wird, Then entsteht ein persistierter Eintrag und der Manager schließt sich mit Erfolgsmeldung.
  - [ ] Given ungültige Parameter (z.B. Wochenlänge 0), When Speichern ausgelöst wird, Then erscheinen Inline-Fehler und der Eintrag wird nicht gespeichert.
- **Ereignis anlegen – einmalig**
  - [ ] Given ein Kalender ist aktiv, When ein einmaliges Ereignis mit gültigem Datum gespeichert wird, Then erscheint es in „Alle“ und ggf. „Kommend“ mit korrekter Sortierung.
  - [ ] Given das Datum liegt vor dem aktuellen Tag, When gespeichert, Then wird es als „vergangenes Ereignis“ markiert und nicht in „Kommend“ gezeigt.
- **Ereignis anlegen – wiederkehrend**
  - [ ] Given ein gültiges Wiederholungsregel-Setup, When gespeichert, Then berechnet die Vorschau die nächsten fünf Vorkommen korrekt.
  - [ ] Given eine kollidierende Regel (z.B. doppelt identische), When gespeichert, Then warnt das UI und verlangt Bestätigung oder Abbruch.
- **Zeit fortschreiten**
  - [ ] Given Quick-Actions oder Cartographer-Trigger, When Zeit voranschreitet, Then wird `currentDate` angepasst und ausgelöste Ereignisse werden im Ereignislog angezeigt.
  - [ ] Given ausgelöste Ereignisse besitzen Hooks, When Zeit fortschreitet, Then werden alle zugehörigen Hooks exakt einmal dispatcht.
- **Datum setzen/jump**
  - [ ] Given ein Ziel-Datum, When gesetzt wird, Then werden übersprungene Ereignisse im Dialog gelistet und optional nachträglich ausgelöst.
  - [ ] Given ein Datum außerhalb des Schema-Range, When bestätigt, Then blockiert Validierung und verweist auf Schema-Anpassung.
- **Ereignisliste filtern/suchen**
  - [ ] Given Filterkriterien, When angewendet, Then reagiert die Liste in Echtzeit und Persistenz des Filters bleibt Sitzungslokal.
  - [ ] Given keine Treffer, When Filter aktiv, Then erscheint Leerstaat mit Option Filter zurückzusetzen.
- **Kalender bearbeiten**
  - [ ] Given Schemaänderung, When gespeichert, Then werden bestehende Ereignisse migriert oder mit Konfliktliste versehen.
  - [ ] Given Migration schlägt fehl, When bestätigt, Then wird nichts persistiert und Nutzer:in erhält Fehlerdetails.
- **Reise-Sync (Cartographer)**
  - [ ] Given Cartographer `advanceTime`, When aufgerufen, Then spiegeln Calendar-UI und Travel-Panel dieselben Ereignisbenachrichtigungen.
  - [ ] Given Calendar meldet Fehler, When Sync läuft, Then wird Cartographer mit Fehlercode versorgt und UI zeigt Hinweis.

## Fehler- & Leerstaaten
- Vollständige Texte, Icons und Wiederherstellungsaktionen siehe [`mode/UX_SPEC.md#4-fehler-und-leerstaaten`](./mode/UX_SPEC.md#4-fehler-und-leerstaaten).
- Persistenzfehler (`io_error`) lösen Banner mit Retry aus; Validierungsfehler erscheinen Inline in den Formularen.
- Leerstaaten für „keine Kalender“, „keine Events“, „keine kommenden Events“ enthalten primäre CTA (z.B. „Kalender anlegen“) und Sekundärlinks zu Doku.

## Accessibility & Internationalisierung
- Fokus- und Tastaturnavigation folgen Vorgaben in [`mode/UX_SPEC.md#5-accessibility`](./mode/UX_SPEC.md#5-accessibility).
- Texte verwenden `i18n`-Keys (`calendar.mode.*`) und berücksichtigen Mehrzahlformen; numerische Formate hängen vom Kalender ab, nicht von Systemlocale.
- Farbkontraste nutzen bestehende `ui/tokens` (High-Contrast-Theme) und sind in den Komponenten-Spezifikationen verankert.

## Edge Cases & Performance
- Unterstützt flexible Wochenlängen (z.B. 10 Tage) und variable Monatsanzahlen inklusive Schaltmonate (siehe [`mode/API_CONTRACTS.md#schemas`](./mode/API_CONTRACTS.md#schemas)).
- Zeitfortschritt erlaubt negative Werte (Rücksprung) und mehrfache Tage/Wochen; Event-Engine verarbeitet große Sprünge durch chunked Verarbeitung (Fenstergröße 365 Tage, konfigurierbar).
- Doppelregeln werden durch Normalisierung erkannt; Konfliktauflösung via Merge-Dialog dokumentiert in [`mode/UX_SPEC.md#37-kalender-bearbeiten`](./mode/UX_SPEC.md#37-kalender-bearbeiten).
- Performance: Vorschau zukünftiger Vorkommen berechnet maximal 24 Monate im Voraus und cached Ergebnisse per Schema/Rule-Hash; Lazy Evaluation im Dashboard (nur erste 10 kommenden Events).

## Telemetrie & Observability
- Loggingpunkte: Zeitfortschritt (`calendar.time.advance`), Schema-Migration (`calendar.schema.migrate`), Event-Konflikte (`calendar.event.conflict`).
- Metriken: Anzahl ausgelöster Events pro Advance, Dauer der Ereignisberechnung, Fehlerquote pro Operation.
- Fehlertracking: persistente io-Fehler werden mit Kontext (`calendarId`, `operation`) erfasst; Hook-Dispatches melden Erfolg/Fehlschlag an Cartographer (siehe [`mode/API_CONTRACTS.md#cartographer-hooks`](./mode/API_CONTRACTS.md#cartographer-hooks)).

## Dokumentverweise & Testplanung
- Teststrategie detailliert in [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md); bildet Use-Cases und Regressionen ab.
- Komponenten- und API-Verträge sind in den Mode-Unterdokumenten verknüpft, Implementierende folgen der Reihenfolge Domain → Repository/Gateway → Presenter/Components → Mode-Integration → Tests → Polish.

## TODO-Reihenfolge (Implementierungsleitfaden)
1. Domain-Modelle und Regeln implementieren (`src/apps/calendar/domain`).
2. Persistenzschicht + Gateways (`CalendarRepository`, `CalendarStateGateway`).
3. Cartographer-Hooks erweitern (`apps/cartographer/travel` Integration vorbereiten).
4. UI-Komponenten gemäß [`mode/COMPONENTS.md`](./mode/COMPONENTS.md) bauen.
5. Presenter & Mode-Wiring (`CalendarModePresenter`, Commands, Ribbons).
6. Tests laut [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md) schreiben.
7. Observability & Polish (Telemetrie, Dokumentation, Übersetzungen).

## Offene Fragen
- Müssen Kalender global oder pro Vault gespeichert werden? (Entscheidung beeinflusst `core/persistence`).
- Wird es mehrere parallele aktive Kalender geben (z.B. Region A und B)? Falls ja, muss die Domain mehrere Zeitleisten verwalten.
- Sollen Ereignisse Automatisierungen in anderen Apps auslösen (Encounter, Library)? Evaluierung nach Phase 3.
