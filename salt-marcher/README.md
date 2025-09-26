# Salt Marcher Plugin

## Purpose & Audience
Salt Marcher erweitert Obsidian um spezialisierte Workspaces für hexcrawl-orientierte Kampagnen. Dieses Dokument richtet sich an Entwickler:innen und Power-User, die das Plugin verstehen, erweitern oder in eigene Toolchains integrieren möchten. Für reine Anwenderthemen verweisen wir auf die Projekt-Wiki-Seiten in diesem Repository.

## Systemüberblick
Das Plugin registriert beim Laden die Cartographer-, Library- und Encounter-Workspaces, erstellt fehlende Datenquellen (z. B. Terrains) und hält sie über Dateiwächter synchron. Gemeinsame UI-Bausteine sorgen dafür, dass Karten, Reiserouten und Nachschlage-Einträge dieselben Datenmodelle teilen. Ergänzende Detaildokumente zu Architektur und Abläufen befinden sich im Ordner [`docs/`](docs/README.md).

## Verzeichnisstruktur
```
salt-marcher/
├─ manifest.json            # Obsidian-Manifest (zeigt auf main.js)
├─ main.js                  # Gebündeltes Plugin-Artefakt
├─ docs/                    # Architektur- und Workflow-Dokumentation
│  ├─ README.md             # Einstiegspunkt für die Plugin-Dokumentation
│  ├─ cartographer/         # Cartographer-spezifische Overviews
│  ├─ core/                 # Kernservices & Datenhaltung
│  ├─ library/              # Verwaltungs- und Datenbank-Flows
│  └─ ui/                   # Geteilte UI-Komponenten & Shells
├─ src/
│  ├─ app/                  # Plugin-Bootstrap, CSS und Integrationen
│  ├─ apps/                 # Feature-Workspaces (Cartographer, Encounter, Library)
│  ├─ core/                 # Domain-Services & Persistenzlogik
│  └─ ui/                   # View-Container, Dialoge und Workflows
├─ tests/                   # Vitest-Suites (aktuell Cartographer-Presenter)
└─ package.json             # Build- und Development-Skripte
```

## Arbeitsbereiche & Ressourcen
- **Cartographer:** Hex-Karten bearbeiten, Reisen visualisieren und Begegnungen auslösen. Siehe [Cartographer-Guide](../wiki/Cartographer.md) sowie die technischen Overviews unter [`docs/cartographer/`](docs/cartographer/README.md).
- **Library:** Terrains, Regionen, Kreaturen und Zauber verwalten. Nutzungsanleitung im [Library-Guide](../wiki/Library.md) und ergänzende Architekturhinweise unter [`docs/library/`](docs/library/README.md).
- **Encounter:** Begegnungen verwalten, die aus dem Travel-Modus oder der Library gestartet werden. Grundlagen im [Encounter-Guide](../wiki/Encounter.md).

Weitere Nutzer-Workflows, Schritt-für-Schritt-Anleitungen und FAQ-Einträge sind im [Projekt-Wiki](../wiki/README.md) gesammelt.

## To-Do
- [Cartographer presenter respects abort signals](../todo/cartographer-presenter-abort-handling.md) – Abort-Signal-Handling komplett durchziehen.
- [Cartographer mode registry](../todo/cartographer-mode-registry.md) – Modi flexibel registrieren und konfigurieren.
- [UI terminology consistency](../todo/ui-terminology-consistency.md) – Einheitliche englische Terminologie bis ins gebündelte `main.js` sicherstellen.

## Dokumentations- und Beitragshinweise
Die technische Dokumentation dieses Plugins orientiert sich am übergeordneten [Documentation Hub](../DOCUMENTATION.md) und dem bereichsspezifischen [Docs-Index](docs/README.md). Bitte richte neue Beiträge am [Style Guide](../style-guide.md) des Projekts aus und verlinke zusätzliche Detaildokumente innerhalb des bestehenden Dokumentationsnetzes.
