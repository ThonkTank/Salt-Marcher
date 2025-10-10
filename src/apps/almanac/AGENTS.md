# Ziele
- Plant den neuen Almanac-Workmode innerhalb der Apps-Schicht und dokumentiert Architekturentscheidungen vor dem ersten Code.
- Beschreibt Zuständigkeiten, Integrationen und Migrationspfade für Kalender-, Phänomen- und Zeitleistenfunktionen im Zusammenspiel mit Cartographer.
- Liefert eine verlässliche Referenz für spätere Implementierungsphasen inklusive Testankern und Persistenzüberlegungen.

# Aktueller Stand
- Domain-Layer für Kalenderarithmetik, Wiederholregeln und Phänomen-Engine ist umgesetzt und mit Vitest abgedeckt.
- In-Memory- und Vault-Repositories bleiben für Datenzugriffe sowie Travel-Sync verfügbar.
- Das Obsidian-View rendert nur noch einen statischen Hinweis, da das Almanac-Frontend entfernt wurde.

# ToDo
- [P1] Prüfe verbleibende Dokumentation und Testpläne auf Legacy-Verweise zum entfernten Frontend.
- [P2] Cartographer-Integration & Travel-Leaf mit bidirektionalem Sync fertigstellen.
- [P3] Observability/Telemetrie ergänzen und Dokumentation (BUILD/README) synchronisieren.

# Standards
- Dokumente in diesem Ordner nutzen klare Abschnittsüberschriften (Problem, Ziel, Lösung, Tests) und verlinken relevante Core-/App-Module.
- Jede Datei beginnt mit einer kurzen Einleitung zum Zweck und verweist, falls zutreffend, auf verwandte Komponenten.
- Aktualisiere `apps/README.md` erst, wenn mindestens Phase 1 des Plans umgesetzt wurde.
