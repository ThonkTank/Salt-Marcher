# Dungeon Feature

## Purpose

`dungeon` owns the dungeon editor and matching runtime surface. Editor, runtime, map loading, and persistence must all resolve the same dungeon topology.

## Owner Atlas

- `geometry` — canonical grid algebra and shared spatial carrier vocabulary.
- `dungeonmap` — loaded map snapshot, load/reload orchestration, map state, and the nested `structure`, `cluster`, `corridor`, and `connections` owners.
- `room` — room-owned metadata and room workflow seams.
- `stair` — stair authoring and stair-path generation.
- `transition` — transition placement and target resolution.
- `runtime` — runtime navigation, actions, and description assembly.
- `shell` and `canvas` — shell lifecycle, interaction, highlighting, rendering, and raw input forwarding.
- `catalog` — map catalog creation, rename, and delete flows.

## Canonical Types and APIs

- `checkOwnerApiBoundaryConvention` — build-time owner-boundary gate for `*Object`, `input`, `task`, `repository`, `state`, and `*Bucket` rules.
- `geometry` — public dungeon spatial seams use the canonical carriers from this slice instead of raw point or segment collections.
- `dungeonmap/DungeonMapObject` — public loaded-map seam for cross-owner map reads and map-scoped workflows.
- `room/RoomObject` — public room seam for room-owned narration writes.
- `dungeonmap/structure/StructureObject` and `Structure` — shared physical topology seam for structure-backed map objects and their persisted topology.
- `dungeonmap/connections/ConnectionsObject` — shared traversal semantics seam for door-, stair-, and corridor-linked movement.
- `catalog/CatalogObject` — public catalog seam for dungeon-map create, rename, and delete writes.
- `DungeonClusterApplicationService`, `DungeonCorridorApplicationService`, `DungeonStairApplicationService`, `DungeonTransitionApplicationService`, `DungeonRuntimeApplicationService` — legacy workflow seams still backing cluster, corridor, stair, transition, and runtime behavior while their owner-local migrations continue.

## Where New Code Goes

- Put new behavior on the documented owner first.
- Cross owner boundaries only through the target owner's root package and public `*Object` seam. Do not skip intermediate owners.
- Keep shared physical topology on `dungeonmap/structure`, shared traversal semantics on `dungeonmap/connections`, and loaded-map/session ownership on `dungeonmap`.
- Keep public dungeon geometry carrier-based. Shared spatial seams use the canonical `geometry` types rather than raw `Set/List/Collection<GridPoint|GridSegment>`.
- Keep runtime-only meaning under `application/runtime`, editor gesture meaning under `shell/editor/interaction`, shell hit/highlight publication under `shell/interaction`, and display-only rendering under `canvas`.
- Route authoritative reloads through the owning workflow plus the owner's `repository` and `state` layers. Views and tools do not own the authoritative map snapshot.

## Forbidden Drift

- Do not add a second shared dungeon geometry vocabulary beside the `geometry` slice.
- Do not add a second shared physical topology owner beside `dungeonmap/structure`.
- Do not move physical door or stair ownership into `dungeonmap/connections`; that owner may describe carriers, not absorb their invariants.
- Do not introduce new dungeon-internal technical layers besides `input`, `task`, `repository`, and `state`, and do not introduce organizational directories that do not end with `Bucket`.
- Do not mirror room, corridor, stair, transition, runtime, or map state into tool-local state, render payloads, or storage helper types.
- Do not create alternate load, repair, or compatibility paths outside the canonical map-owner workflows.
