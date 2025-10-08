# Ziele
- Enthält Golden-Master-Dumps für Zauber-Presets zur Validierung der Exportpipelines.
- Stellt Referenz-Markdown bereit, damit Parser-Änderungen regressionsfrei geprüft werden können.

# Aktueller Stand
- Drei repräsentative Zauber-Cases spiegeln unterschiedliche Kategorien und Notationsstile wider.
- Datensätze werden in Tests unter `tests/library` als Fixture geladen.

# ToDo
- [P3] Bei neuen Preset-Feldern die Golden-Dateien aktualisieren und Tests erweitern.
- [P3] Zusätzliche Beispiele für Rituale und Reaktionszauber ergänzen.

# Standards
- Dateien bleiben unverändert formatiert (kein Prettier), damit Diff-Vergleiche stabil sind.
- Änderungen an Presets immer mit `tests/library`-Snapshots abstimmen und `npm test` ausführen.
