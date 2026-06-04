Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-04
Source of Truth: Target invariant catalog for Dungeon Door ownership proof.

# Dungeon Door Invariants

## Purpose

This catalog defines target model-invariant proof obligations for authored
Dungeon door ownership. Door behavior may use a bounded collection or index
when the invariant is multi-door or cross-component, but generic managers are
not target owners.

Door proof supplements Dungeon Editor real-route proof. A row is `Qualified`
only when a named harness row proves the stated invariant; until then it is a
target obligation for the migration agent.

`Required Proof` names the eventual focused Door family harness or OwnerSuite
row. This catalog does not create a new public gate; until such a gate is
explicitly added, proof may publish through the current aggregated dungeon
model or editor harness surface.

## Review Frame

This catalog is a target-model change derived from the Dungeon domain target
state and this catalog's candidate source-obligation rows. Reviewers must
evaluate whether the Door owner is coherent, traceable, and safely migratable.
Do not block a row merely because current code keeps behavior split across
boundary, corridor, topology, or `worldspace` structure.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=DoorInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Door
family proof owner.

## Door Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. `Partial mechanics proof` means an existing row proves related
mechanics, while the target family owner remains unqualified.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-DOOR-001` | `Door` | Door is an authored component with stable local facts. | A door owns its boundary location, room/cluster relation, stable authored identity, and wall-facing direction as one local component state. | Harness proves construction rejects missing location/direction and preserves valid identity and boundary facts. | Target | Global topology allocation. |
| `DGI-DOOR-002` | Door bounded collection or index | Door lookup and uniqueness are collection-wide invariants. | A boundary location maps to at most one door and one stable topology identity inside the map/cluster scope. | Harness proves duplicate insertion normalizes or rejects and lookup by boundary returns the same door identity. | Target | Persistence key shape. |
| `DGI-DOOR-003` | Door owner with Wall owner collaboration | Door materialization is not room-structure policy. | Door creation consumes wall/floor facts and replaces eligible wall boundary state; invalid edges and existing doors are no-ops. | Harness proves single-room and split-room materialization eligibility plus existing-door rejection. | Partial mechanics proof by current `DGI-STR-008`; target door owner unqualified. | Real View route remains `DE-DOOR-*`. |
| `DGI-DOOR-004` | Door owner with Corridor path owner collaboration | Corridor-bound doors are protected authored endpoints. | Door deletion is rejected when corridor/path bindings still reference the door; unbound deletion reverts the boundary to wall state. | Harness proves protected delete and unbound restore through door owner APIs. | Target | Full corridor reroute behavior. |
| `DGI-DOOR-005` | Door owner with `DungeonMap` topology coordination | Door identity remains map-stable. | Door operations preserve stable topology identity where the door survives and release it only when the door is removed. | Harness proves create, update, protected reject, and delete identity behavior. | Target | Topology graph migration. |

## References

- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
- [Dungeon Editor Selection, Room, Wall, And Door Matrix](verification-dungeon-editor-selection-room-wall-door.md)
