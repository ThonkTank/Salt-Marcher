# Calendar Workmode – Implementierungsplan
Dieser Plan fasst die anstehenden Arbeitsschritte für den neuen Calendar-Workmode zusammen und beschreibt Architektur, Abhängigkeiten sowie Testanker im Austausch mit bestehenden Apps (insbesondere Cartographer).

## Problem
- Reisen im Cartographer benötigen eine robuste Zeitleiste, die Tagesfortschritt und Ereignisse abbildet – sowohl im regulären Workmode als auch in einem kompakten Travel-Leaf.
- Spielleitungen wünschen sich mehrere, frei definierbare Kalender (z.B. 10-Tage-Wochen, abweichende Feiertage) mit einer klaren Manager-Ansicht, die wie bekannte Kalender-Apps (Google Calendar) navigierbar ist.
- Ereignisse können wiederkehrend (Feiertage, Markttermine) oder einmalig (Story-Meilensteine) sein und sollten zentral gepflegt, durchsucht und gefiltert werden.
- Aktuell fehlt ein Ort, der aktuelle Tagesinformationen, anstehende Ereignisse, Default-Kalender-Auswahl und Calendar-spezifische Aktionen bündelt.
- Zusätzlich gibt es keine übergreifende Steuerzentrale („Almanac“), in der mehrere Kalender-Workmodes und ein kalenderübergreifender Events-Hub (Jahreszeiten, astronomische Phänomene, Wetter, Gezeiten) orchestriert werden.

## Ziel
- Bereitstellen eines Calendar-Workmodes innerhalb der Apps-Schicht, der sich nahtlos in `CartographerController` einklinkt und dort den Zeitfortschritt steuert.
- Ermöglichen, eigene Kalender zu definieren, inklusive benutzerdefinierter Monate, Wochenlängen, Schaltregeln und Default-Markierung (global oder reisespezifisch).
- Verwaltung sowohl wiederkehrender als auch einmaliger Ereignisse mit klaren Persistenz-, Vorschau- und Trigger-Regeln.
- Anzeige eines Dashboards, eines vollformatigen Kalender-Managers (Kalenderansicht & Übersicht) sowie eines Travel-Leaves mit anpassbaren Zoomstufen (Monat, Woche, Tag, Nächste Ereignisse) und Quick-Actions.
- Einführung eines übergreifenden „Almanac“-Workmodes als Parent-Shell, der Kalender-Flows kapselt, Moduswechsel persistiert und einen Events-Hub für kalenderübergreifende Phänomene bereitstellt.
- Aufbau eines Events-Modus, der Jahreszeiten, astronomische Ereignisse, Wetter, Gezeiten, Feiertage u. Ä. kategorisiert, mehreren Kalendern zuweist und Cartographer-Hooks orchestriert.

## Lösung
### Architekturüberblick
1. **Almanac-Shell & Mode-Orchestrierung (`src/apps/calendar/mode/almanac`)**
   - Stellt Parent-Komponenten (`AlmanacShell`, `AlmanacModeSwitcher`) bereit, die Dashboard, Manager, Events-Modus und Travel-Leaf als gleichberechtigte Modi kapseln.
   - Persistiert zuletzt genutzte Modi, Zoom-Stufen und Auswahl-Kontexte pro Leaf (z.B. `managerViewMode`, `eventsViewMode`) über `CalendarStateGateway`.
   - Steuert Lazy-Loading der einzelnen Modi, Routedaten (z.B. `?mode=events&view=timeline`) und sorgt für konsistente Breadcrumbs/Back-Targets.

2. **Domain-Layer (`src/apps/calendar/domain`)**
   - Enthält `CalendarSchema` (Monate, Wochen, Schaltjahre) sowie `CalendarEvent` (Recurring vs. Single) mit Default-Flag-Support und Links zu globalen Phänomenen.
   - Führt `AlmanacEvent`/`Phenomenon`-Modelle ein: Kategorien (Season, Astronomy, Weather, Tide, Holiday, Custom), Prioritäten, Gültigkeitsbereiche (`appliesToCalendarIds`, `visibilityRules`), Auswirkungen (`effects`).
   - Modelliert Zeitpunkte über `CalendarTimestamp` (`year`, `monthId`, `day`, `hour`, `minute`, `second?`, `precision`) inklusive Normalisierung auf Schema-spezifische Tageslängen (`hoursPerDay`, `minutesPerHour`; Default 24×60) und astronomischer Offsets (z.B. Sonnenaufgang).
   - Stellt Services zum Berechnen des nächsten Ereignisses/Phänomens, Normalisieren von Datums- und Zeitangaben, Fortschreiben der Zeit (inklusive Teil-Tages-Schritten) und Ermitteln der Zoom-Ansichten bereit (Aggregationen für Jahr/Monat/Woche/Tag/Stunde).
   - Nutzt Hilfen aus `core/time`; bei Bedarf wird ein dedizierter Zeitservice für Mehrkalenderlogik eingeführt und stellt Roll-over-Regeln (z.B. Minuten→Stunden, Stunden→Tag) schemaabhängig bereit.

