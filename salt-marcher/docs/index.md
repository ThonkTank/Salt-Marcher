# Salt Marcher Documentation Index

## Purpose & Audience
Diese Indexseite verknüpft die Bereichsdokumente des Plugins. Sie richtet sich an Entwickler:innen, die Architekturentscheidungen
nachvollziehen oder neue Features ergänzen wollen. Nutzerorientierte Guides findest du im [Projekt-Wiki](../../wiki/Home.md).

## Struktur
```
docs/
├─ index.md
├─ cartographer/
├─ core/
├─ library/
└─ ui/
```
Die Unterordner spiegeln die Hauptbereiche des Plugins wider. Jede README beschreibt die enthaltenen Detaildokumente und verweist
auf weiterführende Ressourcen.

## Bereiche
- [Cartographer](cartographer/README.md) – Karten-Workspace mit Editor-, Inspector- und Travel-Modi sowie deren Infrastruktur.
- [Core](core/README.md) – Persistenz, Hex-Geometrie und zentrale Services, die Workspaces mit Daten versorgen.
- [Library](library/README.md) – Verwaltung von Kreaturen, Zaubern, Terrains und Regionen inklusive Event-Flows.
- [UI](ui/README.md) – Wiederverwendbare UI-Bausteine, Shell-Komponenten und Map-spezifische Workflows.

## Standards & Pflege
Alle neuen oder aktualisierten Dokumente müssen dem [Documentation Style Guide](../../docs/style-guide.md) entsprechen. Ergänze
Querverlinkungen zwischen den Bereichen, sobald sich Verantwortlichkeiten überschneiden, und halte die Strukturdiagramme aktuell.

## To-Do
- [Presenter reagiert nicht auf Abbruchsignale](../../todo/presenter-abort-signal.md)
- [Modi deklarativ registrieren](../../todo/cartographer-mode-registry.md)
- [Mode-Queue als robuste State-Machine ausbauen](../../todo/cartographer-mode-queue-state-machine.md)
- [Hex-Renderer modularisieren](../../todo/hex-renderer-modularization.md)
- [Terminologie vereinheitlichen](../../todo/ui-terminology-consistency.md)
