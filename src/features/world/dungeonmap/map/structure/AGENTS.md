# AGENTS.md

This file covers `src/features/world/dungeonmap/map/structure/`.

## Purpose

`structure` owns shared physical dungeon topology inside `map` and the persistence that keeps that topology canonical across room-cluster and corridor owners.

## Canonical Types and APIs

- `Structure` — abstract shared physical structure base — composes the local `surface`, `boundary`, and `room` sub-owners for each level. `RoomCluster` and `Corridor` extend this base; `roomTopology()` is a derived companion over the physical structure plus room metadata, not an additional persisted structure state.
- `StructureSpecification` — canonical full creation payload for public structure construction.
- `StructureMutation` — canonical public mutation vocabulary for structure-backed physical edits.
- `StructureSurface` — level-local surface aggregate seam; callers enter through `Structure.surfaceAtLevel(levelZ)` and then continue on `surface()` or `floor()`.
- `surface/StructureSurfaceArea`, `surface/StructureFloor` — local surface sub-owners for area and floor truth.
- `StructureBoundary` — level-local boundary aggregate for wall and door capability sets, boundary edges, cross-object boundary rules, and boundary persistence snapshots.
- `boundary/door/Door`, `boundary/door/DoorRef` — single-door sub-owner plus stable reference.
- `boundary/wall/Wall`, `boundary/wall/WallKind` — single-wall sub-owner plus shared wall-kind definition.
- `room/StructureRoomTopology` — room projection aggregate over one `Structure` — resolves derived room structures, adjacency, components, and room-to-room connections.
- `DungeonStructureRepository` — shared structure persistence seam that mirrors the runtime split into `Structure.LevelStructure`, `StructureSurface`, and `StructureBoundary`.
- `DungeonWallKindRepository` — wall-kind catalog seam used by structure loading.

## Where New Code Goes

- Put shared physical topology, boundary identity, and shared room-projection logic here.
- Keep public structure-backed creation on `Structure.fromSpecification(...)` and public structure-backed mutation on `structure.mutated(...)`.
- Put level-local surface behavior on the local `model/surface/` sub-owner and keep callers on `structure.surfaceAtLevel(levelZ).surface()` or `.floor()`.
- Put object-local surface-area and floor behavior on the `model/surface/` subtree instead of expanding `StructureSurface`.
- Keep structure construction explicit: new structures must materialize both surface and floor sets directly instead of creating a surface-only shell and letting callers infer walkability later.
- Put level-local wall, door, and boundary-edge behavior on the local `model/boundary/` sub-owner and keep callers on `structure.boundaryAtLevel(levelZ)`.
- Put object-local door behavior on `model/boundary/door/` and object-local wall behavior on `model/boundary/wall/`.
- Put structure-local room projection, lookup, adjacency, and local room-connection behavior on the local `model/room/` sub-owner and keep callers on `structure.roomTopology()`.
- Let `DungeonLayout` and `RoomCluster` stop at generic owner lookup; public room reads must continue from the owning `Structure`, not via layout- or cluster-level room mirrors.
- Derive local room connections directly from the canonical structure boundary plus room projection; do not route graph derivation through per-room structure caches.
- If callers need one boundary object at one segment, resolve it through `StructureBoundary` object lookups and continue on that `Door` or `Wall`; do not add second boolean or projected-edge mirrors for door or wall truth.
- Put level-local boundary persistence data on `StructureBoundary.PersistenceSnapshot`, let `StructureSurface.PersistenceSnapshot` compose the `StructureSurfaceArea` and `StructureFloor` snapshots, and let `Structure.LevelStructure.PersistenceSnapshot` compose those owner snapshots.
- If room-facing code needs one derived room's surface or floor truth, expose the derived `Structure` and continue on `surfaceAtLevel(levelZ).surface()` or `.floor()` instead of adding room-level mirrors back onto `StructureRoomTopology`.
- Keep room- or corridor-specific workflow logic in their owners; only reused physical structure truth belongs here.
- Keep internal mutation and invariant protection on `Structure`, `StructureSurface`, `StructureSurfaceArea`, `StructureFloor`, and `StructureBoundary`.
- Child-owner mutation helpers on `StructureSurface` or `StructureBoundary` are dispatch internals for `Structure`, not alternate public workflows.

## Forbidden Drift

- Do not mirror shared physical topology into room, corridor, runtime, renderer, or storage helper types.
- Do not bypass `StructureSurfaceArea` or `StructureFloor` by rebuilding anchor, surface, floor, or clipping logic ad hoc, and do not re-export those capabilities from `Structure`, `LevelStructure`, or `StructureBoundary`.
- Do not mirror room projection back onto `Structure` through convenience APIs like `rooms()` or `localRoomConnections()`; callers must go through `roomTopology()`.
- Do not re-export derived room anchors, room cell sets, room floor sets, or room containment checks from `StructureRoomTopology`; those callers must go through `structureFor(...)`.
- Do not bypass `StructureBoundary` by patching wall or door state through ad-hoc writable data structures.
- Do not add second public structure creation or mutation seams like `withSurfaceAtLevel(...)`, `withBoundaryAtLevel(...)`, `fromSurfaceCellsByLevel(...)`, or comparable caller-specific builders.
- Do not add convenience APIs on `StructureBoundary` that only mirror `Door`, `Wall`, or `BoundaryObject` truth as projected sets, booleans, or `WallKind` lookups when callers can resolve the object and stay on its explicit API.
- Do not keep door- or wall-specific rewrite logic on `StructureBoundary` when one `Door` or `Wall` can own it directly.
- Do not flatten surface and boundary persistence back into a second structure-only snapshot shape when the runtime owners already provide the canonical composition.
- Do not pull corridor routing traces or stair geometry back into `Structure`.
- Do not create a second persistence path for shared structure truth outside this slice.
- Do not treat `roomTopology()` as part of `Structure` persistence or physical equality.
