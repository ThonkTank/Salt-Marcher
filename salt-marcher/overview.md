# Salt Marcher – Plugin Overview

## Purpose & Scope
Dieses Dokument fasst die technische Struktur des Salt-Marcher-Plugins für Obsidian zusammen. Es dient Entwickler:innen als Einstieg in die Codebasis, verweist auf Detaildokumente unter `docs/` und beschreibt die wichtigsten Integrationspunkte.

## Repository Layout
```
salt-marcher/
├─ manifest.json          # Obsidian-Manifest (lädt main.js)
├─ main.js                # Gebündeltes Plugin-Artefakt
├─ README.md              # Produkt- & Architekturüberblick
├─ docs/                  # Bereichsdokumentation (siehe unten)
│  ├─ README.md           # Navigationsübersicht
│  ├─ app/                # Plugin-Bootstrap, Integrationen, Standards
│  ├─ cartographer/       # Karten-Workspace (README + Overviews)
│  ├─ core/               # Domain- und Persistenzdienste
│  ├─ library/            # Verwaltungs- und Datenbank-Flows
│  └─ ui/                 # Geteilte UI-Komponenten
├─ src/
│  ├─ app/                # Plugin-Bootstrap, CSS, Integrationen
│  ├─ apps/               # Feature-Workspaces (Cartographer, Encounter, Library)
│  ├─ core/               # Hex- und Daten-Services
│  └─ ui/                 # Wiederverwendbare UI-Bausteine
└─ tests/                 # Vitest-Suites (Presenter, Mocks)
```

## Kernbereiche
- **App Bootstrap:** Lifecycle-Management, View-Registrierung, Terrain-Watcher und Integrationen sind im [`docs/app/`](docs/app/README.md) dokumentiert.
- **Cartographer Workspace:** Hex-Map-Stage mit Editor-, Inspector- und Travel-Modi, orchestriert durch Presenter und View-Shell. Struktur und Komponenten sind im [`docs/cartographer/`](docs/cartographer/README.md) beschrieben.
- **Library Workspace:** Verwaltungsoberfläche für Terrains, Regionen, Kreaturen und Zauber. Architekturüberblick unter [`docs/library/`](docs/library/README.md).
- **Encounter Workspace:** Fokus-View für Begegnungen, die aus Cartographer- oder Library-Events gestartet werden. Ergänzende Hinweise liegen im Projekt-Wiki ([Encounter-Guide](../wiki/Encounter.md)).
- **Core Services:** Hex-Geometrie, Kartenpersistenz, Terrain-/Regions-Stores und Dateihilfen, dokumentiert in [`docs/core/`](docs/core/README.md).
- **Geteilte UI:** View-Container, Dialoge und Map-Workflows für alle Workspaces, siehe [`docs/ui/`](docs/ui/README.md).

## Daten- & Kontrollfluss
1. **Bootstrap (`src/app/main.ts`):** Registriert Views, Commands und Ribbon-Icons, initialisiert Terrain-Daten und CSS. Detailstandards und offene Fragen findest du im [App-Bootstrap-Dokument](docs/app/README.md).
2. **Datenhaltung:** `core/terrain-store.ts`, `core/regions-store.ts` sowie Map-Helfer synchronisieren Vault-Dateien mit den Views.
3. **Workspaces:** Cartographer-, Library- und Encounter-Apps beobachten die Stores, aktualisieren UI-Zustand und lösen Aktionen wie Encounter-Starts oder Map-Saves aus.
4. **Integrationen:** Die optionale `layout-editor-bridge.ts` bindet den Cartographer an den Layout Editor, während UI-Komponenten (`src/ui/*`) konsistente Dialoge und Header bereitstellen.

## Dokumentation & Standards
Die Bereichsdokumente unter [`docs/`](docs/README.md) werden nach jedem Feature-Update gepflegt. Der repository-weite Einstieg steht im [Documentation Hub](../DOCUMENTATION.md). Für neue Beiträge bitte den projektspezifischen [Style Guide](../style-guide.md) beachten und Querverlinkungen zu bestehenden Overviews setzen. Bootstrap-bezogene Refactorings sind im [Plugin Bootstrap Review](../todo/plugin-bootstrap-review.md) dokumentiert.

## To-Do
- [UI terminology consistency](../todo/ui-terminology-consistency.md) – Einheitliche UI-Sprache und Kommentare sicherstellen.
- [Plugin Bootstrap Review](../todo/plugin-bootstrap-review.md) – Verantwortlichkeiten des Bootstraps präzisieren, Error-Handling und Tests evaluieren.
