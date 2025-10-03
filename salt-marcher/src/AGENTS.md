# Ziele
- Stellt Kernlogik, Apps und Integrationen des Plugins bereit.

# Aktueller Stand
- `core/` bündelt Datenmodelle, Speicher- und Layoutdienste für alle Apps.
- `apps/` gliedert die spezialisierten Oberflächen (Cartographer, Encounter, Library) samt ihren Modus- und Domain-Ordnern.
- `app/` startet das Plugin, registriert Views und verkabelt globale Services.
- `ui/` liefert wiederverwendbare Container, Modals und Copy-Helfer für die Apps.

# Migrationspfade
- Cartographer-Travel synchronisiert Begegnungen mit der Encounter-App über `apps/cartographer/modes/travel-guide/encounter-gateway` und `apps/encounter/session-store`.
- Travel-Domänenzustand (`apps/cartographer/travel/domain`) stellt seine Typen und Speicherhüllen den Encounter-Events zur Verfügung (`apps/encounter/event-builder`).
- Library-Editoren geben ihre Persistenz über `apps/library/core` frei, sodass neue Views denselben Datei-Pipeline-Aufbau nutzen können.

# ToDo
- keine offenen ToDos.

# Standards
- Jeder TypeScript-Einstieg beginnt mit `// <relativer Dateipfad>` gefolgt von einem Satz Zweck.
- Kommentare bleiben einzeilig und konkret.
- Neue Apps dokumentieren ihre Schnittstellen zu bestehenden Bereichen unmittelbar in den jeweiligen AGENTS-Dateien.
