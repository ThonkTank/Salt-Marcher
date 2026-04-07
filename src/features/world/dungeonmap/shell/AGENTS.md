# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/`. For editor tools, also read `shell/editor/interaction/AGENTS.md`.

## Purpose

`shell` owns dungeon-facing view lifecycle, shared hit collection, selection highlighting, and inspector publication.

## Canonical Types and APIs

- `AbstractDungeonMapView` — shared workspace lifecycle for dungeon-facing surfaces.
- `DungeonHitCollector` — canonical hit collection seam for tools and runtime consumers.
- `DungeonSelectionHighlightResolver` — semantic-selection-to-highlight seam.
- `DungeonEditorView`, `DungeonRuntimeView` — top-level shell surfaces for editor and runtime flows.

## Where New Code Goes

- Put shell-only view lifecycle and inspector publication here.
- Put semantic hit resolution on the shared hit seams before adding tool-specific hit walkers.
- Keep runtime details on the shared inspector path.

## Forbidden Drift

- Do not move canonical workflow state into views.
- Do not add a parallel runtime details pane or shell-local owner wrapper hierarchy.
- Do not let preview state become commit state; successful writes reload authoritative data.
