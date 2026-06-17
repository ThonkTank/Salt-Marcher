Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Index for current Core Dungeon model invariant proof rows and
target family-specific invariant catalogs.

# Dungeon Core Model Invariants

This document indexes current model-only invariant proof rows for Dungeon Core
objects and routes target component-family invariant obligations to the
family-specific catalogs below. These rows supplement real-route `DE-*`
behavior proof and never close a catalog `Ready` behavior row by themselves.

## Target Family Catalogs

The target family catalogs describe the Dungeon domain target-state
component-owner migration direction. They may intentionally name owners that
are not yet the current code shape; their `Current Status` column distinguishes
target obligations from qualified proof.

Each family catalog names the eventual focused family harness or OwnerSuite
proof expected for migration slices. This documentation pass does not create a
new Gradle task or public verification gate.

- [Floor invariants](verification-dungeon-floor-invariants.md)
- [Room invariants](verification-dungeon-room-invariants.md)
- [Cluster invariants](verification-dungeon-cluster-invariants.md)
- [Wall invariants](verification-dungeon-wall-invariants.md)
- [Path invariants](verification-dungeon-path-invariants.md)
- [Door invariants](verification-dungeon-door-invariants.md)
- [Corridor invariants](verification-dungeon-corridor-invariants.md)
- [Stair invariants](verification-dungeon-stair-invariants.md)
- [Transition invariants](verification-dungeon-transition-invariants.md)

## Proof Model

Model invariant rows are grouped by the `core` suite in
`DungeonEditorBehaviorSuiteHarness`. They are runnable through
`dungeonEditorCoreBehaviorHarness` for focused investigation and remain part of
the complete `dungeonEditorBehaviorHarness` aggregate. Each published harness
summary row must include:

- `OwnerSuite`
- `ProofType=ModelInvariant`
- an invariant id

Model invariant rows use `Qualified` for proved invariant rows. They do not
use the editor route catalogs' `Ready` status vocabulary.

## Geometry Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-GEO-001` | `DungeonGeometryInvariantHarness` | `core/geometry/Direction` and `Cell` | Direction neighbor deltas preserve cell level and cardinal offsets. |
| `DGI-GEO-002` | `DungeonGeometryInvariantHarness` | `core/geometry/Edge` | `Edge.sideOf` and `touchingCells` return the two authored cells adjacent to each cardinal side and reject non-orthogonal edge adjacency. |
| `DGI-GEO-003` | `DungeonGeometryInvariantHarness` | `core/geometry/CellOrdering` | Cell ordering deduplicates cells and orders by level, row, then column. |
| `DGI-GEO-004` | `DungeonGeometryInvariantHarness` | `core/geometry/Route` | Route creates horizontal-first corridor cells and owns the explicit policy difference between level-transition paths and validation paths that stay on the start level. |

## Component Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-CMP-001` | `DungeonComponentInvariantHarness` | `core/component/StairExit` | Stair exits keep local id, position, and label invariants; missing positions are rejected by core while compatibility defaults remain in transitional adapters. |
| `DGI-CMP-002` | `DungeonComponentInvariantHarness` | `core/component/CorridorAnchor` | Corridor anchors keep local id, host corridor id normalization, position, relocation, and position-match invariants; missing positions are rejected by core while compatibility defaults remain in transitional adapters. |
| `DGI-CMP-003` | `DungeonComponentInvariantHarness` | `core/component/CorridorDoorBinding`, `CorridorWaypoint`, `CorridorAnchorRef` | Corridor binding components keep local door, waypoint, and anchor-reference values plus transitional adapter compatibility. Topology refs remain transitional adapter identity until the structure or graph owner is migrated. |

