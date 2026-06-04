Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Target invariant catalog for Dungeon Floor ownership proof.

# Dungeon Floor Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon floor ownership. It intentionally describes the desired component-owner
model, not only the current room-structure implementation.

Floor proof supplements Dungeon Editor real-route proof. A row is `Qualified`
only when a named harness row proves the stated invariant; until then it is a
target obligation for the migration agent.

`Required Proof` names the eventual focused Floor family harness or OwnerSuite
row. This catalog does not create a new public gate; until such a gate is
explicitly added, proof may publish through the current aggregated dungeon
model or editor harness surface.

## Review Frame

This catalog is a target-model change derived from the Dungeon domain target
state and this catalog's candidate source-obligation rows. Reviewers must
evaluate whether the Floor owner is coherent, traceable, and safely migratable.
Do not block a row merely because current code keeps the behavior under room
structure or `worldspace`.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=FloorInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Floor
family proof owner.

## Floor Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-FLOOR-001` | `RoomClusterFloorMap` or equivalent structure-local floor owner | Room clusters compose one floor owner inside the `DungeonMap` aggregate boundary. | A room cluster has one authoritative floor-cell map per structure scope; structures do not separately own raw floor cells after migration. | Model-invariant OwnerSuite creates a multi-level cluster floor map and proves structure access goes through the floor owner. | Qualified by `OwnerSuite=FloorInvariantHarness`. | Level-wide projected maps. |
| `DGI-FLOOR-002` | Floor owner | Authored floor cells must be stable, unique, and grouped by level. | Floor cells reject nulls, deduplicate by `Cell`, preserve level grouping, and expose deterministic ordering. | Harness proves duplicate and unordered cell input normalizes to one deterministic level-grouped surface. | Qualified by `OwnerSuite=FloorInvariantHarness`. | Persistence row ordering. |
| `DGI-FLOOR-003` | Floor owner | Room membership is derived from floor ownership and closed boundaries. | Room-cell assignment uses floor cells plus wall/boundary facts, not a second raw-cell owner. | Harness proves a split cluster assigns each floor-owned cell to exactly one room through the cluster floor owner. | Qualified by `OwnerSuite=FloorInvariantHarness`. | Out-of-floor anchor rejection and wall-map boundary ownership proof. |
| `DGI-FLOOR-004` | Floor owner | Floor anchors identify room floors across levels. | Floor anchors are derived from owned floor cells, one anchor per room level, with deterministic reuse when a room survives repartition. | Harness proves anchor derivation, surviving-room anchor reuse, and deterministic split-component allocation. | Qualified by `OwnerSuite=FloorInvariantHarness`. | Narration and persistence identity. |
| `DGI-FLOOR-005` | Floor owner with `DungeonMap` coordination | `DungeonMap` remains transaction boundary while floor behavior is local. | Floor mutation returns a new owned floor state plus explicit change/no-change result; `DungeonMap` applies revision and publication policy. | Harness proves no-op floor operations do not report mutation and valid operations produce a changed floor owner. | Qualified by `OwnerSuite=FloorInvariantHarness`. | Repository save and publication. |
| `DGI-FLOOR-006` | Dungeon-level floor projection | Later level-wide floor maps are projections, not write owners. | A `DungeonLevel` floor map, if introduced, is derived from structure-owned floor maps and cannot mutate authored floor truth directly. | Harness or projection proof builds a level floor map from multiple clusters and proves mutation attempts route back through owning structures. | Target | Runtime render caches. |

## References

- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
