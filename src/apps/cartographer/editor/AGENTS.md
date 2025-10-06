# Ziele
- Bündelt Infrastruktur und Dokumentation für den Karten-Editor mitsamt Werkzeugleisten.
- Beschreibt den Fluss zwischen Presenter, Editor-Modus und Werkzeugen, damit neue Tools sauber eingebunden werden können.
- Hält Standards für Statusanzeigen und Lifecycle-Verhalten fest, um Benutzerfeedback konsistent zu halten.

# Aktueller Stand
## Strukturüberblick
- `modes/editor.ts` instanziiert den Editor-Modus, initialisiert Panel-Elemente und mountet den Terrain-Brush direkt an den Lifecycle.
- `editor/tools/` hält gemeinsame Bausteine (Brush-Panel, Brush-Kreis, Brush-Core) und konkrete Werkzeuge wie den Terrain-Brush.
- `terrain-brush/` liefert Options-Panel, Brush-Mathematik und Region-Ladepipeline; weitere Tools sollen über denselben Einstieg laufen.
- `editor-telemetry.ts` meldet Tool-Ausfälle dedupliziert an Konsole und Notice-System.

- Der Modus synchronisiert Datei-, Render- und Optionszustand direkt mit dem Brush-Panel, das via `getHandles`, `getOptions` und Lifecycle-Abort-Signal auf dem Laufenden bleibt.
- Das Panel deaktiviert sich solange keine Handles vorliegen und nutzt `setStatus`, um Lade- bzw. Leerlaufzustände darzustellen.
- Der Brush lädt Regionen asynchron über `loadRegions`, lauscht auf Workspace-Events (`salt:terrains-updated`, `salt:regions-updated`) und resetet Auswahl sowie Vorschaukreis bei Lifecycle-Abbruch.

## Beobachtungen
- Console-Fehler aus Brush-Interaktionen landen ohne explizite Behandlung weiterhin nicht automatisch in Telemetrie oder UI, wodurch Nutzer über Probleme im Hintergrund im Unklaren bleiben.
- Der „Manage…“-Button des Brushs ruft direkt einen Command auf; fehlt dieser, passiert nichts. Ein Fallback-Hinweis wäre hilfreich.

# ToDo
- keine offenen ToDos.

# Standards
- Editor-spezifische Module benennen Werkzeuge klar (`*-brush`, `*-panel`).
- Neue Editorkomponenten erhalten Kopfkommentare mit Nutzerabsicht.
- Brush-Module nutzen die vom Modus gereichte `setStatus`-Funktion, um lange Operationen oder Fehlerzustände sichtbar zu machen und räumen Workspace-Abos im Cleanup.
- Buttons, die globale Commands triggern, validieren das Vorhandensein des Commands und degradieren andernfalls mit UI-Hinweis.
