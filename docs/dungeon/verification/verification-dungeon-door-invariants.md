Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-16
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
boundary, corridor, topology, or aggregate structure.

## Proof Vocabulary

Required proof rows for this catalog must publish
`OwnerSuite=DoorInvariantHarness`, `ProofType=ModelInvariant`, and the
invariant id. If the first implementation routes proof through the existing
aggregated dungeon harness surface, those fields still identify the Door
family proof owner. The topology identity row may instead publish
`OwnerSuite=TopologyInvariantHarness` because it proves Door identity through
the `DungeonMap` topology coordination surface.

## Door Invariant Catalog

`Candidate Source Obligation` entries derive from the Dungeon domain target
state and current proof index. They are migration obligations, not independent
domain truth. All active rows below are qualified by the named OwnerSuite.

| Invariant ID | Target Owner | Candidate Source Obligation | Invariant | Required Proof | Current Status | Deferred/Out Of Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `DGI-DOOR-001` | `Door` | Door is an authored component with stable local facts. | A door owns its boundary location, room/cluster relation, stable authored identity, and wall-facing direction as one local component state. | Harness proves construction rejects missing location/direction and preserves valid identity and boundary facts. | Qualified by `OwnerSuite=DoorInvariantHarness`. | Global topology allocation. |
| `DGI-DOOR-002` | Door bounded collection or index | Door lookup and uniqueness are collection-wide invariants. | A boundary location maps to at most one local door identity inside the cluster scope. | Harness proves duplicate insertion normalizes or rejects and lookup by boundary returns the same local door identity. | Qualified by `OwnerSuite=DoorInvariantHarness`. | Persistence key shape and stable topology identity. |
| `DGI-DOOR-003` | Door owner with Wall owner collaboration | Door materialization is not room-structure policy. | Door materialization consumes wall/floor facts to decide eligible door creation; invalid edges and existing doors are no-ops. | Harness proves single-room and split-room materialization eligibility plus existing-door rejection. | Qualified by `OwnerSuite=DoorInvariantHarness`. | Real View replacement route remains `DE-DOOR-*`. |
| `DGI-DOOR-004` | Door owner with Corridor path owner collaboration | Corridor-bound doors are protected authored endpoints. | Door deletion is rejected when corridor/path bindings still reference the door; for unbound deletes, the Door owner exposes restored wall boundary state for the caller to apply. | Harness proves protected delete rejection, unbound removal, and restored wall boundary state through door owner APIs. | Qualified by `OwnerSuite=DoorInvariantHarness`. | Full corridor reroute behavior. |
| `DGI-DOOR-005` | Door owner with `DungeonMap` topology coordination | Door identity remains map-stable. | Door operations preserve stable topology identity where the door survives and release it only when the door is removed. | Harness proves create, update, protected reject, and delete identity behavior. | Qualified by `OwnerSuite=TopologyInvariantHarness`. | Topology graph migration. |
| `DGI-DOOR-006` | Door owner with Corridor path owner and Room boundary owner collaboration | Door binding movement is atomic across corridor endpoint and room boundary facts. | Moving a corridor-bound door applies the corridor endpoint and authored room boundary together, or rejects unchanged/ineligible movement without partial state. | Harness proves corridor-bound door movement applies endpoint and room-boundary movement together and rejects unchanged movement. | Qualified by `OwnerSuite=DoorInvariantHarness`. | Richer aggregate topology replacement API. |

## References

- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
