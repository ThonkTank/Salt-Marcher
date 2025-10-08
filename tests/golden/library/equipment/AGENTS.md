# Ziele
- Beinhaltet Golden-Samples für Ausrüstungs-Presets (Waffen, Gear, Werkzeuge) zur Validierung.
- Dient als Fixpunkt für Markdown-Serialisierung und Tabelle-Renderer.

# Aktueller Stand
- Mehrere Files decken verschiedene Unterkategorien (Nahkampf, Fernkampf, Utility) ab.
- Tests in `tests/library` vergleichen Parser-Ausgabe mit diesen Referenzen.

# ToDo
- [P3] Neue Spalten oder Regeln nachziehen, sobald das Datenmodell wächst.
- [P3] Weitere Beispielausrüstung für exotische Quellen ergänzen.

# Standards
- Golden-Dateien nicht beautifien; erhaltene Whitespaces sichern die Vergleichbarkeit.
- Jede Änderung an den Samples erfordert einen Testlauf (`npm test`).
