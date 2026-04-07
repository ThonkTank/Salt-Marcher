# AGENTS.md

This file covers `src/features/world/dungeonmap/canvas/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This file only records render-local seams beneath `dungeonmap/`. Shared owner placement already lives in the parent file.

## Canonical Types and APIs

- `DungeonCanvasWorkspace` — observed map state plus interaction handler — renders one dungeon workspace and forwards raw pointer or scroll input.
- `DungeonSceneFrame` — render payload — bundles the canonical data required for one draw pass.
- `DungeonGridSceneRenderer` — scene frame — paints the grid and canonical dungeon overlays.

## Where New Code Goes

- Put pure rendering behavior, camera math, and raw pointer translation here.
- Keep render payloads display-only; if a field would change persistence or domain behavior, it belongs on another owner.

## Forbidden Drift

- Do not put workflow or persistence state into render payloads.
- Do not rebuild hover, selection, or runtime ownership semantics inside the renderer.
- Do not create temporary model owners just to draw previews that can already be expressed through canonical geometry or state.
