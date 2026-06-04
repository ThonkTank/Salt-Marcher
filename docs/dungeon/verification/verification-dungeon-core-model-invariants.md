Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Core Dungeon model invariant proof rows that supplement Dungeon Editor real-route behavior proof.

# Dungeon Core Model Invariants

This document owns model-only invariant proof rows for Dungeon Core objects.
These rows supplement real-route `DE-*` behavior proof and never close a
catalog `Ready` behavior row by themselves.

## Proof Model

Model invariant rows are published through the existing
`dungeonEditorBehaviorHarness` aggregator until a separate core-model proof
entrypoint is requested. This document does not introduce a new public Gradle
gate; a dedicated core-model proof entrypoint is a future decision for when
model-only proof grows enough to justify that surface. Each published harness
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

## Structure Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-STR-001` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoomSet`, `CorridorBindings`, `CorridorResolvedEndpoint`, `CorridorAnchorSnap`, `CorridorHostCells`, `CorridorAnchorEndpointMaterialization` | Corridor structure owns room-set normalization/removal, binding container rules, resolved endpoint shape, and door removal by room. Resolved door endpoints reject missing room ids, reject anchor semantics, and expose their core door binding; resolved anchor endpoints reject room ids and stable-door semantics. Corridor structure also owns anchor binding/ref replacement by local anchor id, anchor snapping to the nearest host cell with level/row/column tie-breaks and fallback behavior, host-cell lookup by corridor id, anchor endpoint creation/reuse by preferred local id or snapped position, and target-local waypoint or anchor-ref removal. Topology-ref identity, persistence/readback, map-level route repair/deletion, and runtime graph ownership remain outside this model-invariant row and require RealRoute `DE-*` proof or future core topology/graph proof. |
| `DGI-STR-002` | `DungeonStructureInvariantHarness` | transitional `worldspace/DungeonCorridorBindings` adapter compatibility | Transitional corridor bindings adapter preserves topology-ref identity for anchor binding/ref replacement and surviving door bindings after door removal while topology ownership remains outside core structure until a future topology/graph owner migration. |
| `DGI-STR-003` | `DungeonStructureInvariantHarness` | `core/structure/CorridorRoutePlan` plus transitional `worldspace/DungeonCorridorBindings` adapter compatibility | Corridor structure owns interior route-anchor selection and waypoint planning for route splits. The transitional adapter preserves selected anchor topology refs when publishing the core-planned anchor refs back through `worldspace`. |
| `DGI-STR-004` | `DungeonStructureInvariantHarness` | `core/structure/Corridor` plus transitional `worldspace/DungeonCorridor` adapter compatibility | Corridor structure owns target-local door, anchor, and waypoint delete behavior, including room removal, route-waypoint pruning, anchor-ref removal, and waypoint removal. The transitional adapter preserves surviving topology refs while topology ownership remains outside core structure. |
| `DGI-STR-005` | `DungeonStructureInvariantHarness` | `core/structure/CorridorNetwork` plus transitional `worldspace/DungeonCorridorAnchorPruningRules` adapter compatibility | Corridor network owns protected whole-corridor delete and detached-anchor pruning across authored corridors. The transitional adapter projects stable topology refs into core anchor identity for this behavior and preserves topology refs when publishing pruned corridor bindings back through `worldspace`. |
| `DGI-STR-006` | `DungeonStructureInvariantHarness` | `core/structure/Stair`, `StairGeometrySpec`, `StairShape` | Stair structure owns editor shape support, editor dimension bounds and normalization, generated path/exits, existing exit-id preservation, readability, occupied cells, handle movement, corridor-bound construction, and pure room-interior geometry predicates. Worldspace remains transitional adapter/materialization glue. |
| `DGI-STR-007` | `DungeonStructureInvariantHarness` | `core/structure/Transition`, `TransitionCatalog`, `TransitionDestination` plus transitional `worldspace/DungeonTransition` adapter compatibility | Transition structure owns destination normalization, labels, placed-state, replacement by id, reverse-link cleanup, transition-reference checks, and protected delete policy. The transitional worldspace adapter proves these catalog operations round-trip through core without taking over policy ownership. Map-level materialization and persistence remain outside this invariant row until later integration slices. |
| `DGI-STR-008` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterDoorBoundaryMaterialization` | Room structure owns door-boundary materialization eligibility from room-cell ownership, edge geometry, and existing boundary kind. Single-room edges can materialize a door when the edge is not already a door; split-room edges require an existing non-door boundary; zero-touch and existing-door cases are rejected as no-ops. Topology-ref identity, persisted boundary rows, partition rebuild, and corridor-bound door-delete protection remain in `worldspace` until later room/topology migration slices. |
| `DGI-STR-009` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryMaterialization` | Room structure owns boundary-row materialization from cluster-cell ownership, center-relative cell derivation, edge direction derivation, and requested boundary kind. Perimeter wall and open rows can materialize from core geometry; open rows require exactly one cluster-side touching cell, split-room interior open rows are rejected, and invalid or untouched edges are rejected. Topology-ref identity, persisted boundary maps, partition rebuild, transitional adapter compatibility, and corridor-bound delete protection remain in `worldspace` until later room/topology migration slices. |
| `DGI-STR-010` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterRoomPartition` | Room structure owns closed-boundary partitioning of cluster cells into rooms, reuse of existing room ids by floor anchor, allocation of ids for new split-room components, and boundary-aware room-cell assignment. Worldspace remains transitional adapter glue for persisted boundary rows, narration, topology-ref identity, and map-level rebuild until later room/topology migration slices. |
| `DGI-STR-011` | `DungeonStructureInvariantHarness` | `core/structure/room/RoomClusterBoundaryOrdering`, `core/geometry/EdgeKey`, plus transitional `worldspace/DungeonBoundaryKey` adapter compatibility | Room structure owns persisted boundary-row sorting by level, row, column, and direction name plus sorted level grouping for boundary maps. Geometry owns normalized edge-key identity and positive stable ids. The transitional worldspace boundary-key adapter delegates stable-id calculation to core geometry. Worldspace remains transitional adapter glue for topology-ref preservation, persisted boundary record publication, boundary edit transactions, partition rebuild, and corridor-bound door-delete protection until later room/topology migration slices. |

## References

- [Dungeon Editor Tool Behavior Verification Catalog](verification-dungeon-editor-tool-behavior.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
