# Ziele
- Verwalten von Formularen und Mappings für Ausrüstungs-Einträge (Waffen, Rüstungen, Werkzeuge).
- Sicherstellen, dass Creator-Eingaben konsistent in Preset-Formate exportiert werden.

# Aktueller Stand
- Unterstützt Basisattribute (Kosten, Gewicht, Eigenschaften) und arbeitet mit Shared Controls.
- Wird durch Integrationstests im Library-Creator abgedeckt.

# ToDo
- [P2] Spezialfälle (modulare Waffen, Upgrade-Slots) modellieren.
- [P3] Tooltips und Hilfetexte aus `docs/library` übernehmen.

# Standards
- Komponenten nutzen gemeinsame Utilitys aus `../shared` und sind strikt typisiert.
- Änderungen an Datenstrukturen werden in `BUILD.md` sowie `tests/library` synchronisiert.
