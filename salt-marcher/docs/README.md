# Salt Marcher Documentation Index

## Purpose & Audience
Diese Indexseite verknüpft die Bereichsdokumente des Plugins. Sie richtet sich an Entwickler:innen, die Architekturentscheidungen
nachvollziehen oder neue Features ergänzen wollen. Nutzerorientierte Guides findest du im [Projekt-Wiki](../../wiki/README.md).

## Struktur
```
docs/
├─ README.md
├─ cartographer/
├─ core/
├─ encounter/
├─ library/
└─ ui/
```
Die Unterordner spiegeln die Hauptbereiche des Plugins wider. Jede README beschreibt die enthaltenen Detaildokumente und verweist
auf weiterführende Ressourcen.

## Bereiche
- [Cartographer](cartographer/README.md) – Karten-Workspace mit Editor-, Inspector- und Travel-Modi sowie deren Infrastruktur.
- [Core](core/README.md) – Persistenz, Hex-Geometrie und zentrale Services, die Workspaces mit Daten versorgen.
- [Encounter](encounter/README.md) – Placeholder-Workspace für Begegnungen; analysiert die aktuelle Gateway-Implementierung und dokumentiert offene Arbeiten.
- [Library](library/README.md) – Verwaltung von Kreaturen, Zaubern, Terrains und Regionen inklusive Event-Flows.
- [UI](ui/README.md) – Wiederverwendbare UI-Bausteine, Shell-Komponenten und Map-spezifische Workflows.

## Standards & Pflege
Alle neuen oder aktualisierten Dokumente müssen dem [Documentation Style Guide](../../style-guide.md) entsprechen. Ergänze
Querverlinkungen zwischen den Bereichen, sobald sich Verantwortlichkeiten überschneiden, und halte die Strukturdiagramme aktuell.
