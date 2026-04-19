Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Shared dungeon-map presentation ownership and exported
selection boundary for `src/view/dungeonshared/**`.

# Dungeonshared UI

## Purpose

`dungeonshared` owns the shared dungeon-map presentation workflow used by the
editor and travel slices.

## Ownership

- `ViewModel/` owns reusable presentation state that is consumed by shared
  dungeon workspace logic.
- The current repo still carries shared projection, domain coordination, and
  interaction code in `interactor/` as migration debt while the component is
  moved toward canonical MVVM buckets.
- `assembly/` owns shell-facing adaptation such as the inspector adapter and
  the shared runtime-state contribution that publishes dungeon travel state.

## Public Boundary

- `api/` is the only exported cross-component boundary.
- `DungeonSelectionPublisher` is the public selection/inspector contract used
  by editor and travel code.
- `DungeonSelectionInspectorEntry` is the exported render-ready payload for
  that contract and keeps domain inspector snapshots out of public `api/`
  signatures.
- Private `ViewModel/` types and any remaining legacy `interactor/` types
  remain internal to `dungeonshared`.
