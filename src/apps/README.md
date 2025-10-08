# Salt Marcher Apps

Die Plugin-Oberfläche besteht aus vier spezialisierten Arbeitsbereichen.

## Cartographer
Verwalte Hex-Karten, wechsle zwischen Travel-, Editor- und Inspector-Modus und pflege Karten-Dateien über die Map-Header-Leiste. [Details](./cartographer/README.md)

## Encounter
Zeigt aktive Reisebegegnungen, ermöglicht Notizen und markiert Sessions als erledigt. [Details](./encounter/README.md)

## Library
Durchsuche und erweiter die Nachschlagewerke für Kreaturen, Zauber, Gelände und Regionen. [Details](./library/README.md)

## Almanac
Verwalte Kalender, Phänomene und Zeitfortschritt zentral, inklusive Dashboard-, Manager- und Events-Modi. [Details](./almanac/IMPLEMENTATION_PLAN.md)

### Schnellzugriff
- Ribbon-Symbole in Obsidian öffnen Cartographer (Kompass) und Library (Buch).
- Der Encounter-Bereich erscheint automatisch, sobald der Travel-Modus eine Begegnung auslöst.
- Almanac steht über ein Kalender-Ribbon sowie den Command „Open Almanac“ bereit und nutzt denselben Aktivierungs-Helfer wie die anderen Views.

## Entry-Points

| App | View-Klasse & Typ | Controller/Presenter | Öffnen/Detach-Helfer |
| --- | --- | --- | --- |
| Cartographer | `CartographerView` (`VIEW_CARTOGRAPHER`) | `CartographerController` | `openCartographer(app, file?)`, `detachCartographerLeaves(app)` |
| Encounter | `EncounterView` (`VIEW_ENCOUNTER`) | `EncounterPresenter` | – |
| Library | `LibraryView` (`VIEW_LIBRARY`) | – (Renderer pro Modus) | `openLibrary(app)` |
| Almanac | `AlmanacView` (`VIEW_ALMANAC`) | `AlmanacController` | `openAlmanac(app)` |

## Event-Flows

### Cartographer
1. `src/app/main.ts` lädt den Cartographer, `controller.ts` baut Layout und Header auf und liest den aktiven Markdown-Tab als Karte ein.
2. Der gewählte Modus aus `cartographer/modes` aktiviert seine Lifecycle-Hooks und erhält Hex-Daten aus `core/hex-mapper`.
3. Travel-Trigger delegieren über `travel/infra/encounter-sync` an die Encounter-App und aktualisieren Routen über `travel/domain`.

### Almanac
1. `apps/view-manifest.ts` registriert `AlmanacView` inklusive Ribbon/Command (`openAlmanac`).
2. `almanac/index.ts` initialisiert den `AlmanacController`, der Vault-Repositories sowie das `cartographerHookGateway` bündelt.
3. Travel-Modus und Almanac synchronisieren Kalenderzustände über den Cartographer-Bridge/Gateway-Pfad, wodurch Travel-Leaves Fortschritt und Ereignisse spiegeln.

### Encounter
1. Travel-Gateways publizieren Begegnungsdaten, die `encounter/session-store.ts` speichert.
2. `encounter/presenter.ts` bereitet die Sitzung für die UI auf und meldet Statusänderungen an Obsidian.
3. `encounter/view.ts` reagiert auf Presenter-Events und schreibt Notizen synchron zurück in den Store.

### Library
1. Der Library-Launcher lädt Datenquellen über `library/core/*` und hält sie als In-Memory-Collections.
2. Tab-Wechsel im View-Shell lösen Renderer in `library/view` aus, die Listen filtern und Aktionen verdrahten.
3. Create-Dialoge unter `library/create` schreiben neue Dateien und melden erfolgreiche Saves zurück an die Views.
