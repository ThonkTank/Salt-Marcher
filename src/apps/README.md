# Salt Marcher Apps

Die Plugin-Oberfläche besteht aus fünf spezialisierten Arbeitsbereichen.

## Cartographer
Verwalte Hex-Karten, wechsle zwischen Editor- und Inspector-Modus und pflege Karten-Dateien über die Map-Header-Leiste. Der Travel-Workflow lebt in der Session-Runner-App. [Details](./cartographer/README.md)

## Session Runner
Führt Reise-Sessions inklusive Playback, Sidebar und Encounter-Sync aus. Nutzt dieselben Karten- und Terrain-Dienste wie der Cartographer. [Details](./session-runner/AGENTS.md)

## Encounter
Zeigt aktive Reisebegegnungen, ermöglicht Notizen und markiert Sessions als erledigt. [Details](./encounter/README.md)

## Library
Durchsuche und erweitere die Nachschlagewerke für Kreaturen, Zauber, Items und Ausrüstung. [Details](./library/README.md)

## Atlas
Pflege Gelände- und Regionsdaten mit Auto-Save und Filteroptionen in einer separaten Workmode-Ansicht. [Details](./atlas/README.md)

## Almanac
Verwalte Kalender, Phänomene und Zeitfortschritt zentral, inklusive Dashboard-, Manager- und Events-Modi. [Details](./almanac/IMPLEMENTATION_PLAN.md)

### Schnellzugriff
- Ribbon-Symbole in Obsidian öffnen Cartographer (Kompass), Session Runner (Play), Library (Buch) und Atlas (Karte).
- Der Encounter-Bereich erscheint automatisch, sobald der Session Runner eine Begegnung auslöst.
- Almanac steht über ein Kalender-Ribbon sowie den Command „Open Almanac“ bereit und nutzt denselben Aktivierungs-Helfer wie die anderen Views.

## Entry-Points

| App | View-Klasse & Typ | Controller/Presenter | Öffnen/Detach-Helfer |
| --- | --- | --- | --- |
| Cartographer | `CartographerView` (`VIEW_CARTOGRAPHER`) | `CartographerController` | `openCartographer(app, file?)`, `detachCartographerLeaves(app)` |
| Session Runner | `SessionRunnerView` (`VIEW_SESSION_RUNNER`) | `SessionRunnerController` | `openSessionRunner(app, file?)`, `detachSessionRunnerLeaves(app)` |
| Encounter | `EncounterView` (`VIEW_ENCOUNTER`) | `EncounterPresenter` | – |
| Library | `LibraryView` (`VIEW_LIBRARY`) | – (Renderer pro Modus) | `openLibrary(app)` |
| Atlas | `AtlasView` (`VIEW_ATLAS`) | – (Renderer pro Modus) | `openAtlas(app)` |
| Almanac | `AlmanacView` (`VIEW_ALMANAC`) | `AlmanacController` | `openAlmanac(app)` |

## Event-Flows

### Cartographer
1. `src/app/main.ts` lädt den Cartographer, `controller.ts` baut Layout und Header auf und liest den aktiven Markdown-Tab als Karte ein.
2. Der gewählte Modus aus `cartographer/modes` (Editor/Inspector) aktiviert seine Lifecycle-Hooks und erhält Hex-Daten aus `core/hex-mapper`.

### Session Runner
1. `apps/view-manifest.ts` registriert den Session Runner inklusive Ribbon/Command (`openSessionRunner`).
2. `session-runner/controller.ts` initialisiert View-Container, Map-Manager und lädt das Reise-Erlebnis (`view/experience.ts`).
3. Travel-Trigger delegieren über `session-runner/travel/infra/encounter-sync` an die Encounter-App und aktualisieren Routen über `session-runner/travel/domain`.

### Almanac
1. `apps/view-manifest.ts` registriert `AlmanacView` inklusive Ribbon/Command (`openAlmanac`).
2. `almanac/index.ts` initialisiert den `AlmanacController`, der Vault-Repositories sowie das `cartographerHookGateway` bündelt.
3. Session Runner und Almanac synchronisieren Kalenderzustände über den Cartographer-Bridge/Gateway-Pfad, wodurch Travel-Leaves Fortschritt und Ereignisse spiegeln.

### Encounter
1. Session-Runner-Gateways publizieren Begegnungsdaten, die `encounter/session-store.ts` speichert.
2. `encounter/presenter.ts` bereitet die Sitzung für die UI auf und meldet Statusänderungen an Obsidian.
3. `encounter/view.ts` reagiert auf Presenter-Events und schreibt Notizen synchron zurück in den Store.

### Library
1. Der Library-Launcher lädt Datenquellen über `library/core/*` und hält sie als In-Memory-Collections.
2. Tab-Wechsel im View-Shell lösen Renderer in `library/view` aus, die Listen filtern und Aktionen verdrahten.
3. Create-Dialoge unter `library/create` schreiben neue Dateien und melden erfolgreiche Saves zurück an die Views.
