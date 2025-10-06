# Calendar Workmode – Implementierungsplan
Dieser Plan fasst die anstehenden Arbeitsschritte für den neuen Calendar-Workmode zusammen und beschreibt Architektur, Abhängigkeiten sowie Testanker im Austausch mit bestehenden Apps (insbesondere Cartographer).

## Problem
- Reisen im Cartographer benötigen eine robuste Zeitleiste, die Tagesfortschritt und Ereignisse abbildet – sowohl im regulären Workmode als auch in einem kompakten Travel-Leaf.
- Spielleitungen wünschen sich mehrere, frei definierbare Kalender (z.B. 10-Tage-Wochen, abweichende Feiertage) mit einer klaren Manager-Ansicht, die wie bekannte Kalender-Apps (Google Calendar) navigierbar ist.
- Ereignisse können wiederkehrend (Feiertage, Markttermine) oder einmalig (Story-Meilensteine) sein und sollten zentral gepflegt, durchsucht und gefiltert werden.
- Aktuell fehlt ein Ort, der aktuelle Tagesinformationen, anstehende Ereignisse, Default-Kalender-Auswahl und Calendar-spezifische Aktionen bündelt.

## Ziel
- Bereitstellen eines Calendar-Workmodes innerhalb der Apps-Schicht, der sich nahtlos in `CartographerController` einklinkt und dort den Zeitfortschritt steuert.
- Ermöglichen, eigene Kalender zu definieren, inklusive benutzerdefinierter Monate, Wochenlängen, Schaltregeln und Default-Markierung (global oder reisespezifisch).
- Verwaltung sowohl wiederkehrender als auch einmaliger Ereignisse mit klaren Persistenz-, Vorschau- und Trigger-Regeln.
- Anzeige eines Dashboards, eines vollformatigen Kalender-Managers (Kalenderansicht & Übersicht) sowie eines Travel-Leaves mit anpassbaren Zoomstufen (Monat, Woche, Tag, Nächste Ereignisse) und Quick-Actions.

## Lösung
### Architekturüberblick
1. **Domain-Layer (`src/apps/calendar/domain`)**
   - Enthält `CalendarSchema` (Monate, Wochen, Schaltjahre) sowie `CalendarEvent` (Recurring vs. Single) mit Default-Flag-Support.
   - Stellt Services zum Berechnen des nächsten Ereignisses, Normalisieren von Datumsangaben, Fortschreiben der Zeit und Ermitteln der Zoom-Ansichten bereit (Aggregationen für Monat/Woche/Tag).
   - Nutzt Hilfen aus `core/time`; bei Bedarf wird ein dedizierter Zeitservice für Mehrkalenderlogik eingeführt.

2. **Persistence & Integration**
   - Nutzung von `core/persistence` (z.B. `JsonStore`) für Kalenderdefinitionen, Event-Sammlungen, Default-Status und Travel-Lean-State.
   - Schnittstelle `CalendarStateGateway`, die Cartographer-Reisen Zugriff auf aktiven/globalen Default, aktuelles Datum und Travel-Leaf-Status gibt.
   - Synchronisationspunkte mit `apps/cartographer/travel` (z.B. beim Start einer Reise Travel-Leaf öffnen, bei Zeitsprüngen Ereignisse prüfen).

3. **UI/Workmode Layer (`src/apps/calendar/mode`)**
   - Presenter rendert Dashboard mit aktuellem Datum, kommenden Ereignissen und Quick-Actions.
   - Kalender-Manager verfügt über zwei Modi: **Kalenderansicht** (Grid mit Monat/Woche/Tag, Inline-Erstellung, Tooltips) und **Kalender-Übersicht** (Filter- und Listenansicht ähnlich `apps/library`).
   - Editor-Dialoge für Kalenderdefinition und Eventverwaltung nutzen Patterns aus `apps/library` (Modal/Edit-Flow) und beinhalten Default-Toggle.
   - Travel-Kalender als eigenes Leaf mit kompakten Layouts für Monat/Woche/Tag/Nächste Ereignisse, synchronisiert mit Cartographer.

4. **Event Engine**
   - Wiederkehrende Ereignisse bekommen Regeln (z.B. `repeat: { type: "annual", offset: dayOfYear }` oder Custom-Hooks) mit Zoom-abhängigen Abfragen.
  - Einmalige Ereignisse speichern absolutes Datum im Kontext des Kalenders.
   - Engine löst Hooks aus, die Cartographer konsumiert (z.B. „Reise erreicht Feiertag“); Travel-Leaf zeigt Resultate.

