# Core Documentation

## Überblick
Der Core-Bereich bündelt zentrale Services: Hex-Geometrie, Persistenz und Dateioperationen. Diese README hilft Entwickler:innen,
schnell passende Module für Daten- und Rechenlogik zu finden.

## Struktur
```
docs/core/
├─ README.md
├─ hex-render-overview.md
├─ regions-store-overview.md
└─ terrain-store-overview.md
```

## Inhalte
- [hex-render-overview.md](hex-render-overview.md) – Renderer-Architektur, Kamera-Logik und Hex-Koordinatensystem.
- [regions-store-overview.md](regions-store-overview.md) – Lifecycle des Regions-Stores, aktuelles Verhalten bei Dateiverlust und Folgearbeiten.
- [terrain-store-overview.md](terrain-store-overview.md) – Laden, Beobachten und Synchronisieren der Terrain-Daten.

## Weiterführende Ressourcen
- Nutzung im Kontext der Workspaces siehe [Cartographer](../cartographer/README.md) und [Library](../library/README.md).
- Richtlinien zur Dokumentation: [Style Guide](../../../style-guide.md).

## To-Do
Derzeit keine core-spezifischen Backlog-Einträge. Siehe das zentrale [`todo/`](../../../todo/README.md) für bereichsübergreifende Aufgaben.
