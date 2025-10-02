# Ziele
- Steuert die Travel-Guide-Erfahrung innerhalb des Cartographer-Modus.

# Aktueller Stand
- `encounter-gateway` vermittelt Begegnungsdaten zwischen Travel und Encounter-App.
- `interaction-controller` orchestriert Karteninteraktionen und UI-Events.
- `playback-controller` synchronisiert Timeline, Route und Audio-Hooks.

# ToDo
- Offene Hooks für Koop-Reisende dokumentieren und später anbinden.
- Fehlerzustände für fehlende Begegnungsdaten skizzieren.

# Standards
- Controller beschreiben ihren Event-Flow in ein bis zwei Sätzen am Kopf.
- Exportierte Funktionen heißen `create<Name>` und kapseln Seiteneffekte lokal.