## Qualified Structure Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-STR-001` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoomSet`, `CorridorBindings`, `CorridorResolvedEndpoint`, `CorridorAnchorSnap`, `CorridorHostCells`, `CorridorAnchorEndpointMaterialization` | Corridor structure owns room-set normalization/removal, binding container rules, resolved endpoint shape, and door removal by room. Resolved door endpoints reject missing room ids, reject anchor semantics, and expose their core door binding; resolved anchor endpoints reject room ids and stable-door semantics. Corridor structure also owns anchor binding/ref replacement by local anchor id, anchor snapping to the nearest host cell with level/row/column tie-breaks and fallback behavior, host-cell lookup by corridor id, anchor endpoint creation/reuse by preferred local id or snapped position, and target-local waypoint or anchor-ref removal. Topology-ref identity, persistence/readback, map-level route repair/deletion, and runtime graph ownership remain outside this model-invariant row and require RealRoute `DE-*` proof or future core topology/graph proof. |
| `DGI-STR-002` | `DungeonStructureInvariantHarness` | retained corridor binding compatibility route | Retained compatibility proof preserves topology-ref identity for anchor binding/ref replacement and surviving door bindings after door removal while final topology ownership remains outside the local binding row. |
| `DGI-STR-003` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoutePlan` plus retained binding publication compatibility | Corridor structure owns interior route-anchor selection and waypoint planning for route splits. Retained compatibility proof preserves selected anchor topology refs when the planned anchor refs are published through current binding materialization. |
| `DGI-STR-004` | `DungeonStructureInvariantHarness` | `core/structure/Corridor` | Corridor structure owns target-local door, anchor, and waypoint delete behavior, including room removal, route-waypoint pruning, anchor-ref removal, and waypoint removal. Surviving topology-ref proof remains a retained compatibility concern outside the local corridor owner row. |
| `DGI-STR-005` | `DungeonStructureInvariantHarness` | `core/structure/CorridorNetwork` plus retained connection-normalization compatibility | Corridor network owns protected whole-corridor delete and detached-anchor pruning across authored corridors. Retained compatibility proof preserves topology refs while final topology ownership remains outside this local network row. |
| `DGI-STR-006` | `DungeonStructureInvariantHarness` | `core/structure/Stair`, `StairGeometrySpec`, `StairShape` | Stair structure owns editor shape support, editor dimension bounds and normalization, generated path/exits, existing exit-id preservation, readability, occupied cells, handle movement, corridor-bound construction, and pure room-interior geometry predicates. |
| `DGI-STR-007` | `DungeonStructureInvariantHarness` | `core/structure/transition/Transition`, `TransitionCatalog`, and `TransitionDestination` | Transition structure keeps aggregate-level transition mechanics backed by core transition objects while Transition owner proof owns local transition facts, transition-link behavior, and protected delete policy in `DGI-TRANSITION-001`, `DGI-TRANSITION-002`, and `DGI-TRANSITION-004`. The structure harness exercises transition delete protection, deletion, destination update, and reverse-link cleanup through core `TransitionCatalog` and `TransitionDestination`. Map-level materialization and persistence remain outside this invariant row until later integration slices. |
| `DGI-STR-008` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterDoorBoundaryMaterialization` compatibility route delegating to Door owner support | Room structure keeps the retained door-boundary materialization entrypoint as compatibility glue while Door owner proof owns door local facts, local boundary lookup, materialization eligibility, protected delete rejection, and restored wall boundary state in `DGI-DOOR-001`, `DGI-DOOR-002`, `DGI-DOOR-003`, and `DGI-DOOR-004`. Topology-ref identity, persisted boundary rows, partition rebuild, replacement application, and full corridor reroute behavior remain outside this invariant row until later integration slices. |
| `DGI-STR-009` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryMaterialization` compatibility route delegating to `RoomClusterWallMap` support | Room structure keeps the boundary-row materialization entrypoint as compatibility glue while Wall owner proof owns wall/open boundary materialization policy in `DGI-WALL-003`. The compatibility route preserves cluster-cell, center-relative cell, edge direction, and requested boundary-kind behavior for existing callers. Topology-ref identity, persisted boundary maps, partition rebuild, and corridor-bound delete protection are map-level structure concerns outside this local row. |
| `DGI-STR-010` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterRoomPartition` | Room structure owns closed-boundary partitioning of cluster cells into rooms, reuse of existing room ids by floor anchor, allocation of ids for new split-room components, and boundary-aware room-cell assignment. Persisted boundary rows, narration, topology-ref identity, and map-level rebuild are covered by aggregate or real-route proof outside this local row. |
| `DGI-STR-011` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryOrdering` and `core/geometry/EdgeKey` | Room structure keeps persisted boundary-row sorting and level grouping while Wall owner proof owns wall-row normalization in `DGI-WALL-002`. Geometry owns normalized edge-key identity and positive stable ids. Topology-ref preservation, persisted boundary record publication, boundary edit transactions, partition rebuild, and corridor-bound door-delete protection are aggregate-level concerns outside this local row. |
| `DGI-STR-012` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryStretchPlan` compatibility route delegated from `RoomClusterWallMap` | Room structure keeps the stretch-plan mechanics as compatibility support while Wall owner proof owns wall-map stretch behavior in `DGI-WALL-004`. The compatibility route preserves orientation, contiguous source-edge selection, outward-side detection, movement-normal validation, moved strip-cell derivation, boundary vertices, connector-path derivation, and source edge-key identity for existing callers. Persisted boundary records, topology-ref preservation, corridor-bound boundary protection, boundary mutation transactions, partition rebuild, and map-level publication are aggregate-level concerns outside this local row. |
| `DGI-STR-013` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterWallMap` and package-private wall-run derivation | Room wall owner derives authored wall-run groups with explicit geometric marker coordinates and without merging contiguous boundary segments that have different edge directions. Persisted boundary records, hit-index behavior, drag behavior, and map-level publication remain outside this local row and require the owning editor `DE-*` proof. |

## References

- [Dungeon Feature Docs](../README.md)
- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
