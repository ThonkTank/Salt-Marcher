# Ziele
- Pflegt Reisezustand, Aktionen und Regelwerke für Hex-Routen.

# Aktueller Stand
- `actions` beschreibt Kommandos für Timeline, Marker und Tokens.
- `expansion` kümmert sich um Fog-of-War und Kartenerweiterung.
- `persistence` synchronisiert Speicherstände.
- `playback` steuert Fortschritt entlang gespeicherter Schritte.
- `state.store` hält den zentralen Zustand, `terrain.service` lädt Geländedaten.
- `types` definiert DTOs für öffentliche Nutzung.

# Persistenzformate
- `travel-token@1`: setzt an genau einem Hex das Frontmatter-Flag `token_travel: true`; fehlende oder falsche Werte zählen als "kein Token".
- Versionserkennung: existiert `token_travel` als Boolean, gilt Version 1. Ältere Karten ohne Flag werden als Version 0 interpretiert und bleiben unverändert.
- Migration: neue Formate sollen `travel-token@<n>` im Frontmatter spiegeln (z. B. via `token_travel_version`) und Abwärtskonvertierungen in `persistence.ts` kapseln.

# ToDo
- [P3.2] Mehrstufige Undo/Redo-Strategien entwerfen.

# Standards
- Store- und Service-Dateien beginnen mit Zweck und gelesenen Quellen.
- Aktionen bleiben reine Funktionen ohne versteckte Seiteneffekte.
