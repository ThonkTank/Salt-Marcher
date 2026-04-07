# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`. Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.

## Purpose

This file only documents model-local additions beneath `dungeonmap/`. Shared dungeonmap ownership already lives in the parent file.

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves cross-owner lookups, traversal, and canonical door or structure queries.
- `RoomCluster` — cluster aggregate — owns cluster-level room behavior over canonical `structure` truth.
- `Corridor` — corridor aggregate — owns corridor routing, path traces, segments, nodes, and realized corridor topology over canonical `structure` truth.
- `DungeonStair` — stair aggregate — owns authored stair behavior, stair path geometry, and exit validation.

## Where New Code Goes

- Put new dungeon semantics on the lowest stable model owner that actually enforces the invariant.
- Put new shared geometry behavior in `geometry/` only when it is owner-neutral and genuinely canonical.
- Put room-projection and shared physical topology logic on the sibling `structure` slice, not on repositories, views, or workflow helpers.
- Let `RoomCluster` and `Corridor` consume `StructureSurface` or `StructureBoundary` through `Structure`; do not recreate level-local surface or boundary helper owners inside `model/structures`.
- Keep immutable geometry and similar value types transparent; put invariant-protecting mutation on the actual owner type.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not recreate shared physical topology logic here when the `structure` slice already owns it.
- Do not move canonical semantic decisions into repositories, renderers, tools, or workflow coordinators.
- Do not cache structure-local mirrors of room, corridor, stair, or transition truth when the canonical owner already exists in the sibling `structure` slice.
