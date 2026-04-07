# AGENTS.md

This file covers `src/features/world/dungeonmap/canvas/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

`canvas/` owns dungeon rendering and raw pointer/scroll input. It should be easy to understand what gets drawn without making canvas code a second owner of dungeon semantics.

## Current Durable Structure

- `canvas/base/` owns the workspace, camera, input handler interfaces, render payloads, and scene-frame assembly.
- `canvas/grid/` owns the grid renderer and interactive label drawing.
- `DungeonCanvasWorkspace` observes `DungeonMapState`, coalesces redraws, and hands one `DungeonSceneFrame` to the renderer.
- `DungeonEditorRenderState` and `DungeonRuntimeRenderOverlay` are display payloads only.

## Forbidden Drift

- Do not put workflow or persistence state into render payloads.
- Do not rebuild hover, selection, or runtime ownership semantics inside the renderer.
- Do not create temporary model owners just to draw previews that can already be expressed as cells or segments.
