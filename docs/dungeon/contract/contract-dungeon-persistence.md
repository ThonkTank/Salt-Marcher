Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Dungeon persistence boundary, stored truth, adapter mapping
rules, and schema ownership.

# Dungeon Persistence Contract

## Purpose

This contract defines what crosses between the dungeon domain and its data
adapters.

Owners:

- provider: dungeon domain outbound ports
- consumers: dungeon SQLite adapters

It owns stored truth, adapter boundaries, schema ownership, and stability
rules. It does not own dungeon behavior requirements or shared canvas
contracts.

## Persisted Truth

Persisted authored truth includes:

- map identity and revision
- authored map metadata
- authored topology-backed geometry
- stable topology identity and semantic bindings
- authored room, connection, stair, and transition facts
- authored room narration

## Explicit Non-Persisted Truth

- derived area, relation, and traversal facts
- preview state
- render or hit structures
- ViewModel-local selection state
- party-owned runtime travel state

## Adapter Boundary

- `DungeonMapRepository` owns authored write-model persistence
- `DungeonMapSearch` owns read-oriented map lookup
- SQLite adapters translate source-local rows into dungeon-domain values and
  aggregates
- SQLite rows MUST NOT become the owner of topology behavior, semantic repair
  policy, preview logic, or travel semantics

## Schema Ownership

- `src/data/dungeon/model/DungeonPersistenceSchema.java` is the in-code schema
  declaration
- `dungeon_topology_elements` is authoritative for persisted topology identity
- legacy-compatible detail tables remain source-local storage and correlation
  detail, not alternate semantic owners

## Validation And Error Behavior

- authored persistence writes MUST reject incomplete identity, topology, or
  semantic-binding payloads instead of synthesizing replacement authored truth
- adapter reads MUST distinguish absent authored state, malformed source rows,
  and storage failures in the dungeon domain boundary instead of leaking raw
  SQLite failures to the view layer
- preview state, render structures, and other explicit non-persisted truth MUST
  be rejected from authored write payloads

## Migration And Stability Rules

- new fields belong in source-local records first, then map into domain-owned
  values
- additive compatibility migrations remain allowed where needed for legacy
  dungeon databases
- direct runtime token movement does not justify new authored-position tables;
  runtime party position remains owned outside dungeon persistence

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields for preview state, render state, or other
  derived runtime state.
- Review must reject adapter code that becomes the owner of topology repair or
  semantic behavior.

## References

- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/domain/domain-dungeon.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Maps Feature Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/README.md:1)
