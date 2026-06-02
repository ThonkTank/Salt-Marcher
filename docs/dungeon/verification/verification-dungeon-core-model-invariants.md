Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-01
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
| `DGI-GEO-001` | `DungeonGeometryInvariantHarness` | `core/model/geometry/Direction` and `Cell` | Direction neighbor deltas preserve cell level and cardinal offsets. |
| `DGI-GEO-002` | `DungeonGeometryInvariantHarness` | `core/model/geometry/Edge` | `Edge.sideOf` and `touchingCells` return the two authored cells adjacent to each cardinal side and reject non-orthogonal edge adjacency. |
| `DGI-GEO-003` | `DungeonGeometryInvariantHarness` | `core/model/geometry/CellOrdering` | Cell ordering deduplicates cells and orders by level, row, then column. |
| `DGI-GEO-004` | `DungeonGeometryInvariantHarness` | `core/model/geometry/Route` | Route creates horizontal-first corridor cells and owns the explicit policy difference between level-transition paths and validation paths that stay on the start level. |

## Component Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-CMP-001` | `DungeonComponentInvariantHarness` | `core/model/component/StairExit` | Stair exits keep local id, position, and label invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |
| `DGI-CMP-002` | `DungeonComponentInvariantHarness` | `core/model/component/CorridorAnchor` | Corridor anchors keep local id, host corridor id normalization, position, relocation, and position-match invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |
| `DGI-CMP-003` | `DungeonComponentInvariantHarness` | `core/model/component/CorridorDoorBinding`, `CorridorWaypoint`, `CorridorAnchorRef` | Corridor binding components keep local door, waypoint, and anchor-reference values plus transitional adapter compatibility. Topology refs remain transitional adapter identity until the structure or graph owner is migrated. |

## Structure Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-STR-001` | `DungeonStructureInvariantHarness` | `core/model/structure/CorridorRoomSet`, `CorridorBindings` | Corridor structure owns room-set normalization/removal, binding container rules, door removal by room, anchor binding/ref replacement by local anchor id, and target-local waypoint or anchor-ref removal. Topology-ref identity, persistence/readback, map-level route repair/deletion, and runtime graph ownership remain outside this model-invariant row and require RealRoute `DE-*` proof or future core topology/graph proof. |
| `DGI-STR-002` | `DungeonStructureInvariantHarness` | transitional `worldspace/model/DungeonCorridorBindings` adapter compatibility | Transitional corridor bindings adapter preserves topology-ref identity for anchor binding/ref replacement and surviving door bindings after door removal while topology ownership remains outside core structure until a future topology/graph owner migration. |
| `DGI-STR-003` | `DungeonStructureInvariantHarness` | `core/model/structure/CorridorRoutePlan` plus transitional `worldspace/model/DungeonCorridorBindings` adapter compatibility | Corridor structure owns interior route-anchor selection and waypoint planning for route splits. The transitional adapter preserves selected anchor topology refs when publishing the core-planned anchor refs back through `worldspace`. |

## References

- [Dungeon Editor Tool Behavior Verification Catalog](verification-dungeon-editor-tool-behavior.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
