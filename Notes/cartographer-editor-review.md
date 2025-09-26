# Cartographer Editor Review

## Mode controller (`src/apps/cartographer/modes/editor.ts`)
- The shared `state` object keeps `file`, `handles`, and `options` references across `onExit`; re-entering the mode without a file change will temporarily show stale metadata until a new `onFileChange` fires.
- `ensureToolCtx` recreates the `ToolContext` on demand but does not freeze it; downstream tools rely on closures reaching into the mutable `state`, which makes it easy to observe half-updated values during lifecycle churn.
- `switchTool` silently falls back to the first tool when an ID is unknown. With asynchronous tool loading this can mask registration bugs instead of surfacing a failure.
- Lifecycle guarding is `AbortSignal`-based, yet UI callbacks (e.g., `toolSelect.onchange`) and async `switchTool` calls do not gate DOM mutations once the signal aborts midway through a tool swap.
- Tool activation errors are only logged; `setStatus` never surfaces them to the user, so failed `mountPanel` calls leave the sidebar empty without feedback.

## Tool surface (`src/apps/cartographer/editor/tools/tools-api.ts`)
- `ToolModule.id` is typed as the string literal union `"brush" | string`, which hides typos until runtime and prevents discriminated unions across custom tools.
- `ToolContext.setStatus` has no nullish contract; tools must guard against absent status labels even though the mode always wires one.

## Brush circle helper (`src/apps/cartographer/editor/tools/brush-circle.ts`)
- Pointer handlers are attached at the `<svg>` root with `{ passive: true }`, so consumers cannot ever cancel or throttle beyond the built-in `requestAnimationFrame` loop.
- The helper assumes `handles.overlay` uses pointer capture; if future renderers provide a different overlay element, the circle silently stops following pointer coordinates.

## Terrain brush UI (`src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts`)
- Region dropdown wiring relies on `any` casts (`(opt as any)._terrain`, `(ctx.app as any)`) to stash metadata and reach commands/events that are not typed in the Obsidian API.
- Workspace events use `on?.`/`offref?.` patterns with `any`; if the plugin runtime evolves, the cleanup path may never fire, leaking listeners.
- Dropdown placeholders such as `"Such-dropdown…"`, `"Malen"`, and `"Löschen"` ship in German and violate the style guide's U.S. English requirement.
- `fillOptions` executes every time `salt:regions-updated` fires but does not reconcile `state.region` against deleted regions; the UI keeps the stale value until the user manually changes it.
- Tool activation assumes `ctx.getOptions()?.radius` exists; when the presenter fails to load options, the fallback `42` produces an arbitrary circle size without warning.

## Terrain brush apply (`src/apps/cartographer/editor/tools/terrain-brush/brush.ts`)
- The render handles are assumed to expose `setFill`; missing support throws at runtime because there is no feature detection before calling the method.
- `deleteTile`/`saveTile` calls run sequentially per target; large brushes will perform redundant file I/O without batching.
- Error handling is absent; IO failures or rendering exceptions leave the SVG and datastore out of sync.
