# Cartographer editor review

## Original Finding
> Editor mode and tools rely on implicit contracts (`RenderHandles.ensurePolys`, Abort-signal guards, dropdown wiring) that are not covered by typings or lifecycle checks. Missing safeguards lead to silent failures when tools activate before handles settle or when render helpers evolve.
>
> Follow-up required after the editor audit on `2025-09-26`.

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/modes/editor.ts`, `salt-marcher/src/apps/cartographer/editor/tools/**`.
- **Auswirkung:** Subtle lifecycle bugs (stale context, aborted tool switches) and loose typing around render handles make editor extensibility brittle.
- **Risiko:** New tools can regress map rendering or leak listeners because the API surface does not enforce correct sequencing.

## Offene Risiken & Forschungsfragen
1. **Abort-safe tool switching:** Verify that `switchTool` halts DOM mutations and overlay setup once the lifecycle signal aborts, and surface failures through the status label.
2. **Render handle contract:** Document and type `RenderHandles` helpers (`setFill`, `ensurePolys`, overlay expectations) so tool authors can rely on a stable interface.
3. **Workspace event hygiene:** Confirm that the Obsidian workspace exposes `on/offref` with proper types; otherwise add a wrapper that tracks subscriptions and cleans up deterministically.
4. **UI copy compliance:** Align dropdown labels and placeholders with the repository's U.S. English policy to avoid mixed locale regressions.
5. **Region dropdown resilience:** Ensure `fillOptions` reconciles deleted regions and resets the selected value when the backing record disappears.
6. **Brush write performance:** Evaluate batching for `applyBrush` writes to prevent linear file I/O when using large radii.

## Lösungsideen (zu verfeinern)
- Extend `RenderHandles` in `hex-render.ts` with optional helpers and update the terrain brush to feature-detect before calling them.
- Introduce a tool manager abstraction in the mode that queues `switchTool` transitions and bails early when `AbortSignal` aborts.
- Replace ad-hoc `(ctx.app as any)` access with typed helper services, possibly provided through the tool context.
- Centralise dropdown copy in a shared constant and reuse `enhanceSelectToSearch` placeholders across tools.
- Add regression tests that simulate region deletions and ensure the UI resets gracefully.

## Nächste Schritte
1. Draft an RFC that defines the editor tool contract extensions (render handles, abort behaviour, status reporting).
2. Prototype tightened typings in a branch and validate against the existing terrain brush implementation.
3. Align UI strings with the terminology guide and document the requirement in the tool standards.
4. File follow-up tickets for batching brush writes if the prototype confirms measurable gains.

## Referenzen
- Editor mode source: [`salt-marcher/src/apps/cartographer/modes/editor.ts`](../salt-marcher/src/apps/cartographer/modes/editor.ts)
- Tool API: [`salt-marcher/src/apps/cartographer/editor/tools/tools-api.ts`](../salt-marcher/src/apps/cartographer/editor/tools/tools-api.ts)
- Audit notes: [`Notes/cartographer-editor-review.md`](../Notes/cartographer-editor-review.md)
