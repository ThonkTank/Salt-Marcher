# Cartographer Travel UI Review

## Kontext
Audit aus [Notes/cartographer-travel-ui-review.md](../Notes/cartographer-travel-ui-review.md) deckt Event- und Lifecycle-Risiken der Travel-spezifischen UI-Controller auf. To-Do bündelt Folgearbeiten für Drag-Steuerung, Kontextmenü und Layer.

## Betroffene Module
- `src/apps/cartographer/travel/ui/drag.controller.ts`
- `src/apps/cartographer/travel/ui/contextmenue.ts`
- `src/apps/cartographer/travel/ui/token-layer.ts`
- `src/apps/cartographer/travel/ui/route-layer.ts`

## Status-Update (Review 2025-XX-XX)
- ✅ `drag.controller` ruft `releasePointerCapture()` inzwischen in allen Endpfaden (`pointerup`, `pointercancel`, `unbind()`) auf und deaktiviert Layer-Hit-Tests nur während aktiver Drags.
- ✅ Gemeinsame Typverträge liegen in `ui/types.ts`; Drag- und Kontextmenü-Controller konsumieren dieselben Ports.
- ✅ `token-layer` ist durch Vitest-Unit-Tests abgesichert (`tests/cartographer/travel/token-layer.test.ts`), Rejections mit `TokenMoveCancelled` sind abgedeckt.
- ✅ Travel-Mode-Presenter koppelt `interactions.dispose()`, `tokenLayer.destroy()` und `routeLayer.destroy()` beim Dateiwechsel (`modes/travel-guide.ts`).
- ⚠️ Legacy-Shim `contextmenue.ts` bleibt aktiv, weil `interaction-controller` und externe Konsumenten noch nicht auf `context-menu.controller` umgestellt sind.
- ⚠️ Kontextmenü stoppt die Eventpropagation weiterhin nur für löschbare User-Dots; bei nicht-löschbaren Punkten wird lediglich das Browser-Menü verhindert. Auswirkungen auf andere Listener sind ungeklärt.

## Offene Aufgaben
1. **Altimporte eliminieren:** `modes/travel-guide/interaction-controller.ts` und verbleibende Konsumenten direkt auf `./context-menu.controller` umstellen, Legacy-Reexport entfernen und Dokumentation bereinigen.
2. **Kontextmenü-Propagation klären:** Entscheiden, ob `stopPropagation()` auch bei nicht löschbaren Punkten erforderlich ist. Falls ja, anpassen und Regressionstests für parallele Listener (z. B. Presenter-Hex-Click) ergänzen.

## Hinweise für Umsetzungen
- Style-Guide: Kontextmenü-Dateien konsequent als `context-menu.*` führen, Dokumentation (`docs/cartographer/travel-ui/README.md`) nach Entfernen des Shims aktualisieren.
- Tests bevorzugt mit jsdom + PointerEvent-Mocks oder Playwright-E2E für Drag/Drop.
