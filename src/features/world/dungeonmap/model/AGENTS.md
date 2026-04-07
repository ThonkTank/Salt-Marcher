# AGENTS.md

This file covers `src/features/world/dungeonmap/model/`.

## Purpose

`model` owns legacy shared dungeon value types that are not yet split into their own top-level owner slices, plus interaction refs and cross-owner connection semantics. The loaded map snapshot now lives in the sibling `map` slice.

## Canonical Types and APIs

- `interaction/DungeonSelectionRef` — canonical editor/runtime selection vocabulary.
- `structures/connection/Connection`, `ConnectionEndpoint`, `DoorExitCatalog` — shared cross-owner connection and exit semantics.
- `DungeonStair` — stair aggregate over stair path geometry and exit validation.

## Where New Code Goes

- Put new dungeon semantics on the lowest stable owner that enforces the invariant.
- Put loaded-map snapshot, map loading, map rehydration, and map-scoped session state on the sibling `map` owner.
- Put shared geometry behavior in the sibling `geometry/` slice only when it is owner-neutral and canonical.
- Let top-level owners such as `RoomCluster` consume surface truth only through `Structure.surfaceAtLevel(levelZ).surface()` or `.floor()`, and boundary truth only through `Structure.boundaryAtLevel(levelZ)`.
- When room or corridor workflows need to create or mutate physical structure, translate that request into `StructureSpecification` or `StructureMutation` and let `Structure` own the result.
- End traversability, runtime, and exit semantics on `floor()`. Use `surface()` only when the caller explicitly means owned area or projection footprint rather than walkable truth.
- Let model callers consume structure-backed room projection and local room connections only through `Structure.roomTopology()`, not via convenience mirrors on `Structure`.
- Treat `Structure.roomTopology()` as a derived read companion over physical structure plus room metadata, not as an alternate persisted structure payload.
- Treat `StructureBoundary` as the `structure` slice's local `boundary` sub-owner; model callers may depend on its public API but must not re-home boundary truth back into `model/structures`.
- When model callers work with one `Door` or `Wall`, use that object's explicit API for clipping, segment access, touching-cell reads, or rewrite behavior instead of recreating boundary-shape operations locally.
- If room-facing code needs derived room structure, resolve the owning cluster or structure first and then continue on `cluster.structure().roomTopology().structureFor(...)` instead of adding room-local surface or boundary forwarding methods.
- Keep immutable geometry and similar value types transparent; put invariant-protecting mutation on the actual owner type.

## Forbidden Drift

- Do not add a second geometry seam beside `geometry/`.
- Do not recreate shared physical topology logic here when the `structure` slice already owns it.
- Do not keep parallel physical structure builder or mutation APIs on `RoomCluster`, tools, or legacy model helpers once the same change can be expressed as `StructureSpecification` or `StructureMutation`.
- Do not move canonical semantic decisions into repositories, renderers, tools, or workflow coordinators.
- Do not move `DungeonLayout`, map loading, or map state ownership back into `model/`.
- Do not cache or re-export room mirrors on `RoomCluster`, corridor helpers, or other model owners. If code needs room cells, floor cells, anchors, or containment, resolve the owning cluster and then continue on `cluster.structure().roomTopology().structureFor(...)`.
- Do not widen `Door` or `Wall` back onto generic geometry helpers from model code; if a needed read is missing, add it to `BoundaryObject`, `Door`, `Wall`, or `StructureBoundary` instead of widening the caller.
- Do not expose graph-debug helpers like adjacency or component index mirrors from `RoomCluster` unless a real consumer needs them.
