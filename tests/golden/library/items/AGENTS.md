# Ziele
- Liefert Golden-Referenzen für Item-Presets (Rüstungen, Verbrauchsgüter, Werkzeuge) in Markdown-Form.
- Unterstützt Parser- und Renderer-Tests, indem realistische Beispiele vorliegen.

# Aktueller Stand
- Enthält mehrere Items mit unterschiedlichen Eigenschaftsblöcken und Metadaten.
- Wird von `tests/library` zum Snapshot-Vergleich verwendet.

# ToDo
- [P3] Neue Item-Kategorien aufnehmen, sobald die Library sie unterstützt.
- [P3] Ergänzende JSON-Repräsentationen ablegen, falls Export-Pipeline erweitert wird.

# Standards
- Keine Formatierungstools auf die Dateien anwenden; Markdown bleibt exakt wie produziert.
- Änderungen stets in Commit-Botschaft dokumentieren und mit Library-Tests absichern.
