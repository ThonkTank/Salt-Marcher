# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`. For editor tools, also read `shell/editor/interaction/AGENTS.md`.

## Purpose

`shell/` owns dungeon-facing UI wiring: views, hit probing, editor/runtime interaction, and publication into the shared inspector. It consumes canonical model and application seams instead of redefining them.

## Current Durable Structure

- `AbstractDungeonMapView` owns the shared view lifecycle around a view-local `DungeonCanvasWorkspace`.
- `interaction/` owns hit collection, hit surfaces, placement validation, drag helpers, and selection highlighting shared by editor and runtime.
- `editor/` owns the editor view and editor-only controls and panes.
- `runtime/` owns the runtime view and runtime-only interaction/controller code.
- `EditorInteractionState`, `DungeonEditorSessionState`, `DungeonMapState`, and `DungeonRuntimeState` split shared state by role and should stay narrow.

## Rules

- `DungeonHitCollector` owns raw hit candidates. Tools and runtime policies consume the shared hit snapshot instead of walking hit sources independently.
- `DungeonSelectionHighlightResolver` is the shared `DungeonSelectionRef -> DungeonHitSurface` seam for hover rendering.
- Runtime details publish through the shared `DetailsNavigator`.
- Runtime selection and movement resolve from the active navigation snapshot plus shared layout ownership, not from view-local mirrors.

## Forbidden Drift

- Do not move canonical workflow state into views.
- Do not add a parallel runtime details pane or shell-local owner wrapper hierarchy.
- Do not let preview state become commit state; successful writes reload authoritative data.
