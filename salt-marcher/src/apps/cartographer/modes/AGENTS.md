# Ziele
- Bündelt die Kernmodi (Editor, Inspector, Travel Guide) des Cartographer und beschreibt deren Verantwortlichkeiten.
- Dokumentiert, wie Modi Lifecycle, Tooling und Registry-Zugriffe koordinieren.
- Sichert einheitliche Erwartungen an Fehlerbehandlung, Statusmeldungen und Metadaten über alle Modi hinweg.

# Aktueller Stand
## Strukturüberblick
- `editor.ts` baut das Bearbeitungspanel mit Tool-Auswahl auf, nutzt `createToolManager()` aus `editor/tools` und hält Statusmeldungen über `setStatus` aktuell.
- `inspector.ts` stellt Formularfelder für Terrain und Notizen bereit, lädt Daten aus `core/hex-mapper/hex-notes` und schreibt Änderungen verzögert über einen Auto-Save-Timeout zurück.
- `travel-guide.ts` orchestriert Sidebar, Playback, Routen- & Token-Layer sowie Encounter-Sync und interagiert eng mit `travel/domain`, `travel/ui` und `travel/infra`.
- `lifecycle.ts` kapselt die Verwaltung des jeweils letzten `AbortSignal` und wird von Editor und Inspector genutzt, um Tool-/Form-Interaktionen sauber abzubrechen.
- `travel-guide/` beherbergt Controller (Playback, Interaction, Encounter-Gateway), die beim Lazy-Load des Modus nachgeladen werden.

## Integrationen & Beobachtungen
- Alle Modi werden über Provider in `mode-registry/providers` geladen; IDs und Labels sind derzeit manuell in Modus- und Provider-Dateien gepflegt.
- Editor & Inspector verlassen sich auf `ToolManager`- und Hex-Persistenz-Helfer. Fehler werden bislang nur mit `console.error` geloggt und führen nicht zu UI-Hinweisen oder Telemetrie.
- Travel Guide lädt Terrains, initialisiert Domain-Logik und Encounter-Synchronisation sequentiell. Schlägt ein Schritt fehl, bleibt der Modus ohne sichtbaren Hinweis oder Rückfallebene.
- Die README dokumentiert Nutzerflüsse, verweist aber nicht auf technische Risiken wie Abort-Signale oder die Abhängigkeit von `travel/infra`.

# ToDo
- [P2.49] Auto-Save-Timeout des Inspectors an das Abort-Signal koppeln, Fehlermeldungen im Panel darstellen und Telemetrie für `saveTile`-/`setFill`-Fehler ergänzen.
- [P2.50] Travel-Guide-Initialisierung gegen Terrain-/Logic-/Encounter-Ausfälle absichern und Nutzerhinweise + Logging vereinheitlichen.
- [P2.51] Mode-IDs, Labels und Capabilities zentralisieren, damit Modusdefinitionen und Provider-Metadaten nicht auseinanderlaufen.

# Standards
- Jede Modus-Fabrik exportiert `create<Name>Mode`, startet mit einem Kopfkommentar zum Nutzerziel und räumt registrierte Listener sowie DOM-Knoten in `onExit` konsequent auf.
- Asynchrone Schritte prüfen `ctx.signal.aborted` oder das Lifecycle-Signal vor und nach Await-Punkten und melden Fehler sowohl im UI (Status/Notice) als auch per Logger/Telemetry.
- Tool- und Persistenzfehler setzen Panel-Status, triggern definierte Telemetrie-Hooks und verlassen sich nicht ausschließlich auf `console.error`.
- Mode-Metadaten (ID, Label, Capabilities) werden an einer Stelle gepflegt und beim Hinzufügen neuer Modi gegen Registry-/Provider-Kontrakte gespiegelt.
