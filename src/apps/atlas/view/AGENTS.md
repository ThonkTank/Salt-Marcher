# Ziele
- Bündelt die Renderer für Terrains und Regionen innerhalb der Atlas-App.
- Beschreibt Tab-Steuerung, Suche und Persistenz-Hooks der beiden Workmodes.

# Aktueller Stand
- `terrains.ts` bearbeitet YAML-basierte Terrain-Tabellen inklusive Auto-Save.
- `regions.ts` synchronisiert Regionenlisten mit Terrain-Referenzen und speichert Encounter-Wahrscheinlichkeiten.
- `mode.ts` typisiert Atlas-spezifische Workmode-Renderer auf Basis der gemeinsamen Infrastruktur.

# ToDo
- [P2] Regionen-Renderer um Karten-Vorschau ergänzen, sobald entsprechende Assets verfügbar sind.

# Standards
- Jede Datei startet mit einem Kommentar zum dargestellten Datensatz.
- Renderer beachten die Base-API aus `ui/workmode` und räumen Watcher über `destroy()` auf.
