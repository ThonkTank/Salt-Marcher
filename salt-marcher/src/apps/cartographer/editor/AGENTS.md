# Ziele
- Hält gemeinsame Infrastruktur für Kartograph-Editor und seine Werkzeugleisten.

# Aktueller Stand
- Leitet derzeit direkt in `tools`, wo Brush-Implementierungen und Manager leben.
- `modes/editor.ts` hält Render-Handles, übergibt sie an den Tool-Manager und synchronisiert den Status bei Kartenwechseln.

# Rendering-Hooks
- `ToolContext.getHandles()` liefert die aktuellen `RenderHandles` aus dem Hex-Renderer.
- `ToolManager.notifyMapRendered()` ruft `onMapRendered` des aktiven Werkzeugs auf, sobald Handles verfügbar sind.
- Werkzeuge können `onMapRendered` nutzen, um Canvas-Layer oder Overlays außerhalb des Standard-Brushes zu initialisieren.

# ToDo
- keine offenen ToDos.

# Standards
- Editor-spezifische Module benennen Werkzeuge klar (`*-tool`, `*-brush`).
- Neue Editorkomponenten erhalten Kopfkommentare mit Nutzerabsicht.
