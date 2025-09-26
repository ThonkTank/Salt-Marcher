# Map-Manager Overview

## Strukturdiagramm
```
src/ui/
└─ map-manager.ts      # Stellt `createMapManager` als zentrales Steuerobjekt bereit
   ├─ map-workflows.ts # Prompt-Dialoge für Auswahl/Erstellung
   ├─ confirm-delete.ts# Bestätigungsdialog vor dem Löschen
   └─ ../core/map-delete.ts
                      # Löscht Karten-Datei und assoziierte Tiles
```

## Aufgaben & Datenfluss
- `createMapManager` kapselt den aktuellen Karten-State (`current`) und veröffentlicht die UI-Aktionen `open`, `create`, `setFile`, `deleteCurrent`.
- Auswahl/Erstellung laufen jeweils über die Prompt-Helfer aus `map-workflows.ts`, das Ergebnis wird über `applyChange` synchronisiert.
- Beim Löschen wird über `ConfirmDeleteModal` ein Dialog geöffnet. Nach der Bestätigung erfolgt der Aufruf von `deleteMapAndTiles`, der bei Erfolg den State leert.

## Fehlerbehandlung beim Löschen
- Die Delete-Callback-Logik ist in `try/catch` gekapselt. So bleiben Fehler beim Entfernen der Map/Tile-Dateien nicht stumm.
- Schlägt `deleteMapAndTiles` fehl, protokolliert der Manager den Fehler via `console.error` und informiert Anwender:innen mit einem `Notice`.
- Der `onChange(null)`-Callback wird nur nach erfolgreich abgeschlossenem Löschvorgang ausgeführt, wodurch externe Konsumenten keine inkonsistenten Zustände erhalten.
