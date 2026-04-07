# AGENTS.md

This file covers `src/features/world/dungeonmap/application/runtime/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This file only records runtime-local seams beneath `dungeonmap/`. Shared owner placement already lives in the parent file.

## Canonical Types and APIs

- `DungeonRuntimeApplicationService` — navigation requests or loaded layout — returns runtime navigation snapshots and persists tile-only campaign-state movement.
- `DungeonRuntimeActionResolver` — runtime context plus navigation snapshot — returns executable runtime actions.
- `DungeonRuntimeLocation` — parsed runtime location — shared location seam for action and description assembly.
- `DungeonRuntimeDescriptionResolver` — navigation snapshot — returns the read-only description payload shown by runtime UI.

## Where New Code Goes

- Put runtime-only navigation policy here before reaching for view controllers or shell helpers.
- Keep description builders read-only and subordinate to the runtime owner.

## Forbidden Drift

- Do not turn description builders into a second workflow owner.
- Do not reparse layout ownership independently at every runtime UI sink.
- Do not turn runtime projections into alternate model truth or write-capable objects.
