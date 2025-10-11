# Cartographer Modes

Der Cartographer bietet zwei Modi, die jeweils eine eigene Oberfläche aktivieren. Der Travel-Workflow wurde in die Session-Runner-App ausgelagert.

## Editor
- Aktiviert Werkzeugleisten und Brush-Optionen aus `editor/tools`.
- Schreibt Terrain-Änderungen sofort in Hex-Notizen und aktualisiert die Karte live.

## Inspector
- Lädt bestehende Hex-Daten, zeigt Metadaten und erlaubt gezielte Anpassungen einzelner Tiles.
- Nutzt Select-Felder mit Suche, um Terrain- oder Notizwerte schnell zu ändern.

## Session Runner (separate App)
- Travel-spezifische Steuerung befindet sich in `apps/session-runner` und nutzt weiterhin dieselben Domain-/UI-Bausteine.
