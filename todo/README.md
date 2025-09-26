# Salt Marcher To-Do Backlog

## Purpose & Scope
Dieser Ordner ersetzt die frühere `Critique.txt`-Sammlung. Jede Datei dokumentiert ein offenes Architektur- oder UX-Thema mit Kontext, betroffenen Modulen und möglichen Lösungsansätzen.

## Open Items
- [Main bootstrap service integration](main-bootstrap-service-integration.md) – `createTerrainBootstrap` konfliktfrei an `main.ts` anbinden und Tests reaktivieren.
- [Cartographer presenter respects abort signals](cartographer-presenter-abort-handling.md) – Presenter darf Modewechsel abbrechen, wenn das UI den Vorgang storniert.
- [Cartographer mode registry](cartographer-mode-registry.md) – Modi sollen deklarativ konfigurierbar sein statt hart verdrahtet.
- [UI terminology consistency](ui-terminology-consistency.md) – UI-Texte und Kommentare brauchen eine einheitliche Sprache.

## Recently Closed
- **2025-09-26 – Encounter workspace review**: Entfernt, nachdem Encounter-View, Presenter und Travel-Gateway überprüft wurden. Ergebnisse siehe `Notes/encounter-workspace-review.md`.

## Maintenance Notes
- Aktualisiere Dateien unmittelbar nach Code- oder Dokumentationsänderungen, damit Kontext und Lösungsideen konsistent bleiben.
- Verlinke jede To-Do-Datei in den relevanten README- oder Index-Dokumenten, damit offene Punkte dort sichtbar sind, wo Teams arbeiten.
- Verschiebe erledigte Einträge in ein Archiv oder entferne sie aus diesem Ordner, sobald sie umgesetzt und dokumentiert wurden.
