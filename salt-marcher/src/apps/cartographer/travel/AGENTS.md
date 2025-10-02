# Ziele
- Implementiert die Reise- und Playback-Schicht des Cartographer.

# Aktueller Stand
- `domain` verwaltet Zustand, Aktionen und Persistenz.
- `infra` adaptiert Travel-Events auf Obsidian-APIs.
- `render` zeichnet Routen und Marker auf die Hex-Karte.
- `ui` stellt Controller und Layer für Benutzerinteraktionen.

# ToDo
- Audio- und Licht-Stimmung je Reiseabschnitt ergänzen.
- Synchronisation mit Encounter-Module automatisieren.

# Standards
- Services beschreiben kurz welche Daten sie lesen/schreiben.
- Dateien exportieren einzelne Verantwortungen statt Sammelobjekte.
