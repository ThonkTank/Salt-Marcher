# Salt Marcher To-Do Backlog

## Purpose & Scope
Dieser Ordner ersetzt die frühere `Critique.txt`-Sammlung. Jede Datei dokumentiert ein offenes Architektur- oder UX-Thema mit Kontext, betroffenen Modulen und möglichen Lösungsansätzen.

## Open Items
- [Main bootstrap service integration](main-bootstrap-service-integration.md) – `createTerrainBootstrap` konfliktfrei an `main.ts` anbinden und Tests reaktivieren.
- [Cartographer presenter respects abort signals](cartographer-presenter-abort-handling.md) – Presenter darf Modewechsel abbrechen, wenn das UI den Vorgang storniert.
- [Cartographer mode registry](cartographer-mode-registry.md) – Modi sollen deklarativ konfigurierbar sein statt hart verdrahtet.
- [UI terminology consistency](ui-terminology-consistency.md) – Quellmodule nutzen einheitliche englische Copy; Build-Artefakte und Release-Checkliste müssen den Stand widerspiegeln, damit keine deutschen Fallback-Strings mehr ausgeliefert werden.

## Latest Review Summary
- **Regions store resilience** – Regions-Watcher rekonstruiert `Regions.md` automatisch, informiert Nutzer:innen per Notice und ist durch Vitest-Suites abgedeckt; Backlog-Eintrag entfernt.
- **UI terminology consistency** – Englischsprachige Copy ist in `src/` zentralisiert und durch Style Guide sowie Language-Policy-Tests abgesichert. Das gebündelte `main.js` enthält jedoch weiterhin veraltete deutsche Defaults; Release-Pipeline muss den Build-Schritt erzwingen (siehe To-Do oben).

## Maintenance Notes
- Aktualisiere Dateien unmittelbar nach Code- oder Dokumentationsänderungen, damit Kontext und Lösungsideen konsistent bleiben.
- Verlinke jede To-Do-Datei in den relevanten README- oder Index-Dokumenten, damit offene Punkte dort sichtbar sind, wo Teams arbeiten.
- Verschiebe erledigte Einträge in ein Archiv oder entferne sie aus diesem Ordner, sobald sie umgesetzt und dokumentiert wurden.
