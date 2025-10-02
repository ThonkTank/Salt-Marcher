# Ziele
- Pflegt Reisezustand, Aktionen und Regelwerke für Hex-Routen.

# Aktueller Stand
- `actions` beschreibt Kommandos für Timeline, Marker und Tokens.
- `expansion` kümmert sich um Fog-of-War und Kartenerweiterung.
- `persistence` synchronisiert Speicherstände.
- `playback` steuert Fortschritt entlang gespeicherter Schritte.
- `state.store` hält den zentralen Zustand, `terrain.service` lädt Geländedaten.
- `types` definiert DTOs für öffentliche Nutzung.

# ToDo
- Mehrstufige Undo/Redo-Strategien entwerfen.
- Persistente Speicherformate mit Versionierung dokumentieren.

# Standards
- Store- und Service-Dateien beginnen mit Zweck und gelesenen Quellen.
- Aktionen bleiben reine Funktionen ohne versteckte Seiteneffekte.
