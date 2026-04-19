Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shared dungeon-map presentation ownership and exported
selection boundary for `src/view/dungeonshared/**`.

# Dungeonshared UI

## Purpose

`dungeonshared` owns the shared dungeon-map presentation workflow used by the
editor and travel slices.

## Ownership

- `ViewModel/` owns reusable presentation state that is consumed by shared
  dungeon workspace logic, plus the selection/inspector payload contract.
- `View/` owns JavaFX inspector content, runtime-session facades, and shared
  dungeon control panes.
- `assembly/` remains migration debt for shared projection, domain
  coordination, and interaction orchestration that has not yet been split into
  `View/` and `ViewModel/` roles.

## Selection Boundary

- `DungeonSelectionPublisher` is the presentation-level selection/inspector
  contract used by editor and travel roots.
- `DungeonSelectionInspectorEntry` is the render-ready payload for that
  contract and keeps domain inspector snapshots out of shell-facing signatures.
- Shell inspector adaptation lives in the contribution roots, not below
  `View/` or `ViewModel/`.