5. **Inspirationsquelle**
   - Das vorhandene `calendarium/main.js` dient als Referenz für Eventmodelle, UI-Flows und Persistenz. Teile werden modularisiert und in TypeScript übertragen.

### Phasenplan
1. **Phase 1 – Domain-Grundlage & Datenmodelle**
   - Definiere `CalendarSchema`, `CalendarDate`, `CalendarEvent`, `RepeatRule`, Default-Markierungen.
   - Implementiere Normalisierungs- und Vergleichslogik inkl. Zoom-Range-Generatoren.
   - Schreibe Unit-Tests (Vitest) für Berechnungen (inkl. Kantenfälle wie Monatsüberläufe, 10-Tage-Wochen).
   - Deliverable: Domain-Module + Tests, noch keine UI.

2. **Phase 2 – Persistenz & Gateway**
   - Erstelle `CalendarRepository` (Persistenz) und `CalendarStateGateway` inkl. Default-Handling (global & Reise), Travel-Leaf-State.
   - Implementiere Laden/Speichern mehrerer Kalender, Default-Konsistenz (nur ein globaler Default) und Zuordnung aktiver Kalender zur Reise.
   - Integrationstests gegen Mock-Dateisystem (analog zu `tests/apps/cartographer`).
   - Deliverable: Persistente Speicherung + API für andere Apps, Protokoll in README/AGENTS.

3. **Phase 3 – Workmode UI & Interaktion**
   - Baue Calendar-Dashboard, Manager (Kalenderansicht + Übersicht) und Eventmanager inklusive Default-Toggles.
   - Ergänze Dialoge für Kalenderdefinition/Eventverwaltung, Zoom-Toolbar, Filter, Inline-Erstellung.
   - Stelle Quick-Actions bereit, die den Zeitservice nutzen und Cartographer benachrichtigen.
   - Schreibe UI-nahe Tests (Presenter) und Storybook-/Screenshot-Anker falls vorhanden.

4. **Phase 4 – Cartographer-Integration & Travel-Leaf**
   - Verknüpfe Workmode mit `CartographerController` (Modedeskriptor, Lazy-Load) und registriere Travel-Leaf (mount/unmount beim Reise-Start/-Ende).
   - Synchronisiere Reisezeitfortschritt: `advanceTime`-Aufrufe aktualisieren Domain, Travel-Leaf und Manager; Ereignisse lösen Hooks aus.
   - Ergänze Regressionstests, die Reiseabläufe mit Default-Wechseln simulieren.
   - Dokumentiere neue Commands, Settings und UI-Flows.

5. **Phase 5 – Polish & Observability**
   - Logging, Telemetry-Hooks (Leaf-Lifecycle, Zoom-Performance), Fehlermeldungen.
   - UX-Optimierungen (Filter für Ereignisse, Suche, Shortcut-Konsistenz) und Accessibility-Check.
   - Aktualisiere `apps/README.md`, Release-Notes, Screenshots.

## UI- & Workflow-Spezifikation
- Detailangaben zu Layout, Komponenten und Workflows sind in [`mode/UX_SPEC.md`](./mode/UX_SPEC.md), [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md), [`mode/COMPONENTS.md`](./mode/COMPONENTS.md) und [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md) erfasst.
- API-Contracts und Persistenzverträge sind in [`mode/API_CONTRACTS.md`](./mode/API_CONTRACTS.md) dokumentiert.
- Fehler- und Leerstaaten sowie Telemetrieanforderungen sind in den folgenden Abschnitten zusammengefasst und verlinken auf die Detaildokumente.

