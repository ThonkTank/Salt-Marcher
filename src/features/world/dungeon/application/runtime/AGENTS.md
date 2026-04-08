# Runtime Owner

## Purpose

`application/runtime` is the legacy internal collaborator subtree for dungeon runtime navigation, runtime action resolution, and runtime-facing read projections. It remains current implementation reality, but it is not placement precedent for new owner-layer work.

## Canonical Types and APIs

- `DungeonRuntimeApplicationService` — current internal runtime workflow collaborator — returns runtime navigation snapshots and persists tile-only campaign-state movement.
- `DungeonRuntimeActionResolver` — runtime context plus navigation snapshot — returns executable runtime actions.
- `DungeonRuntimeLocation` — shared location seam for action and description assembly.
- `DungeonRuntimeDescriptionResolver` — navigation snapshot — returns the read-only description payload shown by runtime UI.

## Where New Code Goes

- When touching existing runtime collaborators here, keep runtime-only navigation policy here instead of leaking it into shell helpers or views.
- Resolve runtime actions from explicit floor-backed traversable cells, not by treating surface ownership as an implicit walkability fallback.
- Keep description builders read-only and subordinate to the runtime owner.
- Do not treat `application/runtime` as the destination for new owner-layer placement; prefer the canonical runtime owner seams documented above it.

## Forbidden Drift

- Do not turn description builders into a second workflow owner.
- Do not reparse layout ownership independently at runtime UI sinks.
- Do not turn runtime projections into alternate model truth or write-capable objects.
