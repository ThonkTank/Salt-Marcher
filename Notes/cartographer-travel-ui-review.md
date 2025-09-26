# Cartographer Travel UI – Controller Review

## Ziel & Vorgehen
Audit der Travel-UI-Controller hinsichtlich Ereignisverwaltung, Benennungskonsistenz und Adapter-Erwartungen. Fokus auf Drag-Steuerung, Kontextmenü sowie Token- und Routen-Layer. Ergebnisse dienen als Grundlage für gezielte Refactorings und Tests.

## Drag-Controller (`drag.controller.ts`)
- **Event-Kaskade & Pointer-Capture:** Verwendet globale `pointerdown`-Capture-Listener zur Klickunterdrückung und bindet `pointermove`/`pointerup` am `window`, wodurch Abmeldungen zwingend über `unbind()` erfolgen müssen. Während aktiver Drags wird `pointerEvents` für die Routen-Layer deaktiviert; ein früher `unbind()`-Call während eines laufenden Drags würde `disableLayerHit(false)` nicht aufrufen und damit Hover/Click dauerhaft sperren.
- **Release-Pfade:** `endDrag()` verlässt sich auf implizites Pointer-Capture-Release durch `pointerup`. Es existiert kein expliziter `releasePointerCapture`, was bei verlorenen `pointerup`-Events (z. B. Fensterwechsel) zu hängendem Capture führen kann.
- **Adapter-Annahmen:** Erwartet, dass `RenderAdapter.ensurePolys` synchron Polygone materialisiert und dass `adapter.centerOf()` für jede Koordinate einen Mittelpunkt liefert, sonst brechen Ghost-Updates stillschweigend ab. Ghost-Move aktualisiert DOM-Attribute direkt ohne Fallback auf Presenter- oder Layer-Abgleich.
- **State-Guards:** `consumeClickSuppression()` unterdrückt Folgeklicks, aber `suppressNextHexClick` wird an mehreren Stellen gesetzt (global pointerdown, Drag-Start, Commit). Ohne zusätzliche Logging/Tests lässt sich schwer validieren, ob Klicks in Race-Szenarien (z. B. schneller Doppelklick) fälschlich blockiert werden.

## Kontextmenü (`contextmenue.ts`)
- **Benennungsabweichung:** Dateiname und Export (`contextmenue`) verwenden ein „e“ zu viel. Das erschwert Suchvorgänge und konsistente Benennung im gesamten UI-Stack.
- **Event-Härtung:** Bindet `contextmenu` mit Capture-Phase, verhindert Standardmenü aber ruft `stopPropagation()` nur beim Löschen. Bei nicht-löschbaren Punkten (`kind !== "user"`) propagiert das Event weiter und verhindert lediglich das Browser-Menü – Seiteneffekte anderer Listener sind unklar.
- **State-Annahme:** Vertraut darauf, dass `logic.getState().route[idx]` existiert und `deleteUserAt` robust gegen Paralleländerungen ist. Es gibt keinen Abgleich mit `editIdx`/Drag-State, wodurch Lösch- und Drag-Operationen kollidieren könnten.

## Token-Layer (`token-layer.ts`)
- **Pointer-Policy:** Layer aktiviert Pointer-Events (`pointerEvents = "auto"`) und Cursor-Feedback für Drag, verlässt sich darauf, dass der Drag-Controller die tatsächliche Interaktion übernimmt. Fehlende eigene Listener vermeiden Doppelzuständigkeit, erfordern aber klare Dokumentation zum Pointer-Capture-Besitz.
- **Animationssteuerung:** `moveTo()` nutzt `requestAnimationFrame` mit Abbruchlogik; laufende Animationen werden bei `setPos`, `moveTo` und `destroy` über `cancelActiveAnimation()` abgeräumt. Fehlerfall-Handling (`TokenMoveCancelled`) wird nirgendwo gefangen – Tests sollten sicherstellen, dass Aufrufer Rejections handhaben.

## Routen-Layer (`route-layer.ts`)
- **Render-Delegation:** Layer kapselt lediglich DOM-Erzeugung und delegiert `draw`/`highlight` an `drawRoute` bzw. `updateHighlight`. Erwartet, dass `drawRoute` Marker mitsamt Hitboxen erzeugt und `polyToCoord`-Map aktuell gehalten wird; Layer selbst synchronisiert keine Hitbox-Attribute.
- **Lifecycle-Verantwortung:** `destroy()` entfernt nur das `<g>`-Element. Wenn externe Controller noch Referenzen (z. B. `routeLayerEl`) halten, verbleiben Event-Listener (`contextmenu`, Pointer) aktiv. Erfordert klare Ownership-Vereinbarung im Adapter/Presenter.

## Empfohlene Prüfungen
- Tests oder Logging für Drag-Abbruchpfade (Fensterwechsel, Pointercancel), um Pointer-Capture-Hänger zu erkennen.
- Abklärung, ob Kontextmenü-Events an weiteren Stellen verarbeitet werden und ob zusätzliche `stopPropagation()` notwendig ist.
- Verifizieren, dass Token-Animation-Rejections von aufrufenden Services behandelt werden, um unhandled promise rejections zu vermeiden.
- Sicherstellen, dass Routen-Layer-Destroy zeitlich mit `unbind()` der Controller gekoppelt wird, um Event-Leaks zu verhindern.
