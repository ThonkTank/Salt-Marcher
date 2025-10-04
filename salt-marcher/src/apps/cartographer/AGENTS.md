# Ziele
- Liefert den zentralen Arbeitsbereich zum Erstellen, Inspizieren und Reisen über Hexkarten.
- Orchestriert den Wechsel zwischen Arbeitsmodi sowie Datei-/Map-Management für alle Cartographer-Flows.
- Stellt stabile Verträge für View-Shell, Presenter und Mode-Registry bereit, damit Tests und andere Apps gezielt integrieren können.

# Aktueller Stand
## Strukturüberblick
- `index.ts` registriert die `CartographerView`, kapselt die ItemView-Metadaten und verbindet Obsidian-Leaves mit dem Presenter.
- `presenter.ts` verwaltet Lifecycle, Mode-Wechsel, Map-Rendering und die Anbindung an Shell, Map-Manager und Registry.
- `mode-registry/` pflegt Provider für Travel-, Editor- und Inspector-Modus und erlaubt externe Erweiterungen.
- `view-shell/` stellt das UI-Skelett (Header, Sidebar, Map-Container) sowie Ereignis-Callbacks für Presenter und Modi bereit.
- `editor/` und `travel/` liefern die jeweiligen Tooling-, Playback- und Encounter-Integrationen.

## Integration & Beobachtungen
- `CartographerPresenter` initialisiert seine Modi über `provideCartographerModes()` und hört via `subscribeToModeRegistry()` auf spätere Registry-Änderungen.
- Schlägt das Laden der Registry fehl, fällt `createProvideModes()` auf ein leeres Array zurück – die View bleibt dann ohne Modi und liefert keine Nutzerhinweise.
- Wiederholtes Öffnen der View ruft `onOpen()` erneut auf, ohne den Mode-Registry-Listener aus einem früheren Mount abzubestellen.
- Map-Rendering zeigt Overlays bei fehlenden Hex-Blöcken oder Rendering-Fehlern, signalisiert Registry-Probleme jedoch nicht im UI.

# ToDo
- [P2.36] Mode-Registry-Abos im Presenter beim Schließen zuverlässig lösen und einen Regressionstest für mehrmaliges Öffnen/Schließen ergänzen.
- [P2.37] Für fehlgeschlagene `provideCartographerModes()`-Aufrufe eine sichtbare Nutzer-Rückmeldung (Overlay/Notice) hinzufügen und Logging/Telemetry harmonisieren.

# Standards
- Modus-Dateien starten mit einem Satz zum Nutzerziel; Handler bündeln Ereignisketten über Imperativ-Verben (activate, hydrate, teardown).
- Lifecycle-Hooks registrieren nur dann Events oder Abos, wenn sie diese beim Schließen wieder entfernen.
- Fehler, die die Modus-Auswahl beeinträchtigen, werden sowohl geloggt als auch im UI kommuniziert (Overlay oder Notice).
