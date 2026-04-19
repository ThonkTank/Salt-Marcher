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
  dungeon workspace logic.
- `assembly/` owns shared projection, domain coordination, interaction
  orchestration, inspector adaptation, and the runtime-state contribution that
  publishes dungeon travel state.

## Public Boundary

- `api/` is the only exported cross-component boundary.
- `DungeonSelectionPublisher` is the public selection/inspector contract used
  by editor and travel code.
- `DungeonSelectionInspectorEntry` is the exported render-ready payload for
  that contract and keeps domain inspector snapshots out of public `api/`
  signatures.
- Private `View/`, `ViewModel/`, and `assembly/` types remain internal to
  `dungeonshared`.
