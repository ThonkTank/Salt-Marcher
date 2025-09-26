# Cartographer Documentation

## Überblick
Dieser Ordner beschreibt den Cartographer-Workspace – die Hex-Kartenbühne mit Editor-, Inspector- und Travel-Modi. Die Inhalte
richten sich an Entwickler:innen, die Rendering, Interaktionen oder Datenflüsse anpassen möchten.

## Struktur
```
docs/cartographer/
├─ README.md
├─ map-layer-overview.md
├─ travel-mode-overview.md
└─ view-shell-overview.md
```

## Inhalte
- [view-shell-overview.md](view-shell-overview.md) – Aufbau der Cartographer-Shell, Presenter-Anbindung und Lifecycle-Hooks.
- [map-layer-overview.md](map-layer-overview.md) – Rendering-Pipeline, Layer-Architektur und Datenquellen der Hex-Map.
- [travel-mode-overview.md](travel-mode-overview.md) – Travel-spezifische Controller, Playback-Logik und Encounter-Anbindung.
- **Mode-State-Machine** – Der Presenter verwaltet Modewechsel über die Phasen `idle → exiting → entering`, cancelbar über interne `AbortController`. Details siehe Abschnitt „State-Machine“ unten.

## Weiterführende Ressourcen
- Nutzerperspektive im [Cartographer-Wiki-Eintrag](../../../wiki/Cartographer.md).
- Dokumentationsstandards gemäß [Style Guide](../../../style-guide.md).

## State-Machine
Der `CartographerPresenter` verfolgt jeden Modewechsel als eigene State-Machine-Instanz mit Phasen `idle`, `exiting` und `entering`. Jeder Wechsel erhält einen dedizierten `AbortController`, der sowohl UI-Abbrüche (`ModeSelectContext.signal`) als auch supersedierende Wechsel zusammenführt. Dadurch räumt `onExit` deterministisch auf, `onEnter`/`onFileChange` laufen nur, solange das Signal nicht abgebrochen wurde, und parallele Wechsel zerstören keine bereits erstellten Layer mehr.【F:salt-marcher/src/apps/cartographer/presenter.ts†L102-L198】【F:salt-marcher/src/apps/cartographer/presenter.ts†L510-L663】

## To-Do
- Keine Cartographer-spezifischen Backlog-Einträge offen. Überblick siehe [todo/README.md](../../../todo/README.md).
