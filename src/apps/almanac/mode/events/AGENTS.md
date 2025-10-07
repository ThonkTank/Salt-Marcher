# Ziele
- Implementiert DOM-Komponenten für die Ereignisansicht der Kartenansicht.
- Dokumentiert Rendering-Verträge für Marker, Cluster und weitere Visualisierungen.

# Aktueller Stand
- Noch keine Komponenten vorhanden; State-Machine liefert bereits gefilterte Phänomen-Daten.
- Tests werden in `tests/apps/almanac` gepflegt und spiegeln Interaktionen des Controllers wider.

# ToDo
- [P1] Ergänze Styling-Hooks, sobald ein dediziertes Stylesheet für die Kartenansicht entsteht.

# Standards
- Jede Datei beginnt mit einem einleitenden Kommentar (`// <relativer Pfad>` + Zweck).
- Komponenten exponieren reine Funktionen, die DOM-Nodes in einen bereitgestellten Host rendern.
- Exportiere Komponenten gebündelt über `index.ts` dieses Ordners.
