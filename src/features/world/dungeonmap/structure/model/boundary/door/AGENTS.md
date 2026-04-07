# AGENTS.md

This file covers `src/features/world/dungeonmap/structure/model/boundary/door/`.

## Purpose

`door` owns single-door behavior beneath the `boundary` aggregate.

## Canonical Types and APIs

- `Door` — single-door owner — extends the internal `BoundaryObject` base and owns door-local state plus door-specific removal semantics and passage blocking.
- `DoorRef` — stable reference to one persisted door.

## Where New Code Goes

- Put door-specific mutation and invariant protection here.
- Keep higher-level callers on `Door`'s explicit API such as boundary segment access, touching-cell reads, clipping, and boundary-segment removal.
- Let `StructureBoundary` aggregate door collections, but keep door-local surgery here.

## Forbidden Drift

- Do not rebuild door-local edit behavior from raw `EdgeShape` operations in callers.
- Do not rely on inherited generic `EdgeShape` methods from `Door` outside the owner subtree when the explicit `Door` or `BoundaryObject` API already covers the read.
- Do not introduce a second door aggregate owner unless there is a concrete aggregate invariant that one `Door` cannot enforce.
- Do not re-home stable door references outside `DoorRef`.
