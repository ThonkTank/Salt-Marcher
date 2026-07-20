Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
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
- authored room, room-cluster, connection, stair, and transition facts
- authored feature marker facts
- authored room and room-cluster names
- authored room narration

## Explicit Non-Persisted Truth

- derived area, relation, and traversal facts
- preview state
- render or hit structures
- presentation-local selection state
- party-owned runtime travel state

## Adapter Boundary

- `DungeonCatalogStore` owns map metadata lookup and catalog mutations
- `DungeonWindowStore` owns explicit chunk reads and command-specific stable
  identity closure reads
- `DungeonIdentityAllocator` owns atomic typed reservation of bounded stable
  identity ranges for map-wide authored families without writing placeholder
  authored state
- `DungeonUnitOfWork` owns revision-checked `DungeonPatch` and
  `DungeonCompoundPatch` commits
- SQLite adapters translate source-local rows into dungeon-domain values and
  immutable API or application read facts
- multi-map authored patches MUST commit every supplied map change together or
  roll back every supplied map change together; adapters do not infer
  additional authored maps or mutations
- SQLite rows MUST NOT become the owner of topology behavior, semantic repair
  policy, preview logic, or travel semantics

## Schema Ownership

- the feature-owned Dungeon persistence schema declaration is the in-code
  schema owner
- `dungeon_topology_elements` is authoritative for persisted topology identity
- detail tables remain source-local storage and correlation detail, not
  alternate semantic owners

`dungeon_maps.revision` stores the last committed authored revision. Adapters
MUST read and write that value; they MUST NOT replace it with a constant
readback revision.

`dungeon_identity_sequences` is technical allocation state keyed by supported
identity kind. Reserving an identity or bounded contiguous range advances only
its sequence in one short transaction; it MUST NOT create a dummy map,
topology element, authored entity, or child row. Every map-wide stable identity
family that a command can create uses this allocation boundary rather than a
partial-workset maximum. The schema initializes the table directly and does not
derive it from authored Dungeon rows.

`dungeon_chunks` is a source-local spatial inventory keyed by
`(dungeon_map_id, level_z, chunk_q, chunk_r)`. One chunk covers `64 x 64`
cells, and negative coordinates use mathematical floor division. Its content
revision changes only when authored content intersecting that chunk changes.
Chunk rows are indexing metadata, not authored semantic truth.

`dungeon_entity_chunks` indexes map-wide stable entity identity to every chunk
whose stored authored geometry it intersects. Its key contains map id, entity
kind, entity id, level, chunk q, and chunk r. It MUST NOT duplicate an entity's
semantic facts or mint chunk-local entity identity.

`dungeon_corridor_route_cells` is a replaceable source-local read index derived
from the complete authored corridor controls and room geometry. It stores exact
canonical route cells with corridor identity, segment order, cell order, and
their containing chunk solely so explicit-chunk windows can read clipped route
facts without hydrating off-window authored geometry. It MUST be rebuilt or
updated atomically with `dungeon_entity_chunks` and `dungeon_chunks`, MUST NOT
be treated as authored corridor truth, and MUST NOT be repaired independently
of the authored controls that produced it.

## Window Reads And Identity Closure

- a viewport read MUST address explicit chunk keys and return request
  generation, committed map revision, and per-chunk content revisions needed to
  reject late results without invalidating untouched chunks
- a loaded viewport consists of visible chunks plus one surrounding ring
- a window read returns authored facts intersecting the requested chunks plus
  stable entity headers and continuation refs for content outside the window
- command handling loads full command-relevant identity closure explicitly when
  validation cannot be completed from window facts alone
- entities retain map-wide stable identities and MAY cross chunk boundaries;
  an adapter MUST NOT clone identity or semantic facts merely to fit storage
  partitions
- a missing required closure is reported as incomplete input; application or
  adapter code MUST NOT guess at unseen authored truth
- catalog reads MUST NOT hydrate authored map content

## Patch And Compound Writes

- an authored commit MUST validate every expected map revision, write only
  affected authored rows and spatial index rows, and advance each affected map
  revision once in the same transaction
- a patch identifies inserted, updated, and removed stable entities plus every
  touched chunk; it MUST NOT carry complete before and after maps
- a compound patch is one transaction and one user-command outcome even when it
  changes several maps
- affected chunk content revisions advance with their content; untouched chunk
  content revisions remain stable and cacheable
- a failed validation or storage write MUST roll back authored rows, entity
  membership, chunk inventory, chunk revisions, and map revisions together
- successful writes return committed patch result facts; the application MUST
  NOT require an unconditional whole-map readback to discover what it wrote
- preview, hover, camera movement, and undo/redo stacks MUST NOT write SQLite;
  applying an accepted undo or redo patch is a normal authored commit

## Authored Name Storage Semantics

`dungeon_rooms.name` stores the authored room display name. The committed value
is nonblank and already normalized by the domain.

`dungeon_room_clusters.name` stores the authored cluster display name. The
committed value is nonblank and already normalized by the domain.

