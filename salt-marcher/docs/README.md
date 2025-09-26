# Salt Marcher Documentation Index

## Purpose & Audience
Diese Indexseite verknüpft die Bereichsdokumente des Plugins. Sie richtet sich an Entwickler:innen, die Architekturentscheidungen nachvollziehen oder neue Features ergänzen wollen. Nutzerorientierte Guides findest du im [Projekt-Wiki](../../wiki/README.md).

## Struktur
```
docs/
├─ README.md
├─ app/
├─ cartographer/
├─ core/
├─ library/
└─ ui/
```
Die Unterordner spiegeln die Hauptbereiche des Plugins wider. Jede README beschreibt die enthaltenen Detaildokumente und verweist auf weiterführende Ressourcen.

## Bereiche
- [App Bootstrap](app/README.md) – Plugin-Lifecycle, View-Registrierung, Terrain-Watcher und Integrationen wie die Layout-Editor-Bridge.
- [Cartographer](cartographer/README.md) – Karten-Workspace mit Editor-, Inspector- und Travel-Modi sowie deren Infrastruktur.
- [Core](core/README.md) – Persistenz, Hex-Geometrie und zentrale Services, die Workspaces mit Daten versorgen.
- [Library](library/README.md) – Verwaltung von Kreaturen, Zaubern, Terrains und Regionen inklusive Event-Flows.
- [UI](ui/README.md) – Wiederverwendbare UI-Bausteine, Shell-Komponenten und Map-spezifische Workflows.

## Standards & Pflege
Alle neuen oder aktualisierten Dokumente müssen dem [Documentation Style Guide](../../style-guide.md) entsprechen. Ergänze Querverlinkungen zwischen den Bereichen, sobald sich Verantwortlichkeiten überschneiden, und halte die Strukturdiagramme aktuell. Bootstrap-spezifische Standards (Lifecycle, optionale Integrationen, CSS-Injektion) sind im [App-Bootstrap-Dokument](app/README.md) festgehalten; offene Refactorings werden im [Plugin Bootstrap Review](../../todo/plugin-bootstrap-review.md) verfolgt.