3. **Persistence & Integration**
   - Nutzung von `core/persistence` (z.B. `JsonStore`) für Kalenderdefinitionen, Event-Sammlungen, Default-Status, Travel-Leaf-State und neue Almanac-Stores (`AlmanacRepository`, `PhenomenaStore`).
   - Schnittstelle `CalendarStateGateway`, die Cartographer-Reisen Zugriff auf aktiven/globalen Default, aktuelles Datum, Travel-Leaf-Status und aktive Phenomenon-Filter gibt.
   - Synchronisationspunkte mit `apps/cartographer/travel` (z.B. beim Start einer Reise Travel-Leaf öffnen, bei Zeitsprüngen Ereignisse und Phänomene prüfen; Hooks für Wetter- oder Gezeitenänderungen).

4. **UI/Workmode Layer (`src/apps/calendar/mode`)**
   - Presenter rendert Dashboard mit aktuellem Datum, kommenden Ereignissen und Quick-Actions.
   - Kalender-Manager verfügt über zwei Modi: **Kalenderansicht** (Grid mit Jahr/Monat/Woche/Tag/Stunde, Inline-Erstellung, Tooltips) und **Kalender-Übersicht** (Filter- und Listenansicht ähnlich `apps/library`).
   - Events-Modus stellt Timeline, Tabellen- und Karten-Layouts bereit, bietet Filter (Kategorie, Kalender, Auswirkungen), Bulk-Aktionen, Import/Export und Vorschauen je Kalender.
   - Editor-Dialoge für Kalenderdefinition, Eventverwaltung und Phänomen-Erstellung nutzen Patterns aus `apps/library` (Modal/Edit-Flow), beinhalten Default-Toggle, Time-Picker/All-Day-Optionen, Kategorieauswahl und Sichtbarkeitsregeln.
   - Travel-Kalender als eigenes Leaf mit kompakten Layouts für Monat/Woche/Tag/Nächste Ereignisse, inklusive fein aufgelöster Quick-Steps (`±1 Tag`, `±1 Stunde`, `±15 Minuten`) und synchronisiert mit Cartographer.

5. **Event & Phenomenon Engine**
   - Wiederkehrende Ereignisse bekommen Regeln (z.B. `repeat: { type: "annual", offset: dayOfYear }` oder Custom-Hooks) mit Zoom-abhängigen Abfragen.
   - Einmalige Ereignisse speichern absolutes Datum im Kontext des Kalenders; Phänomene können mehreren Kalendern zugewiesen werden und erben Schema-Anpassungen (z.B. Tageslänge, Stundenanzahl).
   - Engine löst Hooks aus, die Cartographer konsumiert (z.B. „Reise erreicht Feiertag“, „Wetterwechsel zu Sturm“) und priorisiert Ereignisse basierend auf Kategorie & Severity; Travel-Leaf zeigt Resultate.

6. **Inspirationsquelle**
   - Das vorhandene `calendarium/main.js` dient als Referenz für Eventmodelle, UI-Flows und Persistenz. Teile werden modularisiert und in TypeScript übertragen.

### Phasenplan
1. **Phase 1 – Domain-Grundlage & Datenmodelle**
   - Definiere `CalendarSchema`, `CalendarTimestamp` (vormals `CalendarDate`), `CalendarEvent`, `RepeatRule` sowie neue `AlmanacEvent`/`Phenomenon`-Typen inklusive Kategorie- und Sichtbarkeitsregeln.
   - Implementiere Normalisierungs- und Vergleichslogik inkl. Zoom-Range-Generatoren (Jahr/Monat/Woche/Tag/Stunde) und Roll-over-Regeln für Minuten/Stunden gemäß Schema (`hoursPerDay`, `minutesPerHour`).
   - Beschreibe Auswirkungen (`effects`) und Konfliktauflösung (Priorität, Overrides) in Domain-Services und Tests.
   - Deliverable: Domain-Module + Vitest-Unit-Tests, Dokumentation der Annahmen.

