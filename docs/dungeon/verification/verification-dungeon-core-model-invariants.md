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
model-only proof grows enough to justify that surface. Each row must include:

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

## Component Invariants

| ID | OwnerSuite | Scope | Expected invariant |
| --- | --- | --- | --- |
| `DGI-CMP-001` | `DungeonComponentInvariantHarness` | `core/model/component/StairExit` | Stair exits keep local id, position, and label invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |
| `DGI-CMP-002` | `DungeonComponentInvariantHarness` | `core/model/component/CorridorAnchor` | Corridor anchors keep local id, host corridor id normalization, position, relocation, and position-match invariants; missing positions are rejected by core while legacy defaults remain in transitional adapters. |

## References

- [Dungeon Editor Tool Behavior Verification Catalog](verification-dungeon-editor-tool-behavior.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
