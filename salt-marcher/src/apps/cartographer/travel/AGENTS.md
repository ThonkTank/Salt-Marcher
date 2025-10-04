# Ziele
- Kapselt alle Reise-spezifischen Workflows des Cartographer – von der Routenplanung bis zur Encounter-Synchronisation.
- Trennt Playback-, Rendering- und UI-Schichten so, dass Modi (`modes/travel-guide`) klar definierte Verträge konsumieren.
- Sichert nachvollziehbare Dokumentation über Zustandsänderungen, Persistenz und Interaktionen mit der Encounter-App.

# Aktueller Stand
## Strukturüberblick
- `domain/` verwaltet Zustand, Aktionen und Persistenz. `actions.ts` bündelt die Travel-Logik (Route-Manipulation, Token-Steuerung, Playback) und nutzt `state.store.ts`, `expansion.ts` sowie `playback.ts` als Hilfsschichten.
- `infra/` adaptiert Travel-Events auf Obsidian-APIs. `adapter.ts` definiert das Rendering-Contract, `encounter-sync.ts` leitet Reiseereignisse in Encounter-Sessions weiter.
- `render/` zeichnet Routen, Token und Layer. Die Module werden von `modes/travel-guide.ts` instanziiert und über einen `RenderAdapter` in die Domain injiziert.
- `ui/` stellt Controller, Interaktionen und Status-Widgets bereit. `controls.ts` bindet Playback-Ereignisse, `interactions.ts` orchestriert Klicks/Drags auf Route- und Token-Layer.

## Integrationspfade
- `modes/travel-guide.ts` erstellt die Travel-UI, bindet `createTravelLogic()` und verbindet Encounter-Sync, Playback und Map-Layer.
- Encounter-Handling greift auf `createEncounterSync()` zurück, das bei externen Events Playback pausiert, Encounter-Views öffnet und nach Abschluss fortsetzt.
- Persistenzzugriffe (`loadTokenCoordFromMap`, `writeTokenToTiles`) benötigen Zugriff auf Obsidian-Dateien und müssen bei Map-Wechseln robust bleiben.

## Beobachtungen & Risiken
- `createTravelLogic()` registriert einen Store-Listener, bietet aber keinen Dispose-Hook. Modi verlassen sich auf externe Aufräumlogik, wodurch Subscriptions und Token-Adapter bei mehrfacher Initialisierung weiterlaufen können.
- `bindAdapter()` ersetzt nur die Referenz. Bei neu montierten Render-Layern (z. B. nach Dateiwechsel) fehlen ein initialer `draw()`-Durchlauf sowie `ensurePolys`, wodurch Route und Token leer bleiben, bis eine Nutzeraktion den Zustand verändert.
- Encounter-Sync und Playback pausieren korrekt, aber Fehler aus `persistTokenToTiles()` oder `initTokenFromTiles()` werden lediglich geloggt. Ohne Telemetrie/Notice bleibt der UI-Zustand unklar, wenn Dateizugriffe fehlschlagen.

# ToDo
- [P2.55] Dispose-Hook für `createTravelLogic()` bereitstellen, der Store-Subscription, Adapter-Token und Playback stoppt.
- [P2.56] `bindAdapter()` um sofortiges `draw()`/`ensurePolys` erweitern, damit frisch montierte Map-/Route-Layer den aktuellen Zustand anzeigen.
- [P2.57] Persistenzfehler (`initTokenFromTiles`, `persistTokenToTiles`) mit UI-/Telemetry-Rückmeldung versehen, damit Nutzer Fehlschläge nachvollziehen können.

# Standards
- Travel-spezifische Dateien starten mit einem Kontextsatz, der Verantwortung und genutzte Layer beschreibt.
- Domain-Logik exportiert gezielte Funktionen/Factories; Hilfsfunktionen bleiben intern und dokumentieren Nebenwirkungen (Persistenz, Adapterzugriffe).
- Adapter und UI-Schichten bleiben idempotent: Mehrfaches Binden oder Mounten darf keine duplizierten Listener oder Render-Artefakte erzeugen.
- Persistenz-Pfade loggen nicht nur Fehler, sondern liefern den Aufrufern (UI/Mode) eindeutig nutzbare Statusinformationen.
