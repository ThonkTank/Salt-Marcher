# Ziele
- Stellt die Atlas-spezifischen Create-Dialoge für Terrains und Regionen auf Basis der gemeinsamen Workmode-Infrastruktur bereit.
- Dokumentiert Validierung, Pipeline-Anbindung und Re-Exports für die View-Renderer.

# Aktueller Stand
- `terrains-modal.ts` und `regions-modal.ts` kapseln Formularfelder sowie Validierungslogik für neue Atlas-Einträge.
- `index.ts` re-exportiert die Modalklassen für den Einsatz in den View-Renderern.

# ToDo
- keine offenen ToDos.

# Standards
- Jede Datei beginnt mit einem Kommentar aus Dateipfad und Kurzbeschreibung des Zwecks.
- Öffentliche Modalkonstruktoren akzeptieren bestehende Namen/Optionen für Validierung und Anzeigen.
- Neue Exporte werden über `index.ts` gebündelt.
