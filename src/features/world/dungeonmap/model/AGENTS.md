# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`.

## Purpose

`model` owns dungeon layout, geometry, interaction refs, and aggregate-specific dungeon semantics.

## Canonical Types and APIs

- `DungeonLayout` — loaded map snapshot — resolves cross-owner lookups, traversal, and canonical door or structure queries.
- `RoomCluster` — cluster aggregate over canonical `structure` truth.
- `Corridor` — corridor aggregate over canonical `structure` truth and corridor-owned routing data.
- `DungeonStair` — stair aggregate over stair path geometry and exit validation.

## Where New Code Goes

- Put new dungeon semantics on the lowest stable model owner that enforces the invariant.
- Put shared geometry behavior in `geometry/` only when it is owner-neutral and canonical.
- Let `RoomCluster` and `Corridor` consume surface truth only through `Structure.surfaceAtLevel(levelZ).surface()` or `.floor()`, and boundary truth only through `Structure.boundaryAtLevel(levelZ)`.
- Treat `StructureBoundary` as the `structure` slice's local `boundary` sub-owner; model callers may depend on its public API but must not re-home boundary truth back into `model/structures`.
- When model callers work with one `Door` or `Wall`, use that object's explicit API for clipping, segment access, or rewrite behavior instead of composing generic `EdgeShape` edits locally.
- If room-facing code needs the derived room structure, expose that `Structure` and continue from its public sub-object seams instead of adding room-local surface or boundary forwarding methods.
- Keep immutable geometry and similar value types transparent; put invariant-protecting mutation on the actual owner type.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not recreate shared physical topology logic here when the `structure` slice already owns it.
- Do not move canonical semantic decisions into repositories, renderers, tools, or workflow coordinators.
- Do not cache or re-export structure-local surface-area, floor, or boundary mirrors on `RoomCluster`, `DungeonLayout`, corridor helpers, or other model owners.
