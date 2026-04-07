# AGENTS.md

This file covers `src/features/world/dungeonmap/application/runtime/`.

## Purpose

`application/runtime` owns dungeon runtime navigation, runtime action resolution, and runtime-facing read projections.

## Canonical Types and APIs

- `DungeonRuntimeApplicationService` — navigation requests or loaded layout — returns runtime navigation snapshots and persists tile-only campaign-state movement.
- `DungeonRuntimeActionResolver` — runtime context plus navigation snapshot — returns executable runtime actions.
- `DungeonRuntimeLocation` — shared location seam for action and description assembly.
- `DungeonRuntimeDescriptionResolver` — navigation snapshot — returns the read-only description payload shown by runtime UI.

## Where New Code Goes

- Put runtime-only navigation policy here before reaching for shell helpers or views.
- Resolve runtime actions from explicit floor-backed traversable cells, not by treating surface ownership as an implicit walkability fallback.
- Keep description builders read-only and subordinate to the runtime owner.

## Forbidden Drift

- Do not turn description builders into a second workflow owner.
- Do not reparse layout ownership independently at runtime UI sinks.
- Do not turn runtime projections into alternate model truth or write-capable objects.
