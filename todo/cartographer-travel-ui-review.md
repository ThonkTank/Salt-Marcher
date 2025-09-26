# Cartographer Travel UI Review

## Kontext
Audit aus [Notes/cartographer-travel-ui-review.md](../Notes/cartographer-travel-ui-review.md) deckt Event- und Lifecycle-Risiken der Travel-spezifischen UI-Controller auf. To-Do bündelt Folgearbeiten für Drag-Steuerung, Kontextmenü und Layer.

## Betroffene Module
- `src/apps/cartographer/travel/ui/drag.controller.ts`
- `src/apps/cartographer/travel/ui/contextmenue.ts`
- `src/apps/cartographer/travel/ui/token-layer.ts`
- `src/apps/cartographer/travel/ui/route-layer.ts`

## Aufgaben
1. **Naming bereinigen:** Datei `contextmenue.ts` in `context-menu.controller.ts` umbenennen, Exporte anpassen und Dokumentation aktualisieren.
2. **Typisierung schärfen:** `LogicPort`-Definitionen in Drag- und Kontextmenü-Controller auf zentrale Domain-Typen refaktorieren (keine Inline-Strukturen). Optional generische Ports/Interfaces im `infra`-Layer einführen.
3. **Pointer-Capture absichern:** Drag-Controller erweitern, um `releasePointerCapture` bei `unbind()` oder `pointercancel` aufzurufen; Tests für Fensterwechsel/Abort-Szenarien ergänzen.
4. **Event-Propagation prüfen:** Kontextmenü-Handler um konsistentes `stopPropagation()` ergänzen und Integrationstests schreiben, die Konflikte mit anderen Listenern ausschließen.
5. **Token-Animation testen:** Unit-/Integrationstests erstellen, die `TokenCtl.moveTo()`-Abbrüche abdecken und sicherstellen, dass Aufrufer `TokenMoveCancelled` behandeln.
6. **Lifecycle-Kopplung dokumentieren:** Sicherstellen, dass Presenter beim Moduswechsel `destroy()` der Layer und `unbind()` der Controller konsistent aufruft; falls fehlend, Follow-up-Refactoring planen.

## Lösungsideen & Hinweise
- Tests bevorzugt mit jsdom + PointerEvent-Mocks oder Playwright-E2E für Drag/Drop.
- Naming-Änderungen sollten Style-Guide-Erweiterungen (Kontextmenü-Schreibweise) dokumentieren.
- Bei Typverfeinerungen zuerst Adapter-Signaturen aus `infra/adapter.ts` analysieren, um Doppelnamen zu vermeiden.
