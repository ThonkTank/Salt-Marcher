# Ziele
- Steuert die Travel-Guide-Erfahrung innerhalb des Cartographer-Modus samt Playback, Interaktion und Encounter-Übergabe.
- Dokumentiert, wie Travel-spezifische Controller zusammenarbeiten und welche Abhängigkeiten Richtung Terrain-, Logic- und Encounter-Schichten bestehen.
- Identifiziert Risiken, bei denen fehlende Daten oder UI-Abhängigkeiten den Modus ausbremsen, und hält Folgeaufgaben fest.

# Aktueller Stand
## Strukturüberblick
- `travel-guide.ts` erstellt Sidebar, Route-/Token-Layer sowie Travel-Logik, synchronisiert UI-State und koppelt Encounter-Sync an die Modus-Lifecycle-Hooks.
- `travel-guide/encounter-gateway.ts` lädt Encounter-View-Module on demand, baut Events aus dem Travel-Zustand und öffnet die Encounter-Ansicht im mittleren Leaf.
- `travel-guide/interaction-controller.ts` verbindet Route- und Token-Layer mit Drag-/Context-Menu-Logik, damit Dots, Token und Encounter-Kontextmenüs interaktiv bleiben.
- `travel-guide/playback-controller.ts` mountet die Playback-Controls im Sidebar-Host und hält Route-, Tempo- und Uhrzeit-Anzeige synchron.

## Lifecycle & Datenflüsse
- Beim `onEnter` lädt der Modus Terrains, subscribed auf Terrain-Updates, initialisiert Sidebar und Playback und setzt Status auf Basis des aktuellen Files.
- `createTravelLogic()` liefert State-Änderungen, die Route-/Token-Layer, Sidebar und Playback steuern; Encounter-Sync pausiert Playback und öffnet Encounter-Views sowohl für interne als auch externe Events.
- Manualle Encounter-Auslösungen laufen über das Kontextmenü (`triggerEncounterAt`), das wiederum `publishManualEncounter` auf den aktuellen Travel-State stützt.

## Beobachtungen & Risiken
- Schlägt das dynamische Laden der Encounter-Module fehl, bleibt der Promise-Cache auf `null` hängen; spätere Aufrufe versuchen keinen Reload und Nutzer*innen erhalten nur einen kurzen Notice ohne weitere Telemetrie.
- `initTokenFromTiles()` kann Exceptions werfen (z.B. bei defekten Karten) und beendet den Lifecycle frühzeitig, ohne UI-Status oder Retry-Hinweise zu setzen.
- `TravelPlaybackController` greift über `as any` auf optionale Clock-/Tempo-Setter zu; API-Änderungen der Controls bleiben dadurch untypisiert und können zur Laufzeit brechen.

# ToDo
- [P2.52] Encounter-Gateway so erweitern, dass fehlgeschlagene Module-Loads und Event-Builds Telemetrie & UI-Hinweise setzen, den Promise-Cache zurücksetzen und eine erneute Initialisierung zulassen.
- [P2.53] Fehlerpfade rund um `initTokenFromTiles()` und Logik-Initialisierung auffangen, Statusmeldungen im Sidebar/Overlay setzen und Nutzern Wiederholungsoptionen anbieten.
- [P2.54] Playback-Controls typisieren, damit Clock-/Tempo-Setter sowie `destroy()` ohne `any`-Casts adressiert werden und API-Drift früh auffällt.

# Standards
- Jede Controller-/Gateway-Datei startet mit einem Satz zum Nutzerziel und listet kritische Abhängigkeiten (Terrain, Encounter, Playback) im Kopf.
- Lifecycle-Hooks (`onEnter`, `onFileChange`, `onExit`) räumen Interaktionen, Event-Listener und Klassen toggles idempotent ab und prüfen vor Await-Punkten `ctx.signal.aborted`.
- Encounter-Brücken kommunizieren Fehler doppelt: als UI-Notice/Status und als strukturierte Log-/Telemetry-Einträge, inklusive Kontext zur geladenen Karte.
- Playback- und Interaktionscontroller exponieren `dispose()`-Methoden, die alle Listener lösen, und vermeiden anonyme `any`-Zugriffe auf Third-Party-Handles.
