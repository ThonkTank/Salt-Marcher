Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
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
- [Wall invariants](verification-dungeon-wall-invariants.md)
- [Path invariants](verification-dungeon-path-invariants.md)
- [Door invariants](verification-dungeon-door-invariants.md)
- [Transition invariants](verification-dungeon-transition-invariants.md)

## Proof Model

Model invariant rows are grouped by the package-level
`DungeonCoreModelInvariantHarness` entrypoint and are still published through
the existing `dungeonEditorBehaviorHarness` public Gradle aggregator. This
document does not introduce a new public Gradle gate; the focused entrypoint is
an internal harness concern route used by the aggregator. Each published harness
summary row must include:

- `OwnerSuite`
- `ProofType=ModelInvariant`
- an invariant id

Model invariant rows use `Qualified` for proved invariant rows. They do not
use the editor behavior catalog's `Ready` route status vocabulary.

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
| `DGI-CMP-001` | `DungeonComponentInvariantHarness` | `core/component/StairExit` | Stair exits keep local id, position, and label invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |
| `DGI-CMP-002` | `DungeonComponentInvariantHarness` | `core/component/CorridorAnchor` | Corridor anchors keep local id, host corridor id normalization, position, relocation, and position-match invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |
| `DGI-CMP-003` | `DungeonComponentInvariantHarness` | `core/component/CorridorDoorBinding`, `CorridorWaypoint`, `CorridorAnchorRef` | Corridor binding components keep local door, waypoint, and anchor-reference values plus transitional adapter compatibility. Topology refs remain transitional adapter identity until the structure or graph owner is migrated. |

