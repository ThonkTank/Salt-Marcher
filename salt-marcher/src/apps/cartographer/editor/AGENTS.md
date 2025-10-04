# Ziele
- Bündelt Infrastruktur und Dokumentation für den Karten-Editor mitsamt Werkzeugleisten.
- Beschreibt den Fluss zwischen Presenter, Editor-Modus und Werkzeugen, damit neue Tools sauber eingebunden werden können.
- Hält Standards für Statusanzeigen und Lifecycle-Verhalten fest, um Benutzerfeedback konsistent zu halten.

# Aktueller Stand
## Strukturüberblick
- `modes/editor.ts` instanziiert den Editor-Modus, initialisiert Panel-Elemente und verbindet `ToolManager` sowie Statusanzeige.
- `editor/tools/` hält gemeinsame Bausteine (`tool-manager`, `tools-api`, UI-Helfer) und konkrete Werkzeuge wie den Terrain-Brush.
- `terrain-brush/` liefert Options-Panel, Brush-Mathematik und Region-Ladepipeline; weitere Tools sollen über denselben Einstieg laufen.
- `editor-telemetry.ts` meldet Tool-Ausfälle dedupliziert an Konsole und Notice-System.

## Lifecycle & Datenflüsse
- Der Modus synchronisiert Datei-, Render- und Optionszustand mit dem `ToolContext`, das Tools über `getHandles` und `getAbortSignal` auf dem Laufenden hält.
- `ToolManager.switchTo` führt Panel-Mount, Aktivierung und `onMapRendered` in zwei Microtasks aus und meldet Mount-/Activate-Fehler über den Modus weiter.
- Das Panel deaktiviert sich solange keine Handles vorliegen und nutzt `setStatus`, um Lade- bzw. Leerlaufzustände darzustellen.
- Der Brush lädt Regionen asynchron über `loadRegions`, lauscht auf Workspace-Events (`salt:terrains-updated`, `salt:regions-updated`) und resetet Auswahl sowie Vorschaukreis bei Lifecycle-Abbruch.

## Beobachtungen
- Console-Fehler aus `tool-manager.ts` und Tool-Modulen landen nicht in Telemetrie oder im UI, wodurch Nutzer über Probleme im Hintergrund im Unklaren bleiben.
- Der „Manage…“-Button des Brushs ruft direkt einen Command auf; fehlt dieser, passiert nichts. Ein Fallback-Hinweis wäre hilfreich.

# ToDo
- keine offenen ToDos.

# Standards
- Editor-spezifische Module benennen Werkzeuge klar (`*-tool`, `*-brush`).
- Neue Editorkomponenten erhalten Kopfkommentare mit Nutzerabsicht.
- Tools nutzen `ToolContext.setStatus`, um lange Operationen oder Fehlerzustände sichtbar zu machen und räumen Workspace-Abos im Cleanup.
- Buttons, die globale Commands triggern, validieren das Vorhandensein des Commands und degradieren andernfalls mit UI-Hinweis.
