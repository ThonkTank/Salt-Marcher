# Ziele
- Hält Golden-Master-Statblocks für Kreaturen bereit, um Markdown-Exports zu validieren.
- Testet komplexe Komponenten (Spellcasting, Traits, Multi-Attack) gegen den Parser.

# Aktueller Stand
- Enthält mehrere Kreaturen mit unterschiedlichen Herausforderungsstufen und Sonderregeln.
- Wird in `tests/library/statblock-to-markdown.test.ts` als Vergleichsbasis genutzt.

# ToDo
- [P2] Bei neuen Komponenten (Legendary Actions, Lair Actions) weitere Beispiele anlegen.
- [P3] Statblock-JSON parallel ablegen, sobald Exportpfad aktiv ist.

# Standards
- Dateien unverändert lassen; manuelle Formatierung führt zu Snapshot-Diffs.
- Änderungen an den Musterstatblocks mit Tests dokumentieren und Commit-Botschaft begründen.
