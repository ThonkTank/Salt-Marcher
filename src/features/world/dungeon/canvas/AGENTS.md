# Dungeon Canvas

## Purpose

`canvas` owns dungeon rendering, camera behavior, and raw pointer or scroll input forwarding.

## Canonical Types and APIs

- `DungeonCanvasWorkspace` — observed map state plus interaction handler — renders one dungeon workspace and forwards raw input.
- `DungeonSceneFrame` — render payload — bundles the canonical data required for one draw pass.
- `DungeonGridSceneRenderer` — scene renderer for canonical dungeon overlays.

## Where New Code Goes

- Put pure rendering behavior, camera math, and raw pointer translation here.
- Keep render payloads display-only.

## Forbidden Drift

- Do not put workflow or persistence state into render payloads.
- Do not rebuild hover, selection, or runtime ownership semantics inside the renderer.
- Do not introduce preview-only model owners when canonical geometry or shared state already express the draw input.
