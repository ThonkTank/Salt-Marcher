Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-28
Source of Truth: Dungeon persistence boundary, stored truth, adapter mapping
rules, and schema ownership.

# Dungeon Persistence Contract

## Purpose

This contract defines what crosses between the dungeon domain and its data
adapters.

Owners:

- provider: dungeon domain outbound repositories and searches
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
- multi-map authored repository writes MUST commit all supplied domain maps
  together or roll back all supplied domain maps together; adapters persist
  only the supplied domain maps and do not infer additional authored maps
- SQLite rows MUST NOT become the owner of topology behavior, semantic repair
  policy, preview logic, or travel semantics

## Schema Ownership

- `src/data/dungeon/model/DungeonPersistenceSchema.java` is the in-code schema
  declaration
- `dungeon_topology_elements` is authoritative for persisted topology identity
- legacy-compatible detail tables remain source-local storage and correlation
  detail, not alternate semantic owners

## Room Boundary Edge Semantics

`dungeon_room_cluster_edges` stores authored boundary overrides for keyed room
cluster edges:

- no row means the edge is un-authored; room perimeter walls may be derived from
  room cells
- `edge_type='WALL'` means an authored renderable wall edge
- `edge_type='DOOR'` means an authored renderable door edge
- `edge_type='OPEN'` means an authored negative perimeter override that
  suppresses derived wall publication for that keyed edge

`OPEN` rows MUST have no topology element identity and MUST NOT create
`dungeon_topology_elements` rows. Adapter reads and writes MUST preserve
`OPEN` rows as authored persistence truth, while published map and render
surfaces emit no boundary primitive for them.

## Stair Stored Geometry Semantics

`dungeon_stairs` stores the scalar stair geometry spec:

- `shape` stores the domain stair shape name
- `direction` stores the cardinal direction code: `0=NORTH`, `1=EAST`,
  `2=SOUTH`, `3=WEST`
- `dimension1` and `dimension2` store the requirements-owned shape parameters
- `corridor_id` stores the optional owning corridor binding for generated
  cross-level corridor stair segments

`dungeon_stair_path_nodes` stores the committed path produced by the dungeon
domain recompute, ordered by `sort_order`. `dungeon_stair_exits` stores the
committed generated exits and labels for the same stair. These rows are
persisted authored geometry facts, but their meaning is owned by the dungeon
domain model rather than by adapter-local recompute logic.

SQLite adapters MUST persist the domain-provided stair spec, path nodes, exits,
and corridor binding as one stair record graph. They MUST NOT infer missing path
nodes, generate exits, choose labels, or repair corridor bindings during read or
write. Malformed stair rows, unsupported scalar combinations, missing generated
path or exit rows for a readable stair, or dangling corridor bindings are
boundary errors for the domain/repository result, not view-layer behavior.

Legacy `LADDER` and `RECTANGULAR` shape rows remain readable compatibility
inputs. New editor-authored stair creation is governed by the requirements-owned
visible shapes and must not require a schema change to avoid those legacy enum
values.

## Validation And Error Behavior

- authored persistence writes MUST reject incomplete identity, topology, or
  semantic-binding payloads instead of synthesizing replacement authored truth
- adapter reads MUST distinguish absent authored state, malformed source rows,
  and storage failures in the dungeon domain boundary instead of leaking raw
  SQLite failures to the view layer
- preview state, render structures, and other explicit non-persisted truth MUST
  be rejected from authored write payloads
- stair persistence writes MUST reject a stair record graph whose scalar spec,
  path nodes, exits, or corridor binding is incomplete for the domain-authored
  stair being saved

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
