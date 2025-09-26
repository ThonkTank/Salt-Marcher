# Encounter Workspace Documentation

## Purpose & Audience
Dieses Dokument fasst den aktuellen technischen Stand des Encounter-Workspaces zusammen. Es richtet sich an Entwickler:innen, die den Travel→Encounter-Hand-off warten oder zukünftige Encounter-Tools planen. Nutzerorientierte Guides findest du im [Projekt-Wiki](../../../wiki/Encounter.md).

## Strukturübersicht
```
docs/encounter/
└─ README.md

src/apps/encounter/
└─ view.ts            # Obsidian-ItemView, aktuell nur Platzhalter-Markup
```
Der Workspace wird ausschließlich durch `EncounterView` bereitgestellt. Weitere Module (State-Management, Presenter, Styles) fehlen derzeit vollständig.

## Workspace-Komponenten & Verantwortlichkeiten
- **`EncounterView` (`src/apps/encounter/view.ts`)** – registriert als `salt-encounter`-ItemView. Öffnet beim Travel-Hand-off einen Pane mit Titel "Encounter", fügt `sm-encounter-view` als CSS-Hook hinzu und rendert statisches Header-Markup.
- **Travel-Anbindung** – Cartographer ruft `openEncounter(app)` aus `travel-guide/encounter-gateway.ts` auf, um die View zu öffnen. Das Gateway erwartet, dass `EncounterView` beim Laden bereit ist, übernimmt jedoch selbst keinerlei UI-Initialisierung.

## Soll-Workflows & Ist-Lücken
1. **Encounter durch Travel-Events öffnen.** Travel pausiert Playback und fokussiert den Encounter-Workspace. _Ist:_ View rendert nur leeren Placeholder, es existiert kein Zustand oder Rendering der Encounter-Daten.
2. **Encounter-Kontext anzeigen und bearbeiten.** Erwartet werden Listen von Gegnern, Aktionen oder Notizen gemäß [Encounter-Wiki](../../../wiki/Encounter.md). _Ist:_ Keine UI-Elemente außer Überschrift; keine Verbindung zu Library-/Regions-Daten.
3. **Encounter schließen und Travel fortsetzen.** Nach Auflösung sollte Travel wiederaufgenommen werden. _Ist:_ View besitzt keine Hooks für Abschlussaktionen oder Kommunikation zurück an Travel.

Die vollständige Gap-Analyse befindet sich in [Notes/encounter-workspace-review.md](../../../Notes/encounter-workspace-review.md).

## Verwandte Dokumente & offene Punkte
- Travel-Integration: [`docs/cartographer/travel-mode-overview.md`](../cartographer/travel-mode-overview.md)
- Nutzerworkflows: [`wiki/Encounter.md`](../../../wiki/Encounter.md)
- Architekturkritik & TODO: [`todo/encounter-workspace-review.md`](../../../todo/encounter-workspace-review.md)

## Standards & Erwartungen
- Encounter-spezifische Views müssen Obsidian-Lifecycle-Hooks (`onOpen`, `onClose`, perspektivisch `onPaneMenu`, `onload`) nutzen, um DOM- und Event-Listener deterministisch zu verwalten.
- Datenquellen für Encounter (Regions, Library, Travel-Events) sind strikt voneinander zu entkoppeln. Verwende Stores/Services statt direkten DOM-Zugriffen.
- Styles für `sm-encounter-view` sind zentral zu bündeln (vgl. `src/app/css.ts`), damit Theme-Anpassungen konsistent bleiben.
- Erweiterungen oder Refactorings sind im passenden To-Do zu dokumentieren und dort gegen getestete Akzeptanzkriterien abzunehmen.
