# Encounter Workspace Documentation

## Purpose & Audience
Dieses Dokument fasst den aktuellen technischen Stand des Encounter-Workspaces zusammen. Es richtet sich an Entwickler:innen, die den Travel→Encounter-Hand-off warten oder zukünftige Encounter-Tools planen. Nutzerorientierte Guides findest du im [Projekt-Wiki](../../../wiki/Encounter.md).

## Strukturübersicht
```
docs/encounter/
└─ README.md

src/apps/encounter/
├─ event-builder.ts   # erzeugt Encounter-Events aus Travel-State (Region, Odds, Uhrzeit)
├─ presenter.ts       # Presenter mit Persistenz-Handling & Store-Anbindung
├─ session-store.ts   # globaler Pub/Sub-Store für Encounter-Hand-offs
└─ view.ts            # Obsidian-ItemView, nutzt Presenter & rendert UX
```
Der Workspace besteht aus einem Presenter, einem Event-Store und der Obsidian-View. `EncounterView` orchestriert die Komponenten und rendert die UX-Bausteine (Kontextliste, Notizenfeld, Auflösen-Button).

## Workspace-Komponenten & Verantwortlichkeiten
- **`EncounterView` (`src/apps/encounter/view.ts`)** – registriert als `salt-encounter`-ItemView, bindet den Presenter ein und rendert Encounter-Kontext (Region, Hex, Odds), Statusanzeige, Notizen-Textarea sowie den "resolved"-Button. Persistiert View-State via `getViewData`/`setViewData`.
- **`EncounterPresenter` (`src/apps/encounter/presenter.ts`)** – verwaltet Encounter-Session-Status (Notizen, Auflösung) und lauscht auf Events des Stores. Normalisiert Persistenzdaten und stellt Listener für die View bereit.
- **`session-store.ts`** – leichtgewichtiger Pub/Sub-Store. Hält das jüngste Encounter-Event für frisch gemountete Views vor und verteilt Travel-Hand-offs an Presenter-Instanzen.
- **`event-builder.ts`** – extrahiert aus dem Travel-State Region, Odds und Uhrzeit. Baut ein normalisiertes `EncounterEvent`, das der Store broadcastet.
- **Travel-Anbindung** – Cartographer ruft `openEncounter(app, { mapFile, state })` aus `travel-guide/encounter-gateway.ts` auf. Das Gateway erzeugt daraus ein Event, published es im Store und öffnet den rechten Workspace-Leaf.

## Soll-Workflows & aktueller Status
1. **Encounter durch Travel-Events öffnen.** Travel pausiert Playback, erzeugt via Gateway ein Encounter-Event und fokussiert den Encounter-Workspace. _Status:_ Implementiert über `openEncounter` (Gateway) und `publishEncounterEvent` (Store); neue Events erscheinen unmittelbar in der View.
2. **Encounter-Kontext anzeigen und bearbeiten.** Die View rendert eine Zusammenfassung (Region, Hex, Uhrzeit, Odds, Map), ermöglicht Notizen und bietet einen Abschluss-Button. _Status:_ Implementiert als Minimal-UX. Erweiterte Tools (z. B. Gegnerlisten) sind nicht Teil des aktuellen Backlogs.
3. **Encounter-Status persistieren.** Presenter + View speichern Notizen und Auflösungsstatus via `getViewData`/`setViewData`, sodass Workspace-Restores den Encounter fortführen. _Status:_ Implementiert; Travel-Resume bleibt bewusst manuell.

## Review-Log & nächste Schritte
- **2025-09-26 – Encounter workspace review:** Der frühere Placeholder wurde ersetzt; keine offenen Architektur-Gaps. Verbesserungsideen künftig als neue To-Dos anlegen. Details siehe [`Notes/encounter-workspace-review.md`](../../../Notes/encounter-workspace-review.md).

## Verwandte Dokumente
- Travel-Integration: [`docs/cartographer/travel-mode-overview.md`](../cartographer/travel-mode-overview.md)
- Nutzerworkflows: [`wiki/Encounter.md`](../../../wiki/Encounter.md)
- Architekturkritik (Historie): [`Notes/encounter-workspace-review.md`](../../../Notes/encounter-workspace-review.md)

## Standards & Erwartungen
- Encounter-spezifische Views müssen Obsidian-Lifecycle-Hooks (`onOpen`, `onClose`, perspektivisch `onPaneMenu`, `onload`) nutzen, um DOM- und Event-Listener deterministisch zu verwalten.
- Datenquellen für Encounter (Regions, Library, Travel-Events) sind strikt voneinander zu entkoppeln. Verwende Stores/Services statt direkten DOM-Zugriffen.
- Styles für `sm-encounter-view` sind zentral zu bündeln (vgl. `src/app/css.ts`), damit Theme-Anpassungen konsistent bleiben.
- Erweiterungen oder Refactorings sind im passenden To-Do zu dokumentieren und dort gegen getestete Akzeptanzkriterien abzunehmen.