## Qualified Structure Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-STR-001` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoomSet`, `CorridorBindings`, `CorridorResolvedEndpoint`, `CorridorAnchorSnap`, `CorridorHostCells`, `CorridorAnchorEndpointMaterialization` | Corridor structure owns room-set normalization/removal, binding container rules, resolved endpoint shape, and door removal by room. Resolved door endpoints reject missing room ids, reject anchor semantics, and expose their core door binding; resolved anchor endpoints reject room ids and stable-door semantics. Corridor structure also owns anchor binding/ref replacement by local anchor id, anchor snapping to the nearest host cell with level/row/column tie-breaks and fallback behavior, host-cell lookup by corridor id, anchor endpoint creation/reuse by preferred local id or snapped position, and target-local waypoint or anchor-ref removal. Topology-ref identity, persistence/readback, map-level route repair/deletion, and runtime graph ownership remain outside this model-invariant row and require RealRoute `DE-*` proof or future core topology/graph proof. |
| `DGI-STR-002` | `DungeonStructureInvariantHarness` | transitional `worldspace/DungeonCorridorBindings` adapter compatibility | Transitional corridor bindings adapter preserves topology-ref identity for anchor binding/ref replacement and surviving door bindings after door removal while topology ownership remains outside core structure until a future topology/graph owner migration. |
| `DGI-STR-003` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoutePlan` plus transitional `worldspace/DungeonCorridorBindings` adapter compatibility | Corridor structure owns interior route-anchor selection and waypoint planning for route splits. The transitional adapter preserves selected anchor topology refs when publishing the core-planned anchor refs back through `worldspace`. |
| `DGI-STR-004` | `DungeonStructureInvariantHarness` | `core/structure/Corridor` plus transitional `worldspace/DungeonCorridor` adapter compatibility | Corridor structure owns target-local door, anchor, and waypoint delete behavior, including room removal, route-waypoint pruning, anchor-ref removal, and waypoint removal. The transitional adapter preserves surviving topology refs while topology ownership remains outside core structure. |
| `DGI-STR-005` | `DungeonStructureInvariantHarness` | `core/structure/CorridorNetwork` plus transitional `worldspace/DungeonCorridorConnectionNormalizationLogic.pruneDetachedAnchors` adapter compatibility | Corridor network owns protected whole-corridor delete and detached-anchor pruning across authored corridors. The transitional adapter projects stable topology refs into core anchor identity for this behavior and preserves topology refs when publishing pruned corridor bindings back through `worldspace`. |
| `DGI-STR-006` | `DungeonStructureInvariantHarness` | `core/structure/Stair`, `StairGeometrySpec`, `StairShape` | Stair structure owns editor shape support, editor dimension bounds and normalization, generated path/exits, existing exit-id preservation, readability, occupied cells, handle movement, corridor-bound construction, and pure room-interior geometry predicates. Worldspace remains transitional adapter/materialization glue. |
| `DGI-STR-007` | `DungeonStructureInvariantHarness` | `core/structure/transition/Transition`, `TransitionCatalog`, and `TransitionDestination` | Transition structure keeps aggregate-level transition mechanics backed by core transition objects while Transition owner proof owns local transition facts, transition-link behavior, and protected delete policy in `DGI-TRANSITION-001`, `DGI-TRANSITION-002`, and `DGI-TRANSITION-004`. The structure harness exercises transition delete protection, deletion, destination update, and reverse-link cleanup through core `TransitionCatalog` and `TransitionDestination` directly after deletion of the transitional `worldspace/DungeonTransition` adapter. Map-level materialization and persistence remain outside this invariant row until later integration slices. |
| `DGI-STR-008` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterDoorBoundaryMaterialization` compatibility route delegating to Door owner support | Room structure keeps the legacy door-boundary materialization entrypoint as compatibility glue while Door owner proof owns door local facts, local boundary lookup, materialization eligibility, protected delete rejection, and restored wall boundary state in `DGI-DOOR-001`, `DGI-DOOR-002`, `DGI-DOOR-003`, and `DGI-DOOR-004`. Topology-ref identity, persisted boundary rows, partition rebuild, replacement application, and full corridor reroute behavior remain outside this invariant row until later integration slices. |
| `DGI-STR-009` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryMaterialization` compatibility route delegating to `RoomClusterWallMap` support | Room structure keeps the legacy boundary-row materialization entrypoint as compatibility glue while Wall owner proof owns wall/open boundary materialization policy in `DGI-WALL-003`. The compatibility route preserves cluster-cell, center-relative cell, edge direction, and requested boundary-kind behavior for existing callers. Topology-ref identity, persisted boundary maps, partition rebuild, transitional adapter compatibility, and corridor-bound delete protection remain in `worldspace` until later room/topology migration slices. |
| `DGI-STR-010` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterRoomPartition` | Room structure owns closed-boundary partitioning of cluster cells into rooms, reuse of existing room ids by floor anchor, allocation of ids for new split-room components, and boundary-aware room-cell assignment. Worldspace remains transitional adapter glue for persisted boundary rows, narration, topology-ref identity, and map-level rebuild until later room/topology migration slices. |
| `DGI-STR-011` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryOrdering`, `core/geometry/EdgeKey`, plus transitional `worldspace/DungeonBoundaryKey` adapter compatibility | Room structure keeps persisted boundary-row sorting and level grouping as compatibility routing while Wall owner proof owns wall-row normalization in `DGI-WALL-002`. Geometry owns normalized edge-key identity and positive stable ids. The transitional worldspace boundary-key adapter delegates stable-id calculation to core geometry. Worldspace remains transitional adapter glue for topology-ref preservation, persisted boundary record publication, boundary edit transactions, partition rebuild, and corridor-bound door-delete protection until later room/topology migration slices. |
| `DGI-STR-012` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryStretchPlan` compatibility route delegated from `RoomClusterWallMap` | Room structure keeps the legacy stretch-plan mechanics as compatibility support while Wall owner proof owns wall-map stretch behavior in `DGI-WALL-004`. The compatibility route preserves orientation, contiguous source-edge selection, outward-side detection, movement-normal validation, moved strip-cell derivation, boundary vertices, connector-path derivation, and source edge-key identity for existing callers. Worldspace remains transitional adapter glue for persisted boundary records, topology-ref preservation, corridor-bound boundary protection, boundary mutation transactions, partition rebuild, and map-level publication until later room/topology migration slices. |

## References

- [Dungeon Editor Tool Behavior Verification Catalog](verification-dungeon-editor-tool-behavior.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
