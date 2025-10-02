# Ziele
- Stellt gemeinsame UI-Komponenten für Kartenverwaltung und Suche bereit.

# Aktueller Stand
- `view-container.ts` rahmt App-Views in Obsidian ein.
- `map-manager.ts` koordiniert Dateiaktionen und modals.
- `map-header.ts`, `map-workflows.ts` und `modals.ts` liefern Bedienoberflächen.
- `search-dropdown.ts` und `copy.ts` kapseln Interaktionstexte.

# ToDo
- Komponenten auf Responsiveness und mobile Layouts prüfen.
- Such- und Filter-UI für größere Datenmengen erweitern.
- Kopierte Texte zentralisieren, sobald Übersetzungen nötig werden.

# Standards
- Jede UI-Datei startet mit Zweck und Nutzeraktion im Kopfkommentar.
- Sichtbare Strings liegen in `copy.ts` oder nahegelegenen Konstanten.
- Modals validieren Eingaben bevor Dateien geändert werden.
