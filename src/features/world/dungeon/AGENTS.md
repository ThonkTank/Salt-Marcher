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
- `DungeonObject` — legacy dungeon composition seam — kept for compatibility under the final `dungeonclean` root while clean owners replace it incrementally.
- `geometry` — public dungeon spatial seams use the canonical carriers from this slice instead of raw point or segment collections.
- `dungeonmap/DungeonMapObject` — public loaded-map seam for cross-owner map reads and map-scoped workflows.
- `dungeonmap/input/EnsureLoadedInput`, `SelectMapInput`, and `SubmitMutationInput` — canonical map-owned load/reload requests used by shell and editor flows.
- `dungeonmap/input/SetActiveProjectionLevelInput`, `SetReachableProjectionLevelInput`, and the `SetLevelOverlay*Input` requests — canonical map-owned session-state transitions for loaded-map projection and overlay controls.
- `room/RoomObject` — public room seam for room-owned narration writes.
- `runtime/RuntimeObject` — public runtime seam for cross-owner runtime workflows such as persisted runtime-state repair.
- `stair/StairObject` — public stair seam for cross-owner stair workflows, starting with stair deletion.
- `transition/TransitionObject` — public transition seam for cross-owner transition workflows and transition-owned rebound persistence.
- `dungeonmap/structure/StructureObject` and `Structure` — shared physical topology seam for structure-backed map objects and their persisted topology.
- `dungeonmap/connections/ConnectionsObject` — shared traversal semantics seam for door-, stair-, and corridor-linked movement.
- `catalog/CatalogObject` — public catalog seam for dungeon-map list loading, selection policy, and create/rename/delete writes.

## Where New Code Goes

- Put new behavior on the documented owner first.
- Do not route new world-facing dungeon composition back through `DungeonObject`; that boundary now lives on `features.world.dungeonclean.DungeoncleanObject`.
- Cross owner boundaries only through the target owner's root package and public `*Object` seam. Do not skip intermediate owners.
- Keep shared physical topology on `dungeonmap/structure`, shared traversal semantics on `dungeonmap/connections`, and loaded-map/session ownership on `dungeonmap`.
- Route projection-level and overlay-control mutations through `dungeonmap/DungeonMapObject` instead of mutating `DungeonMapState` directly from shell views.
- Keep public dungeon geometry carrier-based. Shared spatial seams use the canonical `geometry` types rather than raw `Set/List/Collection<GridPoint|GridSegment>`.
- Keep runtime-only meaning under the `runtime` owner, editor gesture meaning under `shell/editor/interaction`, shell hit/highlight publication under `shell/interaction`, and display-only rendering under `canvas`.
- Route authoritative reloads through the owning workflow plus the owner's `repository` and `state` layers. Views and tools do not own the authoritative map snapshot.

## Forbidden Drift

- Do not add a second shared dungeon geometry vocabulary beside the `geometry` slice.
- Do not add a second shared physical topology owner beside `dungeonmap/structure`.
- Do not move physical door or stair ownership into `dungeonmap/connections`; that owner may describe carriers, not absorb their invariants.
- Do not introduce new dungeon-internal technical layers besides `input`, `task`, `repository`, and `state`, and do not introduce organizational directories that do not end with `Bucket`.
- Do not mirror room, corridor, stair, transition, runtime, or map state into tool-local state, render payloads, or storage helper types.
- Do not create alternate load, repair, or compatibility paths outside the canonical map-owner workflows.
- Do not re-promote `DungeonObject` to the world-facing dungeon root.
