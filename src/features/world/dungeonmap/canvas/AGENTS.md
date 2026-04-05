# AGENTS.md

This file covers `src/features/world/dungeonmap/canvas/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Ownership

- `canvas/base/` owns the workspace, camera, pointer events, theme, render payloads, and scene-frame assembly.
- `canvas/grid/` owns grid rendering and interactive label drawing.
- Canvas code renders and captures raw input. Domain meaning stays in shell, application, and model owners.

## Rendering Contract

- `DungeonCanvasWorkspace` observes `DungeonMapState` for active layout, level, and overlay changes.
- Rendering is explicit and coalesced: state changes request redraw, redraw builds one `DungeonSceneFrame`, and the renderer consumes that snapshot.
- Editor and runtime views pass display-only render payloads into the workspace. Workflow state does not belong in render payloads.
- `DungeonGridSceneRenderer` renders room and corridor floors from `CellCoord` surfaces and boundaries/overlays from final `GridPoint2x` and `GridSegment2x` carried by `StructureObject`, editor previews, and runtime overlays.
- Paint previews are direct `CellCoord` overlays. Do not build temporary `StructureObject`s just to render them.
- Corridor graph handles are an editor-only overlay on top of shared structure geometry.
- `DungeonEditorRenderState` is display-only and carries selection, hover, and preview geometry only.
- `DungeonRuntimeRenderOverlay` carries the active navigation snapshot plus runtime exit markers derived from the resolved surface.

## Workspace Interaction

- The workspace owns zoom, pan, and default level scrolling.
- Runtime may override level-scroll handling to clamp against reachable levels.
