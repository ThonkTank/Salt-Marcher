# Ziele
- Beschreibt das Session-Runner-Erlebnis und seine Controller-Anbindungen.
- Dokumentiert, wie Experience und Controller zusammenspielen, um Playback, Interaktion und Encounter-Sync bereitzustellen.

# Aktueller Stand
- `experience.ts` baut Sidebar, Route-/Token-Layer sowie Travel-Logik auf und koppelt Encounter-Sync.
- `controllers/` enthält Playback-, Interaktions- und Encounter-Gateways, die vom Erlebnis instanziiert werden.

# ToDo
- keine offenen ToDos.

# Standards
- Experience- und Controller-Dateien starten mit einem Kontextsatz zum Nutzerziel.
- Lifecycle-Hooks räumen Listener und Klassenänderungen idempotent auf.
- Encounter-Fehler melden sowohl Notices als auch strukturierte Logs.
