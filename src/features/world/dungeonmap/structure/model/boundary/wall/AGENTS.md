# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/boundary/wall/`.

## Purpose

`wall` owns single-wall behavior beneath the `boundary` aggregate.

## Canonical Types and APIs

- `Wall` — single-wall owner — extends the internal `BoundaryObject` base and owns wall-local state plus wall-specific split-on-delete behavior and kind semantics.
- `WallKind` — shared wall behavior definition used by `Wall`.

## Where New Code Goes

- Put wall-specific mutation and invariant protection here.
- Keep higher-level callers on `Wall`'s explicit API such as boundary segment access, touching-cell reads, clipping, split-on-delete, and kind changes.
- Let `StructureBoundary` aggregate wall collections, but keep wall-local surgery here.

## Forbidden Drift

- Do not rebuild wall-local edit behavior from raw `EdgeShape` operations in callers.
- Do not rely on inherited generic `EdgeShape` methods from `Wall` outside the owner subtree when the explicit `Wall` or `BoundaryObject` API already covers the read.
- Do not introduce a second wall aggregate owner unless there is a concrete aggregate invariant that one `Wall` cannot enforce.
- Do not move shared wall-kind interpretation out of `WallKind` and back into aggregate or renderer helpers.
