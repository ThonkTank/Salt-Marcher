# Ziele
- Steuert die Travel-Guide-Erfahrung innerhalb des Cartographer-Modus.

# Aktueller Stand
- `encounter-gateway` vermittelt Begegnungsdaten zwischen Travel und Encounter-App.
- `interaction-controller` orchestriert Karteninteraktionen und UI-Events.
- `playback-controller` synchronisiert Timeline, Route und Audio-Hooks.
- `encounter-gateway` meldet fehlende Karten- oder Zustandsdaten direkt im UI und protokolliert sie im Log, damit Travel-Anfragen
  nachvollziehbar bleiben.

# ToDo
- keine offenen ToDos.

# Standards
- Controller beschreiben ihren Event-Flow in ein bis zwei Sätzen am Kopf.
- Exportierte Funktionen heißen `create<Name>` und kapseln Seiteneffekte lokal.
