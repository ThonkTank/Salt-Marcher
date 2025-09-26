# Cartographer editor review

## Original Finding
> Editor mode and tools rely on implicit contracts (`RenderHandles.ensurePolys`, Abort-signal guards, dropdown wiring) that are not covered by typings or lifecycle checks. Missing safeguards lead to silent failures when tools activate before handles settle or when render helpers evolve.
>
> Follow-up required after the editor audit on `2025-09-26`.

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/modes/editor.ts`, `salt-marcher/src/apps/cartographer/editor/tools/**`.
- **Auswirkung:** Editor stability hing von impliziten Lifecycle-Verträgen (Tool-Switching, Render-Handles, Workspace-Events) und UI-Konsistenz ab.
- **Risiko:** Offene Lücken führen zu regressiven Tool-Erweiterungen (fehlende Statusmeldungen, langsame Brush-Schreibvorgänge).

## Status-Update (Review 2025-XX-XX)
- ✅ `createToolManager` koordiniert Tool-Wechsel inzwischen abort-sicher und räumt angefangene Mounts/Cleanups deterministisch auf (`switchTo` prüft Lifecycle- und lokale `AbortController`). Sichtbare Fehlerbehandlung (Statuslabel) fehlt jedoch weiterhin.
- ✅ `RenderHandles` ist als Interface dokumentiert (`hex-render.ts`, `docs/cartographer/editor/README.md`), Tool-Kontext reicht getypte Helfer inklusive `ensurePolys` durch.
- ✅ Brush-UI aktualisiert Workspace-Events mit `offref`-Fallback und setzt Dropdowns/Labels konsequent auf U.S. English; gelöschte Regionen werden inzwischen erkannt und zurückgesetzt.
- ⚠️ `applyBrush` führt `saveTile`/`deleteTile` weiter strikt sequenziell aus – große Radien blockieren IO und UI-Feedback.
- ⚠️ Tool-Fehler landen weiterhin nur im Logger; das Statuslabel bleibt leer, wodurch Nutzer:innen fehlgeschlagene `mountPanel`/`onActivate`-Aufrufe nicht erkennen.

## Offene Risiken & Forschungsfragen
1. **Statusmeldungen für Tool-Fehler:** `createToolManager.switchTo` fängt Fehler zwar ab, ruft aber kein `setStatus` auf. Definition einer Fehler-Policy (z. B. `setStatus("Failed to load <tool>")`) sicherstellen, bevor weitere Tools aufgeschaltet werden.
2. **Brush-Schreibdurchsatz:** `applyBrush` schreibt Tiles weiterhin seriell. Prüfen, ob Batch-Speichern (z. B. gruppierte `saveTile`-Aufrufe oder Datei-Patching) die IO-Latenz bei großen Radien reduziert.

## Nächste Schritte
1. Fehleroberfläche spezifizieren: Wann setzt der Tool-Manager Statusmeldungen, wann bleibt er stumm? RFC/Vorschlag im Editor-Gilde teilen.
2. Brush-Batching prototypisieren (z. B. `Promise.all`-Fenster oder Bulk-Write im Notes-Layer) und Messwerte gegen aktuelle Implementation erheben.

## Referenzen
- Editor mode source: [`salt-marcher/src/apps/cartographer/modes/editor.ts`](../salt-marcher/src/apps/cartographer/modes/editor.ts)
- Tool API: [`salt-marcher/src/apps/cartographer/editor/tools/tools-api.ts`](../salt-marcher/src/apps/cartographer/editor/tools/tools-api.ts)
- Audit notes: [`Notes/cartographer-editor-review.md`](../Notes/cartographer-editor-review.md)
