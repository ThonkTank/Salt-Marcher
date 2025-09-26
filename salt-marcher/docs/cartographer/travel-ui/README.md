# Cartographer Travel UI Documentation

## Überblick
Dieser Ordner beschreibt die UI-spezifischen Controller und Layer des Travel-Modus im Cartographer. Fokus: Event-Management, Pointer-Capture-Strategie sowie Zusammenspiel zwischen Drag-, Kontextmenü- und Layer-Adaptern.

## Struktur
```
docs/cartographer/travel-ui/
└─ README.md

src/apps/cartographer/travel/ui/
├─ context-menu.controller.ts
├─ contextmenue.ts               (Legacy Re-Export, wird entfernt)
├─ controls.ts
├─ drag.controller.ts
├─ map-layer.ts
├─ route-layer.ts
├─ sidebar.ts
├─ token-layer.ts
└─ types.ts
```

## Module & Zuständigkeiten
- `src/apps/cartographer/travel/ui/drag.controller.ts` – Globale Pointer-Event-Verwaltung für Dot- und Token-Drags inklusive Ghost-Preview.
- `src/apps/cartographer/travel/ui/context-menu.controller.ts` – Rechtsklick-Löschen von nutzerdefinierten Routenpunkten (`contextmenue.ts` re-exportiert vorerst für Altimporte).
- `src/apps/cartographer/travel/ui/token-layer.ts` – Rendering und Animation des Travel-Tokens, stellt `TokenCtl` für den Drag-Controller.
- `src/apps/cartographer/travel/ui/route-layer.ts` – Wrapper über `drawRoute`/`updateHighlight`, verwaltet das SVG-Routen-Layer.
- `src/apps/cartographer/travel/ui/controls.ts` & `sidebar.ts` – UI-Komponenten für Playback/Inspect (nicht Teil dieser Analyse, hier nur zur Vollständigkeit aufgeführt).

## Kern-Workflows
1. **Drag-Workflow:** `drag.controller` bindet Pointer-Events an Route-Dots und das Token. Während des Drags deaktiviert es die Hitbox der Routen-Layer, bewegt Ghost-Dots/Token über `adapter.centerOf()` und committed Koordinaten via `logic.moveSelectedTo` bzw. `logic.moveTokenTo` nach Loslassen.
2. **Kontextmenü-Löschen:** `contextmenue` interceptiert das Browser-Kontextmenü auf Route-Dots, validiert `RouteNode.kind === "user"` und delegiert Löschvorgänge an `logic.deleteUserAt`.
3. **Token-Animation:** `token-layer` erzeugt das Token-`<g>` im SVG-Baum, kapselt `setPos`/`moveTo`/`stop` und blendet das Token auf Anfrage ein oder aus. Drag-Controller nutzt `setPos`/`show`, während Presenter/Playback `moveTo` für animiertes Reisen verwenden.

## Standards & Policies
- **Namenskonvention:** Module mit UI-spezifischen Events verwenden durchgängig das Suffix `.controller.ts` bzw. `.layer.ts`. Kontextmenü-Dateien sollen `context-menu`-Schreibweise übernehmen (siehe To-Do).
- **Pointer-Capture-Policy:** Nur der Drag-Controller ruft `setPointerCapture` auf (`drag.controller.ts`). Er ist außerdem verpflichtet, Pointer-Capture bei jedem Ende (`pointerup`, `pointercancel`, Programm-Abbruch) wieder freizugeben.
- **Layer-Lifecycle:** `route-layer` und `token-layer` stellen ein `destroy()` bereit, das beim Moduswechsel gemeinsam mit `unbind()` der Controller aufzurufen ist, um Event-Leaks und hängende Pointer-Capture-Zustände zu vermeiden.
- **Event-Suppression:** `drag.controller.consumeClickSuppression()` muss von Hex-Click-Handlern abgefragt werden, um Ghost-Klicks nach Drags abzufangen.

## Lifecycle & Cleanup
- **Initialisierung:** `drag.controller.bind()` sowie `bindContextMenu()` werden nach dem Aufbau des `route-layer` aufgerufen. Beide setzen voraus, dass `types.ts`-Verträge (Ports) erfüllt sind.
- **Drag-Ende:** Der Drag-Controller gibt Pointer-Capture immer frei (auch bei frühzeitigen Abbrüchen) und reaktiviert das Routen-Layer für Hit-Tests.
- **Teardown:** Beim Verlassen des Travel-Modus sind `drag.controller.unbind()`, die Rückgabe von `bindContextMenu()` sowie `token-layer.destroy()` aufzurufen. Offene Animationen werden dadurch abgebrochen und Promises mit `TokenMoveCancelled` verworfen.

## Weiterführende Ressourcen
- Analyse & Audit-Notizen: [Notes/cartographer-travel-ui-review.md](../../../Notes/cartographer-travel-ui-review.md)
- Travel-Mode-Überblick: [../travel-mode-overview.md](../travel-mode-overview.md)
- Cartographer-Grundlagen: [../README.md](../README.md)

## To-Do
- [Cartographer travel UI review](../../../../todo/cartographer-travel-ui-review.md) – Fokus auf Entfernen des `contextmenue`-Legacy-Shims und Entscheidung zur Event-Propagation des Kontextmenüs.
