# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`. For editor tools, also read `shell/editor/interaction/AGENTS.md`.

## Purpose

This file only records shell-local seams beneath `dungeonmap/`. Shared owner placement already lives in the parent file.

## Canonical Types and APIs

- `AbstractDungeonMapView` — shared view lifecycle — owns the shell-facing workspace lifecycle for dungeon surfaces.
- `DungeonHitCollector` — canonical hit collection seam — gathers raw hit candidates for tools and runtime consumers.
- `DungeonSelectionHighlightResolver` — semantic selection ref — resolves highlight surfaces from canonical model ownership.
- `DungeonEditorView` and `DungeonRuntimeView` — top-level shell surfaces — present editor and runtime dungeon flows.

## Where New Code Goes

- Put shell-only view lifecycle and inspector publication here.
- Put semantic hit resolution on the shared hit seams here before adding tool-specific hit walkers.
- Keep runtime details on the shared inspector path instead of inventing feature-local details panes.

## Forbidden Drift

- Do not move canonical workflow state into views.
- Do not add a parallel runtime details pane or shell-local owner wrapper hierarchy.
- Do not let preview state become commit state; successful writes reload authoritative data.
