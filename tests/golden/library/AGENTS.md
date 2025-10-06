# Ziele
- Versioniert Golden-Datensätze der Library-Serializer pro Domäne.

# Aktueller Stand
- Enthält Creatures-, Items-, Equipment- und Spell-Goldens inklusive Manifesten.

# ToDo
- keine offenen ToDos.

# Standards
- Pro Domäne existiert ein `.manifest.json` mit `schemaVersion`, `domain`, `generatedBy`, `generatedAt` und `samples`.
- `samples` enthalten `fixtureId`, `name`, `storagePath`, `goldenFile` und `checksum` (sha256 über den Markdown-Inhalt).
- Golden-Markdown-Dateien sind UTF-8 codiert, enden mit Newline und werden nicht manuell editiert.