2. **Phase 2 – Persistenz & Gateways**
   - Erstelle `CalendarRepository`, `AlmanacRepository`/`PhenomenaStore` und erweitere `CalendarStateGateway` um Modus-/Filter-Persistenz und Default-Beziehungen (global + Reise).
   - Implementiere Migrationen für bestehende Daten (Default-Flag, Timestamp-Präzision, neue Almanac-Strukturen) inkl. Backfill.
   - Schreibe Integrationstests mit Mock-Dateisystem und Regressionen für Lösch-/Fallback-Flows.
   - Deliverable: Persistenzlayer + Dokumentation in `AGENTS.md`.

3. **Phase 3 – Almanac-Shell & Kalender-Workflows**
   - Implementiere `AlmanacShell`, Mode-Switcher, Breadcrumbs sowie Calendar-Dashboard und Manager (Kalenderansicht + Übersicht) mit Default-Toggles.
   - Ergänze Dialoge für Kalenderdefinition/Eventverwaltung, Zoom-Toolbar, Filter, Inline-Erstellung (All-Day vs. Start-/Endzeit, Time-Picker, Tastatursteuerung).
   - Implementiere Modus-Persistenz (zuletzt genutzte Ansicht, Zoom) und Fokus-Management.
   - Schreibe Presenter-Tests für Moduswechsel und Kalenderpflege.

4. **Phase 4 – Events-Modus & Phänomen-Engine**
   - Baue Events-Modus (Timeline, Tabelle, Kartenansicht), Bulk-Aktionen, Kategorie-/Kalenderfilter, Vorschau je Kalender.
   - Implementiere `PhenomenonEditor`, Verlinkung zu Kalenderereignissen (Overrides, Kopplung), Import/Export sowie Hook-Definitionen.
   - Ergänze Domain- und Presenter-Tests für Konflikte, Sichtbarkeitsregeln, astronomische/off-cycle Berechnungen.
   - Dokumentiere Performance-Budgets (Rolling Windows, Caching).

5. **Phase 5 – Cartographer-Integration & Travel-Leaf**
   - Verknüpfe Almanac-Modi mit `CartographerController` (Lazy-Load, Commands) und registriere Travel-Leaf (mount/unmount beim Reise-Start/-Ende).
   - Synchronisiere Reisezeitfortschritt inkl. Phänomen-Hooks (Wetter, Gezeiten) und minütlicher Schritte.
   - Ergänze Regressionstests, die Reiseabläufe mit Default-Wechseln, Phänomen-Auswirkungen und Konfliktfällen simulieren.
   - Dokumentiere neue Commands, Settings und Travel-Leistungen.

6. **Phase 6 – Polish, Observability & Rollout**
   - Logging, Telemetry-Hooks (Leaf-Lifecycle, Events-Berechnung, Hook-Laufzeiten), Fehlermeldungen und Monitoring.
   - UX-Optimierungen (Filter für Ereignisse, Suche, Shortcut-Konsistenz), Accessibility- und i18n-Review (Zeit- & Kategorieformat).
   - Aktualisiere `apps/README.md`, Release-Notes, Screenshots und führe Team-Walkthrough durch.

## UI- & Workflow-Spezifikation
- Detailangaben zu Layout, Komponenten und Workflows sind in [`mode/UX_SPEC.md`](./mode/UX_SPEC.md), [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md), [`mode/COMPONENTS.md`](./mode/COMPONENTS.md) und [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md) erfasst.
- API-Contracts und Persistenzverträge sind in [`mode/API_CONTRACTS.md`](./mode/API_CONTRACTS.md) dokumentiert.
- Fehler- und Leerstaaten sowie Telemetrieanforderungen sind in den folgenden Abschnitten zusammengefasst und verlinken auf die Detaildokumente.