### Workflow-Überblick
| Workflow | Ziel | Primärer Trigger | Domain-Auswirkungen | Referenz |
| --- | --- | --- | --- | --- |
| Aktiven Kalender wählen | Reise/Globalem Kontext einen Kalender zuordnen | Dropdown/Command | Aktualisiert `activeCalendarId` (global oder Reise) | [UX Spec §3.1](./mode/UX_SPEC.md#31-aktiven-kalender-waehlen) |
| Default-Kalender verwalten | Globalen bzw. reisespezifischen Default setzen | Toggle im Formular, Kontextmenü | Aktualisiert `defaultCalendarId` (global/reise), migriert Fallbacks | [UX Spec §3.2](./mode/UX_SPEC.md#32-default-kalender-verwalten) |
| Kalender-Manager – Modus wechseln | Zwischen Kalenderansicht und Übersicht wechseln | Tabs oder Toolbar | Aktualisiert `managerViewMode`, lädt entsprechende Datensätze | [UX Spec §3.3](./mode/UX_SPEC.md#33-kalender-manager--modus-wechseln) |
| Neuen Kalender anlegen | Schema konfigurieren & persistieren | CTA „Kalender anlegen“ | Erstellt Schema + Default-Status optional | [UX Spec §3.4](./mode/UX_SPEC.md#34-neuen-kalender-anlegen) |
| Ereignis anlegen – einmalig | Einmaliges Datum pflegen | CTA „Ereignis hinzufügen“ → „Einmalig“ | Schreibt `CalendarEventSingle` | [UX Spec §3.5.1](./mode/UX_SPEC.md#351-ereignis-anlegen--einmalig) |
| Ereignis anlegen – wiederkehrend | Regelbasierte Events abbilden | CTA „Ereignis hinzufügen“ → „Wiederkehrend“ | Schreibt `CalendarEventRecurring` | [UX Spec §3.5.2](./mode/UX_SPEC.md#352-ereignis-anlegen--wiederkehrend) |
| Zeit fortschreiten | Zeitlinie anpassen & Events prüfen | Quick-Action oder Cartographer-Hook | Mutiert `currentDate`, generiert `triggeredEvents` | [UX Spec §3.6](./mode/UX_SPEC.md#36-zeit-fortschreiten) |
| Datum setzen/jump | Direktes Datum mit Konfliktauflösung setzen | Quick-Action „Datum setzen“ | Setzt `currentDate`, markiert übersprungene Events | [UX Spec §3.7](./mode/UX_SPEC.md#37-datum-setzenjump) |
| Ereignisliste filtern/suchen | Überblick fokussieren | Filterpanel/Quick-Filter | Anpassung von `eventListFilter` | [UX Spec §3.8](./mode/UX_SPEC.md#38-ereignisliste-filternsuchen) |
| Kalender bearbeiten | Schema und Events migrieren | Aktion „Bearbeiten“ | Aktualisiert Schema, führt Migration aus | [UX Spec §3.9](./mode/UX_SPEC.md#39-kalender-bearbeiten) |
| Travel-Kalender anzeigen | Kompaktes Leaf synchronisieren | Reise startet/endet, Leaf-Toolbar | Aktualisiert `travelLeafMode`, `travelLeafVisible` | [UX Spec §3.10](./mode/UX_SPEC.md#310-travel-kalender) |
| Reise-Sync (Cartographer) | Cartographer-Timehooks bedienen | Cartographer `advanceTime` | Bidirektionaler Sync, UI-Feedback | [UX Spec §3.11](./mode/UX_SPEC.md#311-reise-sync-cartographer) |

### Ablaufdiagramme & Zustände
- Textuelle Ablaufdiagramme für alle obenstehenden Workflows befinden sich in [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md#ablaufdiagramme) und ergänzen die UI-Perspektive aus [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md).
- State-Slices (`calendarState`, `managerUiState`, `travelLeafState`) und Events sind im selben Dokument abgebildet und dienen als Grundlage für Presenter-Implementierungen.

### Akzeptanzkriterien (Kurzform)
- **Aktiven Kalender wählen**
  - [ ] Given ein aktiver Reise- oder globaler Kontext, When Nutzer:in einen Kalender wählt, Then Dashboard/Travel-Leaf aktualisiert und Auswahl bleibt persistent.
  - [ ] Given keine Kalender existieren, When Nutzer:in das Dropdown öffnet, Then erscheint Leerstaat mit CTA „Kalender anlegen“.
- **Default-Kalender verwalten**
  - [ ] Given ein Kalender ist nicht Default, When Toggle „Als Standard festlegen“ aktiviert wird, Then entzieht das System ggf. anderen Kalendern den Default-Status und speichert den neuen Default.
  - [ ] Given ein Reise-spezifischer Default existiert, When Reise-Default gelöscht wird, Then UI fordert Auswahl eines neuen Defaults oder fallbackt auf globalen Default.
- **Kalender-Manager – Modus wechseln**
  - [ ] Given Manager ist geöffnet, When Nutzer:in zwischen „Kalenderansicht“ und „Übersicht“ wechselt, Then UI lädt entsprechende Daten ohne Reset anderer Filter.
  - [ ] Given schmale Pane-Breite, When Manager in Kalenderansicht, Then Zoom-Toolbar wird auf Icon-only Darstellung reduziert.
- **Neuen Kalender anlegen**
  - [ ] Given Pflichtfelder valide, When gespeichert, Then entsteht persistierter Eintrag und optional Default-Status.
  - [ ] Given ungültige Parameter, When Speichern, Then erscheinen Inline-Fehler und Persistenz bleibt unverändert.
- **Ereignis anlegen – einmalig**
  - [ ] Given gültiges Datum, When gespeichert, Then erscheint in „Alle“ & „Kommend“ (falls zukünftig) mit Schema-basiertem Format.
  - [ ] Given Datum liegt vor aktuellem Tag, When gespeichert, Then markiert als „Vergangen“ und optional nacharbeiten.
- **Ereignis anlegen – wiederkehrend**
  - [ ] Given gültige Wiederholungsregel, When gespeichert, Then Vorschau zeigt nächste fünf Vorkommen korrekt für aktuelles Schema.
  - [ ] Given kollidierende Regel, When gespeichert, Then UI warnt und verlangt Bestätigung oder Abbruch.
- **Zeit fortschreiten**
  - [ ] Given Quick-Actions oder Cartographer-Trigger, When Zeit voranschreitet, Then `currentDate` angepasst, Travel-Leaf aktualisiert, ausgelöste Events erscheinen im Log.
  - [ ] Given Hooks registriert, When Zeit fortschreitet, Then werden alle Hooks exakt einmal dispatcht.
- **Datum setzen/jump**
  - [ ] Given Ziel-Datum, When gesetzt, Then übersprungene Events werden gelistet und optional nachträglich ausgelöst.
  - [ ] Given Datum außerhalb Schema, When bestätigt, Then blockiert Validierung und verweist auf Schema-Anpassung.
- **Ereignisliste filtern/suchen**
  - [ ] Given Filterkriterien, When angewendet, Then reagiert Liste in Echtzeit und Filter bleiben Sitzungs-lokal gespeichert.
  - [ ] Given keine Treffer, When Filter aktiv, Then erscheint Leerstaat mit Option Filter zurückzusetzen.
- **Kalender bearbeiten**
  - [ ] Given Schemaänderung, When gespeichert, Then werden Ereignisse migriert oder mit Konfliktliste versehen.
  - [ ] Given Migration schlägt fehl, When bestätigt, Then wird nichts persistiert und UI zeigt Fehlerdetails.
- **Travel-Kalender anzeigen**
  - [ ] Given Reisemodus startet, When Calendar-Module reagiert, Then wird Travel-Leaf automatisch geöffnet und zeigt synchronisierte Daten.
  - [ ] Given Reisemodus endet, When Signal empfangen, Then Leaf schließt sich und Zustand wird persistiert.
- **Reise-Sync (Cartographer)**
  - [ ] Given Cartographer `advanceTime`, When aufgerufen, Then Calendar-UI und Travel-Panel zeigen identische Ereignisbenachrichtigungen.
  - [ ] Given Calendar meldet Fehler, When Sync läuft, Then Cartographer erhält Fehlercode und UI zeigt Hinweis.

## Fehler- & Leerstaaten
- Vollständige Texte, Icons und Wiederherstellungsaktionen siehe [`mode/UX_SPEC.md#4-fehler-und-leerstaaten`](./mode/UX_SPEC.md#4-fehler-und-leerstaaten) sowie Travel-spezifische Varianten in [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md#travel-leaf).
- Persistenzfehler (`io_error`) lösen Banner mit Retry aus; Validierungsfehler erscheinen Inline in Formularen. Travel-Leaf zeigt kompaktes Banner mit Close-Action.
- Leerstaaten für „keine Kalender“, „keine Events“, „keine kommenden Events“ enthalten primäre CTA (z.B. „Kalender anlegen“) und Sekundärlinks zu Dokumentation; Travel-Leaf nutzt verkürzte Texte.

## Accessibility & Internationalisierung
- Fokus- und Tastaturnavigation folgen Vorgaben in [`mode/UX_SPEC.md#5-accessibility`](./mode/UX_SPEC.md#5-accessibility) inklusive Travel-Leaf (Focus-Trap beim Öffnen, Shortcuts für Zoom).
- Texte verwenden `i18n`-Keys (`calendar.mode.*`, `calendar.travel.*`) und berücksichtigen Mehrzahlformen sowie Schema-spezifische Datumsformate; numerische Formate hängen vom Kalender ab, nicht vom Systemlocale.
- Farbkontraste nutzen bestehende `ui/tokens` (High-Contrast-Theme) und sind in den Komponenten-Spezifikationen verankert; Travel-Leaf verwendet komprimierte Typografie mit Mindestkontrast 4.5:1.

## Edge Cases & Performance
- Unterstützt flexible Wochenlängen (z.B. 10 Tage), variable Monatsanzahlen inklusive Schaltmonate sowie optional unregelmäßige Monate in Kalenderansicht (siehe [`mode/API_CONTRACTS.md#schemas`](./mode/API_CONTRACTS.md#schemas)).
- Default-Handling: Migration beim Löschen eines Default-Kalenders (globaler Fallback, Reise-Fallback) inklusive Benutzeraufforderung; Travel-Leaf zeigt Hinweis wenn kein Default verfügbar.
- Zeitfortschritt erlaubt negative Werte (Rücksprung) und mehrfache Tage/Wochen; Event-Engine verarbeitet große Sprünge durch chunked Verarbeitung (Fenstergröße 365 Tage, konfigurierbar) und caches pro Zoom-Level.
- Doppelregeln werden durch Normalisierung erkannt; Konfliktauflösung via Merge-Dialog dokumentiert in [`mode/UX_SPEC.md#39-kalender-bearbeiten`](./mode/UX_SPEC.md#39-kalender-bearbeiten).
- Performance: Vorschau zukünftiger Vorkommen berechnet maximal 24 Monate im Voraus (konfigurierbar) und cached Ergebnisse pro Schema/Rule-Hash; Travel-Leaf lädt initial 30 Tage, weitere Einträge lazy bei Scroll.

## Telemetrie & Observability
- Loggingpunkte: Zeitfortschritt (`calendar.time.advance`), Schema-Migration (`calendar.schema.migrate`), Event-Konflikte (`calendar.event.conflict`), Default-Umschaltung (`calendar.default.change`), Travel-Leaf Lifecycle (`calendar.travel.leaf_mount`).
- Metriken: Anzahl ausgelöster Events pro Advance, Dauer der Ereignisberechnung je Zoom-Level, Fehlerquote pro Operation, Anzahl Default-Wechsel pro Sitzung.
- Fehlertracking: persistente io-Fehler werden mit Kontext (`calendarId`, `operation`, `scope` = global/reise) erfasst; Hook-Dispatches melden Erfolg/Fehlschlag an Cartographer (siehe [`mode/API_CONTRACTS.md#cartographer-hooks`](./mode/API_CONTRACTS.md#cartographer-hooks)). Travel-Leaf meldet Renderdauer und Shortcut-Nutzung.

## Dokumentverweise & Testplanung
- Teststrategie detailliert in [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md); bildet Use-Cases, neue Modi (Kalenderansicht/Übersicht/Travel) und Regressionen ab.
- Komponenten- und API-Verträge sind in den Mode-Unterdokumenten verknüpft, Implementierende folgen der Reihenfolge Domain → Repository/Gateway → Presenter/Components → Mode-Integration → Tests → Polish.

## TODO-Reihenfolge (Implementierungsleitfaden)
1. Domain-Modelle und Regeln implementieren (`src/apps/calendar/domain`).
2. Persistenzschicht + Gateways (`CalendarRepository`, `CalendarStateGateway`, Default-Migrationen).
3. Cartographer-Hooks erweitern (`apps/cartographer/travel` Integration vorbereiten, Travel-Leaf mounten).
4. UI-Komponenten gemäß [`mode/COMPONENTS.md`](./mode/COMPONENTS.md) bauen (Kalenderansicht, Übersichtslisten, Travel-Leaf).
5. Presenter & Mode-Wiring (`CalendarModePresenter`, `CalendarManagerPresenter`, `TravelCalendarPresenter`).
6. Tests laut [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md) schreiben (Domain, Gateway, UI, Travel).
7. Observability & Polish (Telemetrie, Dokumentation, Übersetzungen).

## Offene Fragen
- Müssen Kalender global oder pro Vault gespeichert werden? (Entscheidung beeinflusst `core/persistence` und Default-Fallback).
- Wird es mehrere parallele aktive Kalender geben (z.B. Region A und B)? Falls ja, muss die Domain mehrere Zeitleisten verwalten und Default-Regeln erweitern.
- Sollen Ereignisse Automatisierungen in anderen Apps auslösen (Encounter, Library)? Evaluierung nach Phase 3.
