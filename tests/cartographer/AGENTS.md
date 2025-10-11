# Ziele
- Prüft Cartographer-Controller sowie Editor- und Inspector-Modi.

# Aktueller Stand
- Unterordner `editor` deckt Werkzeuge ab; Travel-Tests sind in `tests/session-runner` umgezogen.
- Wurzeltests prüfen den Controller-Lifecycle samt Mode-Wechsel zwischen Editor und Inspector.

# ToDo
- keine offenen ToDos.

# Standards
- Testdateien beschreiben im Kopf, welche Komponente/Flow sie abdecken.
- Nutzen gemeinsame Mocks aus `tests/mocks` statt lokale Duplikate.
