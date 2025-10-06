# Ziele
- Hält die komplette Travel-Domain zusammen: Routing, Token-Steuerung, Playback-Taktung und Encounter-Hooks.
- Trennt reine Zustands-/Berechnungslogik von Render-Adaptern und Persistenz, damit Modi kontrolliert integrieren können.
- Dokumentiert Formate und Verträge, die von Travel-Guide, Encounter-Sync und Hex-Persistenz gemeinsam genutzt werden.

# Aktueller Stand
## Strukturüberblick
- `actions.ts` stellt `createTravelLogic()` bereit und orchestriert Store, Playback und Render-Adapter.
- `state.store.ts` kapselt den internen Zustand inklusive Tempo, Route und Token-Position samt Subscription-API.
- `expansion.ts` und `rebuildFromAnchors` erzeugen Auto-Knoten zwischen User-Ankern und rekonstruieren Routen.
- `playback.ts` animiert Token entlang der Route, berücksichtigt Terrain-Geschwindigkeit und ruft Encounter-Checks auf.
- `persistence.ts` liest/schreibt den Token-Stand über die Hex-Notizen (`token_travel`).
- `terrain.service.ts` liefert Terrain-Faktoren, `types.ts` definiert die extern konsumierten DTOs.

## Daten- und Integrationsflüsse
- `createTravelLogic()` koppelt den Store an einen RenderAdapter (`ensurePolys`, `draw`, Token-Zentrierung) und ruft Playback für Animationen.
- Persistenz greift ausschließlich über `listTilesForMap`/`loadTile`/`saveTile` auf Hex-Dateien zu; Encounter-Sync liest dieselben Koordinaten.
- Travel-Guide-Modi nutzen `bindAdapter()` bei jedem Map-Re-Mount, wodurch neue Layer den aktuellen Zustand darstellen sollen.
- Playback nutzt `loadTerrainSpeed()` und schreibt nach jedem Schritt via `writeTokenToTiles()` zurück ins Frontmatter.

## Beobachtungen & Risiken
- `createTravelLogic()` behält Store-Subscription und Playback-Instanz ohne `dispose()`. Mehrfache Initialisierungen laufen weiter und halten Adapter-Handles offen.
- `bindAdapter()` ersetzt nur die Referenz in `actions.ts`; Playback behält den alten Adapter aus seiner Closure und animiert ins Leere.
- Beim Adapterwechsel fehlt ein sofortiges `draw()`/`ensurePolys`, sodass frisch montierte Layer bis zur nächsten Nutzeraktion leer bleiben.
- Persistenz-Fehler (`initTokenFromTiles`, `persistTokenToTiles`) werden lediglich geloggt. UI und Telemetrie sehen nicht, warum Token verschwinden.
- `writeTokenToTiles()` lädt/speichert alle Tiles sequenziell, obwohl nur der vorherige und der neue Token-Stand relevant sind – das skaliert schlecht bei großen Karten.

# ToDo
- [P2.55] `createTravelLogic` um `dispose()` erweitern, das Store-Subscription, Token-Adapter und Playback zuverlässig beendet.
- [P2.56] `bindAdapter` initiale Synchronisierung ergänzen (`ensurePolys`, `draw`, Token-Zentrierung), damit neue Render-Layer sofort den aktuellen Zustand anzeigen.
- [P2.57] Fehler aus `initTokenFromTiles`/`persistTokenToTiles` über UI-/Telemetry-Hooks sichtbar machen und Wiederholungsoptionen anbieten.
- [P2.58] Playback an neue RenderAdapter koppeln, damit Token-Animationen nach Adapterwechsel nicht am alten Adapter hängen bleiben.
- [P2.59] Token-Persistenz entkoppeln, sodass beim Schreiben nicht jede Karte geladen und gespeichert werden muss (letzten Token-Stand cachen und nur betroffene Tiles anfassen).
- [P3.2] Mehrstufige Undo/Redo-Strategien entwerfen.

# Standards
- Domain-Funktionen bleiben seiteneffektfrei und dokumentieren externe Abhängigkeiten (Persistenz, Adapter) im Kopfkommentar.
- Adapter-wechselseitige Aufrufe liefern sofort konsistente Darstellung (Token-Position, Route, Playback-Zustand) und müssen idempotent sein.
- Persistenzschichten kapseln Obsidian-IO, liefern klare Fehlerobjekte zurück und vermeiden unnötige Dateisystem-Schleifen.
- Neue DTOs werden in `types.ts` dokumentiert und nur dort exportiert; Tests und Modi importieren ausschließlich aus dieser Datei.
