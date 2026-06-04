Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Target invariant catalog for Dungeon Wall ownership proof.

# Dungeon Wall Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon wall and boundary ownership. It intentionally describes the desired
component-owner model, not only the current room-structure implementation.

Wall proof supplements Dungeon Editor real-route proof. A row is `Qualified`
only when a named harness row proves the stated invariant; until then it is a
target obligation for the migration agent.

`Required Proof` names the eventual focused Wall family harness or OwnerSuite
row. This catalog does not create a new public gate; until such a gate is
explicitly added, proof may publish through the current aggregated dungeon
model or editor harness surface.

## Review Frame

This catalog is a target-model change derived from the Dungeon domain target
state and this catalog's candidate source-obligation rows. Reviewers must
evaluate whether the Wall owner is coherent, traceable, and safely migratable.
Do not block a row merely because current code keeps the behavior under room
structure or `worldspace`.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=WallInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Wall
family proof owner.

## Wall Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. `Partial mechanics proof` means an existing row proves related
mechanics, while the target family owner remains unqualified.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-WALL-001` | `RoomClusterWallMap` or equivalent structure-local wall owner | Room clusters compose one wall owner inside the `DungeonMap` aggregate boundary. | A room cluster has one authoritative wall/boundary map; structures do not separately own boundary rows after migration. | Model-invariant OwnerSuite builds a cluster with wall, open, and door boundary facts through the wall owner. | Qualified by `OwnerSuite=WallInvariantHarness`. | Level-wide projected maps. |
| `DGI-WALL-002` | Wall owner | Wall rows are edge-based authored boundaries. | Wall entries normalize edge identity, level, direction, and boundary kind deterministically. | Harness proves reversed edge input, duplicate rows, same-edge kind conflicts, and unsorted rows normalize to one deterministic wall map. | Qualified by `OwnerSuite=WallInvariantHarness`. | Topology-ref allocation. |
| `DGI-WALL-003` | Wall owner | Wall materialization is owned with wall state. | Perimeter and interior wall/open materialization uses floor cells and edge geometry and rejects untouched or invalid edges. | Harness proves valid wall/open creation and invalid edge rejection through the compatibility materialization route delegated to Wall owner support. | Qualified by `OwnerSuite=WallInvariantHarness`. | Door-specific replacement rules. |
| `DGI-WALL-004` | Wall owner | Wall stretch edits are wall-map behavior. | Stretch orientation, contiguous source-edge selection, connector paths, moved strip cells, and outward-side rules are computed by the wall owner. | Harness proves stretch selection and connector path derivation from wall map state. | Qualified by `OwnerSuite=WallInvariantHarness`. | Map-level publication. |
| `DGI-WALL-005` | Wall owner with Door owner collaboration | Walls and doors share one boundary surface without duplicate owners. | A boundary location cannot simultaneously be a wall and a door; door insertion/reversion changes the wall map through a bounded door operation. | Harness proves door creation replaces wall state and unbound door deletion restores wall state. | Target | Corridor-bound door protection. |
| `DGI-WALL-006` | Dungeon-level wall projection | Later level-wide wall maps are projections, not write owners. | A `DungeonLevel` wall map, if introduced, is derived from structure-owned wall maps and cannot mutate authored wall truth directly. | Harness or projection proof builds a level wall map from multiple clusters and proves mutation attempts route back through owning structures. | Target | Runtime render caches. |

## References

- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Selection, Room, Wall, And Door Matrix](verification-dungeon-editor-selection-room-wall-door.md)
