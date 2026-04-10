# Shared Structure Owner

## Purpose

`structure` owns shared physical dungeon topology inside `dungeonmap` and the persistence shape that keeps that topology canonical across cluster and corridor owners.

## Canonical Types and APIs

- `StructureObject` — public root owner seam for shared dungeon structure topology.
- `StructureObject.empty / fromSpecification / fromSurfaceLevel / fromPersistenceSnapshot` — canonical top-level creation and rehydration routes for shared structure topology.
- `StructureObject.withRoomMetadata / projectToLevel / mutate` — canonical structure-wide room-topology derivation, projection, and physical mutation routes.
- `StructureObject.loadBoundaryAtLevel / loadSurfaceAtLevel / loadRoomTopology` — canonical owner-facing routes into the local boundary, surface, and room-topology children.
- `structure/input/*Input` — canonical request shapes for public shared-topology creation, projection, mutation, and child-loading seams.
- `Structure`, `StructureSpecification`, `StructureMutation` — canonical creation and mutation seams for shared physical topology.
- `Structure.surfaceAtLevel(levelZ)`, `Structure.boundaryAtLevel(levelZ)`, and `Structure.roomTopology()` — canonical routes into the local `surface`, `boundary`, and `room` sub-owners.
- `StructureSurface`, `StructureSurfaceArea`, `StructureFloor` — level-local surface and floor ownership.
- `StructureBoundary`, `Door`, `DoorRef`, `Wall`, `WallKind` — level-local boundary and single-object wall/door ownership.
- `StructureRoomTopology` — derived room projection and local room-connection seam.
- `DungeonStructureRepository` and `DungeonWallKindRepository` — shared structure persistence seams.

## Where New Code Goes

- Put shared physical topology, boundary identity, and structure persistence shape here.
- Put public owner-facing structure creation, rehydration, projection, mutation, and child-load requests in `structure/input`.
- Keep callers on the explicit child-owner routes from `Structure` instead of re-exporting child state as convenience mirrors.
- Keep structure persistence shaped like the runtime owner composition `Structure -> level -> surface + boundary`.
- Keep room- or corridor-specific workflow logic in their own owners; only reused physical structure truth belongs here.

## Forbidden Drift

- Do not mirror shared physical topology into cluster, corridor, runtime, renderer, or storage helper types.
- Do not reopen top-level structure creation or empty fallbacks through scattered `Structure.*` entrypoints from foreign owners; route them through `StructureObject`.
- Do not bypass `StructureSurface`, `StructureBoundary`, or `StructureRoomTopology` by rebuilding the same child truth on `Structure`.
- Do not add second public structure creation or mutation seams beside `StructureSpecification` and `StructureMutation`.
- Do not flatten structure persistence into a second DTO family when the runtime owner graph already defines the canonical shape.