### Workflow-Überblick
| Workflow | Ziel | Primärer Trigger | Domain-Auswirkungen | Referenz |
| --- | --- | --- | --- | --- |
| Almanac-Modus wechseln | Zwischen Dashboard, Manager, Events und Travel wechseln und Zustände erhalten | Tabs/Sidebar im Almanac | Aktualisiert `almanacMode`, lädt benötigte Daten lazy | [UX Spec §3.1](./mode/UX_SPEC.md#31-almanac-modus-wechseln) |
| Events-Modus navigieren & filtern | Kalenderübergreifende Phänomene analysieren | Modus-Toolbar, Filter-Panel | Aktualisiert `eventFilters`, lädt batched Phenomenon-Resultsets | [UX Spec §3.2](./mode/UX_SPEC.md#32-events-modus-navigieren-und-filtern) |
| Phänomen anlegen/bearbeiten | Jahreszeiten, astronomische & Wetterereignisse pflegen | CTA „Phänomen hinzufügen“ | Schreibt `AlmanacEvent` + Vorschau | [UX Spec §3.3](./mode/UX_SPEC.md#33-phaenomen-anlegenbearbeiten) |
| Phänomen Kalender zuweisen & Hooks konfigurieren | Sichtbarkeit & Auswirkungen je Kalender definieren | Detail-Editor, Bulk-Aktion | Aktualisiert `phenomenon.links` & Hook-Mapping | [UX Spec §3.4](./mode/UX_SPEC.md#34-phaenomen-kalender-verknuepfen--hooks-konfigurieren) |
| Aktiven Kalender wählen | Reise/Globalem Kontext einen Kalender zuordnen | Dropdown/Command | Aktualisiert `activeCalendarId` (global oder Reise) | [UX Spec §3.5](./mode/UX_SPEC.md#35-aktiven-kalender-waehlen) |
| Default-Kalender verwalten | Globalen bzw. reisespezifischen Default setzen | Toggle im Formular, Kontextmenü | Aktualisiert `defaultCalendarId` (global/reise), migriert Fallbacks | [UX Spec §3.6](./mode/UX_SPEC.md#36-default-kalender-verwalten) |
| Kalender-Manager – Modus wechseln | Zwischen Kalenderansicht und Übersicht wechseln | Tabs oder Toolbar | Aktualisiert `managerViewMode`, lädt entsprechende Datensätze | [UX Spec §3.7](./mode/UX_SPEC.md#37-kalender-manager--modus-wechseln) |
| Neuen Kalender anlegen | Schema konfigurieren & persistieren | CTA „Kalender anlegen“ | Erstellt Schema + Default-Status optional | [UX Spec §3.8](./mode/UX_SPEC.md#38-neuen-kalender-anlegen) |
| Ereignis anlegen – einmalig | Einmaliges Datum pflegen | CTA „Ereignis hinzufügen“ → „Einmalig“ | Schreibt `CalendarEventSingle` | [UX Spec §3.9.1](./mode/UX_SPEC.md#391-ereignis-anlegen--einmalig) |
| Ereignis anlegen – wiederkehrend | Regelbasierte Events abbilden | CTA „Ereignis hinzufügen“ → „Wiederkehrend“ | Schreibt `CalendarEventRecurring` | [UX Spec §3.9.2](./mode/UX_SPEC.md#392-ereignis-anlegen--wiederkehrend) |
| Zeit fortschreiten | Zeitlinie anpassen & Events prüfen | Quick-Action oder Cartographer-Hook | Mutiert `currentTimestamp`, generiert `triggeredEvents`/`triggeredPhenomena` | [UX Spec §3.10](./mode/UX_SPEC.md#310-zeit-fortschreiten) |
| Datum/Zeit setzen | Direktes Datum & Uhrzeit mit Konfliktauflösung setzen | Quick-Action „Datum/Zeit setzen“ | Setzt `currentTimestamp`, markiert übersprungene Events/Phänomene | [UX Spec §3.11](./mode/UX_SPEC.md#311-datum-und-zeit-setzen) |
| Ereignisliste filtern/suchen | Überblick fokussieren | Filterpanel/Quick-Filter | Anpassung von `eventListFilter` | [UX Spec §3.12](./mode/UX_SPEC.md#312-ereignisliste-filternsuchen) |
| Kalender bearbeiten | Schema und Events migrieren | Aktion „Bearbeiten“ | Aktualisiert Schema, führt Migration aus | [UX Spec §3.13](./mode/UX_SPEC.md#313-kalender-bearbeiten) |
| Travel-Kalender anzeigen | Kompaktes Leaf synchronisieren | Reise startet/endet, Leaf-Toolbar | Aktualisiert `travelLeafMode`, `travelLeafVisible` | [UX Spec §3.14](./mode/UX_SPEC.md#314-travel-kalender) |
| Reise-Sync (Cartographer) | Cartographer-Timehooks bedienen | Cartographer `advanceTime` | Bidirektionaler Sync, UI-Feedback | [UX Spec §3.15](./mode/UX_SPEC.md#315-reise-sync-cartographer) |

### Ablaufdiagramme & Zustände
- Textuelle Ablaufdiagramme für alle obenstehenden Workflows befinden sich in [`mode/STATE_MACHINE.md`](./mode/STATE_MACHINE.md#ablaufdiagramme) und ergänzen die UI-Perspektive aus [`mode/WIREFRAMES.md`](./mode/WIREFRAMES.md).
- State-Slices (`calendarState`, `managerUiState`, `travelLeafState`) und Events sind im selben Dokument abgebildet und dienen als Grundlage für Presenter-Implementierungen.

### Akzeptanzkriterien (Kurzform)
- **Almanac-Modus wechseln**
  - [ ] Given ein Almanac-Leaf ist geöffnet, When Nutzer:in zwischen Dashboard, Manager, Events oder Travel wechselt, Then der zuletzt genutzte Zustand (Zoom, Filter, Auswahl) wird geladen ohne erneut zu blinken.
  - [ ] Given ein Modus lädt Daten lazy, When Nutzer:in zurückkehrt, Then werden bereits geladene Datensätze gecacht und nur bei abgelaufenem TTL neu geholt.
- **Events-Modus navigieren & filtern**
  - [ ] Given verschiedene Kategorien, When Filter/Kategorie geändert werden, Then Liste/Timeline aktualisieren sich live und zeigen ein Badge mit Anzahl aktiver Filter.
  - [ ] Given keine Phänomene matchen, When Filter aktiv sind, Then erscheint Leerstaat mit CTA „Filter zurücksetzen“ und Hinweis auf betroffene Kalender.
- **Phänomen anlegen/bearbeiten**
  - [ ] Given Pflichtfelder (Name, Kategorie, Zeitdefinition) sind valide, When gespeichert, Then erstellt das System einen `AlmanacEvent` inklusive Vorschau der nächsten fünf Auftreten je ausgewähltem Kalender.
  - [ ] Given Eingaben sind inkonsistent (z.B. astronomische Regel ohne Referenzkalender), When Speichern, Then blockiert Validierung und nennt fehlende Angaben.
- **Phänomen Kalender zuweisen & Hooks konfigurieren**
  - [ ] Given mindestens ein Kalender ist ausgewählt, When Speichern, Then erscheinen entsprechende Hinweise/Badges in Kalender-Dropdowns und Travel-Leaf.
  - [ ] Given ein Phänomen ist mehreren Kalendern zugeordnet, When einer der Kalender gelöscht wird, Then fordert das System Neuverteilung oder informiert über Fallback.
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
  - [ ] Given gültiges Datum/Zeit oder als ganztägig markiert, When gespeichert, Then erscheint in „Alle“ & „Kommend“ (falls zukünftig) mit Schema- und Zeitformat.
  - [ ] Given Datum liegt vor aktuellem Timestamp, When gespeichert, Then markiert als „Vergangen“ und optional nacharbeiten.
- **Ereignis anlegen – wiederkehrend**
  - [ ] Given gültige Wiederholungsregel (inkl. Zeitkomponente oder All-Day), When gespeichert, Then Vorschau zeigt nächste fünf Vorkommen korrekt für aktuelles Schema.
  - [ ] Given kollidierende Regel, When gespeichert, Then UI warnt und verlangt Bestätigung oder Abbruch.
- **Zeit fortschreiten**
  - [ ] Given Quick-Actions oder Cartographer-Trigger, When Zeit voranschreitet, Then `currentTimestamp` wird inkl. Stunden/Minuten angepasst, Travel-Leaf aktualisiert, ausgelöste Events/Phänomene erscheinen im Log.
  - [ ] Given Teil-Tages-Schritte (z.B. +15 Minuten), When angewendet, Then Ereignisse innerhalb derselben Tagesgrenze werden korrekt behandelt (Trigger oder Nacharbeiten) und astronomische Phänomene berücksichtigen Offsets.
  - [ ] Given Hooks registriert, When Zeit fortschreitet, Then werden alle Hooks exakt einmal dispatcht, auch bei mehreren Ereignissen pro Stunde.
- **Datum/Zeit setzen**
  - [ ] Given Ziel-Datum und Uhrzeit, When gesetzt, Then übersprungene Events/Phänomene werden gelistet und optional nachträglich ausgelöst.
  - [ ] Given Datum/Zeit außerhalb Schema (z.B. Stunde ≥ `hoursPerDay`), When bestätigt, Then blockiert Validierung und verweist auf Schema-Anpassung.
- **Ereignisliste filtern/suchen**
  - [ ] Given Filterkriterien, When angewendet, Then reagiert Liste in Echtzeit und Filter bleiben Sitzungs-lokal gespeichert.
  - [ ] Given keine Treffer, When Filter aktiv, Then erscheint Leerstaat mit Option Filter zurückzusetzen.
- **Kalender bearbeiten**
  - [ ] Given Schemaänderung, When gespeichert, Then werden Ereignisse migriert oder mit Konfliktliste versehen.
  - [ ] Given Migration schlägt fehl, When bestätigt, Then wird nichts persistiert und UI zeigt Fehlerdetails.
- **Travel-Kalender anzeigen**
  - [ ] Given Reisemodus startet, When Calendar-Module reagiert, Then wird Travel-Leaf automatisch geöffnet und zeigt synchronisierte Daten inklusive aktueller Uhrzeit und relevanter Phänomen-Badges.
  - [ ] Given Reisemodus endet, When Signal empfangen, Then Leaf schließt sich und Zustand wird persistiert.
- **Reise-Sync (Cartographer)**
  - [ ] Given Cartographer `advanceTime`, When aufgerufen, Then Calendar-UI und Travel-Panel zeigen identische Ereignis- und Phänomenbenachrichtigungen.
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
- Unterstützt flexible Wochenlängen (z.B. 10 Tage), variable Monatsanzahlen inklusive Schaltmonate sowie optional unregelmäßige Monate/Jahreszeiten in Kalender- und Events-Ansicht (siehe [`mode/API_CONTRACTS.md#schemas`](./mode/API_CONTRACTS.md#schemas)).
- Zeitdefinitionen je Schema: `hoursPerDay`, `minutesPerHour`, optional `secondsPerMinute` (Default 24/60/60). **Assumption:** Fehlen Angaben, wird 24h/60m/60s genutzt; **Alternative:** Schema liefert explizite Werte. Dokumentiert in [`mode/API_CONTRACTS.md#schemas`](./mode/API_CONTRACTS.md#schemas).
- Phänomene können mehrere Kalender verlinken; beim Löschen eines Kalenders wird ein Wizard zur Neuverteilung gestartet. **Assumption:** Mindestens ein Kalender muss aktiv bleiben; **Alternative:** Phänomen kann temporär ohne Link existieren, wird aber im Events-Modus als „unzugeordnet“ angezeigt.
- Astronomische Berechnungen (z.B. Sonnen-/Mondphasen) nutzen konfigurierbare Quellen: **Assumption:** Wir speichern prä- berechnete Tabellen je Schema; **Alternative:** Hooks rufen externe Provider (Plugin-API) auf. Performance-Grenze: Berechnung pro Advance ≤ 50 ms.
- Wetter/Gezeiten simulieren Rolling Windows (z.B. 14 Tage, 336 Stunden) und cachen Resultate per Schema + Seed. Bei manuellen Zeitsprüngen > Window werden Zwischenwerte lazy nachberechnet.
- Zeitfortschritt erlaubt negative Werte (Rücksprung) und mehrfache Tage/Wochen/Stunden/Minuten; Event-/Phänomen-Engine verarbeitet große Sprünge durch chunked Verarbeitung (Fenstergröße 365 Tage bzw. 8.760 Stunden, konfigurierbar) und cached pro Zoom-Level.
- Teil-Tageskonflikte: Ereignisse/Phänomene mit identischem Timestamp werden nach Priorität (Hook-Priorität, Kategorie) sortiert; UI bietet Merge-/Reschedule-Flow (siehe [`mode/UX_SPEC.md#310-zeit-fortschreiten`](./mode/UX_SPEC.md#310-zeit-fortschreiten)).
- Doppelregeln (z.B. Phänomen + Kalenderereignis identisch) werden durch Normalisierung erkannt; Konfliktauflösung via Merge-Dialog dokumentiert in [`mode/UX_SPEC.md#313-kalender-bearbeiten`](./mode/UX_SPEC.md#313-kalender-bearbeiten) und [`mode/UX_SPEC.md#34-phaenomen-kalender-verknuepfen--hooks-konfigurieren`](./mode/UX_SPEC.md#34-phaenomen-kalender-verknuepfen--hooks-konfigurieren).
- Performance: Vorschau zukünftiger Vorkommen berechnet maximal 24 Monate bzw. 2.000 Stunden im Voraus (konfigurierbar) und cached Ergebnisse pro Schema/Rule-Hash; Travel-Leaf lädt initial 30 Tage/72 Stunden, weitere Einträge lazy bei Scroll.
## Telemetrie & Observability
- Loggingpunkte: Zeitfortschritt (`calendar.time.advance`), Schema-Migration (`calendar.schema.migrate`), Event-/Phänomen-Konflikte (`calendar.event.conflict`), Default-Umschaltung (`calendar.default.change`), Travel-Leaf Lifecycle (`calendar.travel.leaf_mount`), Almanac-Moduswechsel (`calendar.almanac.mode_change`).
- Metriken: Anzahl ausgelöster Events/Phänomene pro Advance (Tag/Stunde/Minute), Dauer der Ereignisberechnung je Zoom-Level, Dauer von astronomischen/meteorologischen Simulationen, Fehlerquote pro Operation, Anzahl Default-/Modus-Wechsel pro Sitzung, Anteil teil-täglicher Schritte (`advance.subday_share`), Cache-Trefferquote im Events-Modus.
- Fehlertracking: persistente io-Fehler werden mit Kontext (`calendarId`, `operation`, `scope` = global/reise) erfasst; Hook-Dispatches melden Erfolg/Fehlschlag an Cartographer (siehe [`mode/API_CONTRACTS.md#cartographer-hooks`](./mode/API_CONTRACTS.md#cartographer-hooks)). Travel-Leaf meldet Renderdauer und Shortcut-Nutzung; Events-Modus sendet Telemetrie zu Filterkombinationen & Ladezeiten.
## Dokumentverweise & Testplanung
- Teststrategie detailliert in [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md); bildet Use-Cases, neue Modi (Kalenderansicht/Übersicht/Travel) und Regressionen ab.
- Komponenten- und API-Verträge sind in den Mode-Unterdokumenten verknüpft, Implementierende folgen der Reihenfolge Domain → Repository/Gateway → Presenter/Components → Mode-Integration → Tests → Polish.

## TODO-Reihenfolge (Implementierungsleitfaden)
1. Domain-Modelle und Regeln implementieren (`src/apps/calendar/domain`) inklusive Phänomen-Engine.
2. Persistenzschicht + Gateways (`CalendarRepository`, `AlmanacRepository`, `CalendarStateGateway`, Default-/Modus-Persistenz, Migrationen).
3. Almanac-Shell & Kalender-Leaves (`AlmanacShell`, Dashboard, Manager) nach [`mode/COMPONENTS.md`](./mode/COMPONENTS.md).
4. Events-Modus & Phänomen-Editor (Timeline, Bulk-Aktionen, Import/Export) gemäß [`mode/COMPONENTS.md#events-komponenten`](./mode/COMPONENTS.md#events-komponenten).
5. Cartographer-Integration & Travel-Leaf (Hooks, Leaf-Lifecycle) inkl. Bidirektionalem Sync.
6. Tests laut [`tests/apps/calendar/TEST_PLAN.md`](../../tests/apps/calendar/TEST_PLAN.md) schreiben (Domain, Gateway, UI, Travel, Events).
7. Observability & Polish (Telemetrie, Dokumentation, Übersetzungen, Accessibility/i18n Review).
## Offene Fragen
- Müssen Kalender global oder pro Vault gespeichert werden? (Entscheidung beeinflusst `core/persistence` und Default-Fallback).
- Wird es mehrere parallele aktive Kalender geben (z.B. Region A und B)? Falls ja, muss die Domain mehrere Zeitleisten verwalten und Default-Regeln erweitern.
- Sollen Ereignisse Automatisierungen in anderen Apps auslösen (Encounter, Library)? Evaluierung nach Phase 3.
