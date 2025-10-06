# Ziele
- Stellt Controller und Layer bereit, die die Travel-Domain interaktiv machen (Drag, Kontextmenü, Playback, Sidebar).
- Kapselt Rendering-Zugriffe auf Map- und Token-Layer, damit Modi nur noch über klar definierte Handles interagieren.
- Dokumentiert UI-Kontrakte gegenüber `modes/travel-guide` und der Render-/Infra-Schicht, um Wiederverwendung und Tests zu erleichtern.

# Aktueller Stand
## Strukturüberblick
- `context-menu.controller.ts` bindet ein SVG-gebundenes Kontextmenü an Routenpunkte und delegiert Lösch-/Encounter-Aktionen an die Domain.
- `drag.controller.ts` verwaltet Pointer-Captures, Ghost-Previews und Commits für Dot- und Token-Drags; nutzt `RenderAdapter` und `polyToCoord` aus `map-layer.ts`.
- `controls.ts` und `sidebar.ts` erzeugen Playback-Buttons, Tempo-Slider sowie Geschwindigkeits-/Tile-Anzeigen und exponieren Handles für den Mode.
- `route-layer.ts`, `token-layer.ts` und `map-layer.ts` liefern SVG-Gruppen mitsamt Convenience-Methoden (`draw`, `ensurePolys`, `centerOf`) für Render- und Domain-Layer.
- `contextmenue.ts` existiert als Legacy-Shim, um frühere Importe auf das korrekt benannte Kontextmenü weiterzuleiten.

## Integrationspfade
- `modes/travel-guide/interaction-controller.ts` instanziiert Drag- und Kontextmenü-Controller, reicht Domain-Handles durch und konsumiert das `consumeClickSuppression()`-Signal.
- Die Domain erwartet, dass Sidebar/Controls Tempo- und Playback-Callbacks unmittelbar weiterreichen; Persistenz-/Playback-Hooks landen via Adapter im Render-Layer.
- Map/Token-Layer werden vom Mode über den `RenderAdapter` verwaltet; sie müssen Pointer-Ereignisse und Animationen zuverlässig mit der Domain synchronisieren.

## Beobachtungen & Risiken
- `TravelInteractionController` importiert weiterhin den Shim `contextmenue.ts`. Dadurch bleibt der Legacy-Pfad im Bundle und erschwert konsistente Benennungen.
- `sidebar.ts` feuert Geschwindigkeitsänderungen nur im `change`-Event. Während Eingaben (Scrollrad, Pfeiltasten) bleibt der Logic-Store uninformiert, bis das Feld den Fokus verliert.
- `drag.controller.ts` verlässt sich darauf, dass Map-Layer-Polygone bereits existieren; `ensurePolys` wird erst beim Drop gezogen, wodurch Ghost-Previews in bisher ungesehenen Hexes ausfallen können.

# ToDo
- [P2.63] Legacy-Import im Travel-Guide (`interaction-controller.ts`) auf `context-menu.controller` umstellen und den Shim `contextmenue.ts` entfernen, um den doppelten Bundle-Eintrag loszuwerden.
- [P2.64] Geschwindigkeitssteuerung in `sidebar.ts` auf `input`-basierte Updates inklusive Validierungs-Helfer umbauen, damit Tempoänderungen sofort im Travel-Logic-Store landen.

# Standards
- Jeder Controller beschreibt im Kopfkommentar seinen Scope (DOM, Listener, Delegates) und kapselt Bind/Unbind-Pfade klar.
- Event-Listener werden zentral gebündelt (z. B. via Handle oder AbortController), sodass `bind()` mehrfach aufrufbar bleibt, ohne Leaks zu verursachen.
- UI-Layer greifen nur über `RenderAdapter`- und Domain-Ports auf Persistenz/Playback zu; direkte Dateisystem- oder Store-Zugriffe bleiben untersagt.
- Shims wie `contextmenue.ts` erhalten ein Ablaufdatum und werden nach Migration entfernt, damit Importe eindeutig bleiben.
