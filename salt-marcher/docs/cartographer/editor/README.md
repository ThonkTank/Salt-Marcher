# Cartographer Editor

## Purpose & Audience
This document captures the developer-facing structure of the Cartographer editor mode. It targets engineers extending map-editing capabilities, adding new tools, or refactoring lifecycle hooks shared across editor tooling.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `docs/cartographer/editor/` | Developer overview for the editor mode and tooling surface. | _This document_ |
| `src/apps/cartographer/modes/editor.ts` | Presenter-integrated mode controller that hosts tool lifecycles and sidebar UI. | [Source](../../../src/apps/cartographer/modes/editor.ts) |
| `src/apps/cartographer/editor/tools/` | Tool contracts, shared utilities, tool manager, and concrete brush implementation. | [Tools index](../../../src/apps/cartographer/editor/tools) |

```text
src/apps/cartographer/editor/
├─ tools/
│  ├─ tools-api.ts          # ToolModule contract & ToolContext wiring
│  ├─ brush-circle.ts       # SVG preview circle helper
│  └─ terrain-brush/
│     ├─ brush-options.ts   # Brush sidebar UI & lifecycle bridge
│     ├─ brush.ts           # Persistence + live fill updates
│     └─ brush-math.ts      # Hex distance helpers
```

## Key Workflows
1. **Registering tools:** Export a `ToolModule` via `tools-api.ts` and push it into the editor mode's `tools` array. Each module is responsible for rendering its panel, reacting to activation events, and translating map interactions into updates.
2. **Managing render handles:** Use the `ToolContext.getHandles()` contract to delay SVG interactions until a map file is loaded. Tools should rebind transient resources (e.g., preview overlays) whenever `onMapRendered` fires.
3. **Switching tools safely:** The editor delegates lifecycle transitions to `createToolManager`, which cancels in-flight `mountPanel`/`onActivate` steps when the mode's `AbortSignal` fires. Tools must tolerate mounts that never reach activation.
4. **Applying brush actions:** The default terrain brush applies radius-based updates through `applyBrush`, which deduplicates coordinates, persists tile data, and paints SVG fills for immediate feedback.
5. **Responding to library changes:** Brush options watch `salt:terrains-updated` and `salt:regions-updated` workspace events so the region dropdown stays in sync with the library plugin.

## Linked Docs
- [Cartographer documentation hub](../README.md)
- [Cartographer presenter lifecycle notes](../../../../Notes/cartographer-mode-registry-lifecycle.md)
- [Cartographer editor follow-ups](../../../../todo/cartographer-editor-review.md)

## Standards & Conventions
- Tool modules must be side-effect free and expose all lifecycle hooks via the `ToolModule` interface; runtime state lives inside the factory closure returned by `create…` helpers.
- Clean up DOM listeners, SVG overlays, and workspace subscriptions in the cleanup functions returned from `mountPanel`, `onDeactivate`, or dedicated destroy routines.
- Use the `ToolContext.getAbortSignal()` accessor to guard async dropdown/state refreshes against mode transitions.
- Avoid `any` casts when interacting with `RenderHandles`; add typed helpers or extend the interface before relying on ad-hoc properties such as `ensurePolys`.
- Prefer `createToolManager` for lifecycle orchestration; it enforces `mountPanel → onActivate → onMapRendered` ordering and abort-aware teardown.
- Keep UI copy in U.S. English and drive dropdown search via `enhanceSelectToSearch` for consistency with other panels.
- Track outstanding hardening tasks in [`todo/cartographer-editor-review.md`](../../../../todo/cartographer-editor-review.md) and resolve them before building additional tools.