SQLite adapters MUST persist the domain-provided room and room-cluster names
with the corresponding authored record graph. Adapters do not infer default
names from render state, preview state, or missing source values.

## Room And Cluster Geometry Storage Semantics

`dungeon_room_cells` stores the authored floor cells owned by one stable room
identity. Room id plus cell coordinate is unique. Room anchors and cluster floor
are derived and have no authored storage table.

`dungeon_room_cluster_edges` stores cluster boundary facts. For freshly
authored room creation, the stored perimeter is explicit
`edge_type='WALL'` rows around the union of committed member-room cells. Adapter
reads use room-owned cells plus cluster boundary rows as the only room-cluster
geometry source.

The `level_z`, `cell_x`, and `cell_y` columns identify the absolute authored
boundary cell. They MUST NOT depend on a persisted cluster anchor, center, or
centroid. Any presentation anchor or centroid derives from the ordered union of
member-room cells; adapters translate absolute boundary values only at the
adapter boundary.

`dungeon_room_floors`, `dungeon_room_cluster_floor_cells`, and
`dungeon_room_cluster_vertices` are not part of the schema. Duplicate room or
cluster geometry is not accepted as an alternate persistence representation.

## Room Boundary Edge Semantics

`dungeon_room_cluster_edges` stores authored boundary overrides for keyed room
cluster edges:

- no row means the edge is un-authored; derived perimeter walls from room cells
  are preview or command-planning facts only and are not committed output for
  editor-authored room creation
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

Only requirements-owned editor stair shapes are valid in the schema.
Unsupported shape rows are malformed persistence input.

## Transition Destination Storage Semantics

`dungeon_transitions` stores authored transition facts for one dungeon map:

- `transition_id` stores the stable map-owned transition id
- `dungeon_map_id` stores the owning authored map
- `anchor_type` stores the transition anchor kind: `NONE`, `CELL`, or `EDGE`
- `cell_x`, `cell_y`, and `level_z` store the transition anchor coordinate for
  `CELL` and `EDGE` anchors and are null for `NONE`
- `anchor_edge_direction` stores the cardinal edge direction only for `EDGE`
  anchors
- `destination_type` stores the domain destination type
- destination target columns store only the fields required by that
  destination type
- `description` stores the authored transition description

SQLite adapters MUST preserve these destination row shapes:

- `UNLINKED_ENTRANCE`: all target columns are null. This is a valid authored
  entrance placeholder, not malformed persistence input.
- `OVERWORLD_TILE`: `target_overworld_map_id` and
  `target_overworld_tile_id` are present; `target_dungeon_map_id` and
  `target_transition_id` are null.
- `DUNGEON_MAP`: `target_dungeon_map_id` is present,
  `target_transition_id` is present when the destination names a placed target
  entrance, and the overworld target columns are null.

Runtime travel targets are derived projection/session state. A null runtime
travel target for `UNLINKED_ENTRANCE` is not stored authored truth and MUST NOT
be backfilled into a fake overworld tile or dungeon transition target by the
adapter.

Rows with missing, blank, or null `anchor_type`, inconsistent coordinate fields,
or an edge direction outside an `EDGE` anchor are malformed and reject the
window or identity-closure read. Adapters do not repair them into authored
absence.

## Feature Marker Storage Semantics

`dungeon_feature_markers` stores authored feature marker facts for one dungeon
map:

- `feature_marker_id` stores the stable map-owned marker id
- `dungeon_map_id` stores the owning authored map
- `marker_kind` stores the domain marker kind: `OBJECT`, `ENCOUNTER`, or `POI`
- `cell_x`, `cell_y`, and `level_z` store the anchor cell coordinates
- `label` stores the authored marker label
- `description` stores the authored marker description

SQLite adapters MUST map these rows into domain-owned `FeatureMarker` values and
persist marker inserts, updates, or removals named by a patch. The table is
source-local storage only; it MUST NOT own marker defaults, marker validation,
encounter/object foreign-key semantics, preview state, render state, or travel
behavior.

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
- feature marker persistence writes MUST reject incomplete marker identity,
  kind, anchor, label, or description payloads instead of storing preview or
  render-derived substitutes

## Schema Stability Rules

- new fields belong in source-local records first, then map into domain-owned
  values
- the canonical schema uses the room-cell, boundary, entity-membership,
  chunk-revision, and patch representations defined by this contract; alternate
  whole-record, fixed-bounds, or enum-compatibility representations are not
  accepted
- direct runtime token movement does not justify new authored-position tables;
  runtime party position remains owned outside dungeon persistence
- Dungeon schema changes MUST NOT modify Party, Hex, or other feature rows


## References

- [Dungeon Domain Model](../domain/domain-dungeon.md) (line 1)
- [Dungeon Map Surface Contract](../../maps/contract/contract-maps-dungeon-surface.md) (line 1)
- [Map Canvas Overview](../../maps/README.md) (line 1)
