Einleitung
---------
Dieses Dokument sammelt gezielte Vorschläge, wie der Almanac-Workmode verschlankt werden kann. Es richtet sich an das App-Team und verweist auf bestehende Module, die vereinfacht oder zusammengeführt werden können.

Problem
-------
Der aktuelle Almanac-Code verteilt Kernlogik auf mehrere Controller und State-Machines, wodurch Features nur über komplexe Eventketten erreichbar sind. Skripte und Hilfsfunktionen duplizieren außerdem Build- und Testpfade, und einige Komponenten übernehmen doppelte Verantwortung (z. B. Datenabfragen und Rendering). Das erschwert Wartung, Onboarding und Refactoring.

Ziel
----
* Architektur so entflechten, dass UI-spezifische Zustände klar vom Domänenmodell getrennt bleiben.
* Build- und Test-Skripte konsolidieren, um redundante Pfade in `package.json` und `scripts/` zu entfernen.
* Komponentenstruktur vereinfachen, damit Kalender-, Ereignis- und Travel-Modi wiederverwendbare Primitive teilen.

Lösung
------
1. **State-Management konsolidieren**
   * Führe `AlmanacStateMachine` und Controller-Zustandskopien zusammen, indem Du ein zentrales Store-Interface (z. B. `CalendarViewStore`) definierst, das sowohl vom UI als auch vom Travel-Mode benutzt wird.
   * Verlege temporäre UI-Flags (aktive Tabs, Layoutpräferenzen) in lokale Component-Stores statt sie durch Events zu schicken; ersetze `CALENDAR_VIEW_MODE_CHANGED` & Co. durch direkte Setter, die den zentralen Store aktualisieren.
   * Prüfe, ob `initializeSplitView` und verwandte Controller einen Hook-basierten Ansatz nutzen können, sodass der Lifecycle vom Framework statt manuellen `onOpen`/`onClose`-Schritten getragen wird.

2. **Repository- und Loader-Ebene verschlanken**
   * Bündele `InMemoryCalendarRepository`, Event-Fixtures und Phänomen-Daten in einem `AlmanacDataSource`, das sowohl Demo- als auch Persistenzpfade kapselt.
   * Extrahiere Aggregationslogik wie `collectAgendaItems` in reine Funktionen im Domain-Layer, damit Controller nur noch `await dataSource.loadAgenda(anchor)` aufrufen müssen.
   * Entferne Duplikate zwischen `mode/travel` und `mode/events` Gateways, indem beide den gleichen `loadTimeline(anchor, span)`-Contract verwenden.

3. **Komponentenbibliothek bereinigen**
   * Mache `calendar-view-container` zu einem dünnen Wrapper, der Layout, Tabs und Slots liefert, während spezialisierte Komponenten (Monats-, Wochen-, Tagesansicht) ihre eigenen Presenter erhalten.
   * Vereinheitliche die Props der Event-Listen-Komponenten, sodass `manager` und `dashboard` keine Mapping-Helpers mehr benötigen.
   * Ersetze Inline-Renderer in den `renderContent`-Switches durch eine Lookup-Map `{mode: Component}`, um neue Modi durch reine Konfiguration hinzuzufügen.

4. **Skripte & Tooling vereinfachen**
   * Reduziere die Anzahl an NPM-Skripten, indem Du `test:almanac`, `test:apps` und ähnliche Teilziele über `vitest --config vitest.config.ts --run --project almanac` parametrisiert startest.
   * Prüfe, ob `sync:todos` automatisiert nach jedem erfolgreichen Build laufen kann (z. B. via `postbuild`), um manuelle Schritte zu sparen.
   * Nutze `esbuild`-Plugins aus `scripts/` gemeinschaftlich, anstatt für Almanac-Spezifika eigene Bundler-Configs vorzuhalten.

5. **Dokumentation & Entscheidungsprotokolle entschlacken**
   * Konsolidiere verstreute Design-Notizen aus `AGENTS.md`, `TOOLTIP_IMPLEMENTATION.md` und Projekt-Docs in ein einziges Referenzdokument (`docs/almanac-architecture.md`).
   * Verweise von Tests direkt auf die relevanten Architekturabschnitte, um neue Contributors schneller zu orientieren.
   * Pflege eine kurze Checkliste für neue Features (State, Data, UI), um übermäßige Event-Einführungen früh zu erkennen.

Tests
-----
Nicht anwendbar (nur Architektur- und Prozessvorschläge).
