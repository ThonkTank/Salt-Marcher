# Salt Marcher Apps

Die Plugin-Oberfläche besteht aus drei spezialisierten Arbeitsbereichen.

## Cartographer
Verwalte Hex-Karten, wechsle zwischen Travel-, Editor- und Inspector-Modus und pflege Karten-Dateien über die Map-Header-Leiste. [Details](./cartographer/README.md)

## Encounter
Zeigt aktive Reisebegegnungen, ermöglicht Notizen und markiert Sessions als erledigt. [Details](./encounter/README.md)

## Library
Durchsuche und erweiter die Nachschlagewerke für Kreaturen, Zauber, Gelände und Regionen. [Details](./library/README.md)

### Schnellzugriff
- Ribbon-Symbole in Obsidian öffnen Cartographer (Kompass) und Library (Buch).
- Der Encounter-Bereich erscheint automatisch, sobald der Travel-Modus eine Begegnung auslöst.

## Event-Flows

### Cartographer
1. `src/app/main.ts` lädt den Cartographer und liest den aktiven Markdown-Tab als Karte ein.
2. Der gewählte Modus aus `cartographer/modes` aktiviert seine Lifecycle-Hooks und erhält Hex-Daten aus `core/hex-mapper`.
3. Travel-Trigger delegieren über `travel/infra/encounter-sync` an die Encounter-App und aktualisieren Routen über `travel/domain`.

### Encounter
1. Travel-Gateways publizieren Begegnungsdaten, die `encounter/session-store.ts` speichert.
2. `encounter/presenter.ts` bereitet die Sitzung für die UI auf und meldet Statusänderungen an Obsidian.
3. `encounter/view.ts` reagiert auf Presenter-Events und schreibt Notizen synchron zurück in den Store.

### Library
1. Der Library-Launcher lädt Datenquellen über `library/core/*` und hält sie als In-Memory-Collections.
2. Tab-Wechsel im View-Shell lösen Renderer in `library/view` aus, die Listen filtern und Aktionen verdrahten.
3. Create-Dialoge unter `library/create` schreiben neue Dateien und melden erfolgreiche Saves zurück an die Views.
