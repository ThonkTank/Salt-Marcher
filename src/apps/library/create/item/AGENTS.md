# Ziele
- Enthält Formular- und Validation-Logik für das Erstellen von Item-Einträgen im Library-Creator.
- Synchronisiert UI-Komponenten mit den Parsern aus `library/tools` für Roundtrip-Tests.

# Aktueller Stand
- Unterstützt Kernfelder (Name, Kategorie, Seltenheit, Effekte) inklusive Auto-Slugging.
- Re-exports in `create/index.ts` binden die Komponenten in die Creator-Shell ein.

# ToDo
- [P2] Mehrfeld-Unterstützung (z. B. Aufladungen, Verbrauchsregeln) implementieren.
- [P3] i18n-Vorbereitung für Formularlabels evaluieren.

# Standards
- Komponenten besitzen Kopfkommentare und nutzen Shared-Controls aus `../shared`.
- Änderungen erfordern Tests in `tests/library/create/item` (DOM/Validation) und Dokumentationsupdate.
