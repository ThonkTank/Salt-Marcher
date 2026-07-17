Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
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

- one feature-owned application port owns authored write-model persistence
- one feature-owned application port owns read-oriented map lookup
- SQLite adapters translate source-local rows into dungeon-domain values and
  aggregates
- multi-map authored repository writes MUST commit all supplied domain maps
  together or roll back all supplied domain maps together; adapters persist
  only the supplied domain maps and do not infer additional authored maps
- SQLite rows MUST NOT become the owner of topology behavior, semantic repair
  policy, preview logic, or travel semantics

## Schema Ownership

- the feature-owned Dungeon persistence schema declaration is the in-code
  schema owner
- `dungeon_topology_elements` is authoritative for persisted topology identity
- compatibility detail tables remain source-local storage and correlation
  detail, not alternate semantic owners

`dungeon_maps.revision` stores the last committed authored revision. Adapters
MUST read and write that value; they MUST NOT replace it with a constant
readback revision.

`dungeon_chunks` is a source-local spatial inventory keyed by
`(dungeon_map_id, level_z, chunk_q, chunk_r)`. One chunk covers `64 x 64`
cells, and negative coordinates use mathematical floor division. The row's
`revision` identifies the authored map revision from which that inventory entry
was derived. Chunk rows are indexing metadata, not authored semantic truth.

## Window Reads And Incremental Writes

- a viewport read MUST address explicit chunk keys and return the request
  generation plus committed map revision needed to reject late results
- a loaded viewport consists of visible chunks plus one surrounding ring
- entities retain map-wide stable identities and MAY cross chunk boundaries;
  an adapter MUST NOT clone identity merely to fit storage partitions
- an authored commit MUST validate the expected map revision, write only
  affected authored rows and chunk inventory, and advance the map revision once
  in the same transaction
- a failed validation or storage write MUST roll back authored rows, chunk
  inventory, and map revision together
- successful writes return the committed change result; the application MUST
  NOT require an unconditional whole-map readback to discover what it wrote
- preview, hover, camera movement, and undo/redo stacks MUST NOT write SQLite

Ordinary single-map commands use the incremental before/after port. Initial map
creation and the remaining multi-map transition-link write still use one
whole-record compatibility route. Its owner and deletion milestone live in the
temporary Dungeon delivery note; it is not an alternative target.

## Authored Name Storage Semantics

`dungeon_rooms.name` stores the authored room display name. Blank or missing
source values are compatibility inputs that the domain normalizes to
`Raum <roomId>` on readback and publication.

`dungeon_room_clusters.name` stores the authored cluster display name. Current
schema readiness requires the column to exist. Blank source values remain
compatibility inputs that the domain normalizes to `Cluster <clusterId>` on
readback and publication.

SQLite adapters MUST persist the domain-provided room and room-cluster names
with the corresponding authored record graph. Default display names are
compatibility and publication semantics, not separate stored authored truth that
adapters may infer from render state or preview state.

## Room And Cluster Geometry Storage Semantics

`dungeon_room_floors` remains room-anchor storage. It stores persisted
room-floor anchor facts needed to correlate room identity across levels and
readback, but it is not the cluster floor-cell owner.

`dungeon_room_cluster_floor_cells` stores cluster floor cells. For freshly
authored room creation, adapters MUST persist the domain-provided cluster floor
cell set and read it back as the stored floor-cell truth for the retained
cluster. The table stores source-local rows for domain-owned floor facts; it
does not own room-membership policy.

`dungeon_room_cluster_edges` stores cluster boundary facts. For freshly
authored room creation, the target stored perimeter is explicit
`edge_type='WALL'` rows around the committed cluster floor-cell set. Current
adapter reads use persisted floor cells plus boundary rows as the only
room-cluster geometry source.

The retired `dungeon_room_cluster_vertices` table is historical legacy input
only. Current schema creation, adapter reads, and adapter writes MUST NOT create,
load, write, or clean up vertex rows as a supported room-cluster geometry path.
Local databases that still contain only vertex geometry without
`dungeon_room_cluster_floor_cells` and `dungeon_room_cluster_edges` rows require
manual data cleanup before they can be loaded as current authored maps.

## Room Boundary Edge Semantics

`dungeon_room_cluster_edges` stores authored boundary overrides for keyed room
cluster edges:

- no row means the edge is un-authored; derived perimeter walls from room cells
  are legacy compatibility input only and are not the target output for fresh
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

Previously persisted `LADDER` and `RECTANGULAR` shape rows remain readable compatibility
inputs. New editor-authored stair creation is governed by the requirements-owned
visible shapes and must not require a schema change to avoid those older enum
values.

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

Rows with missing or null `anchor_type` are compatibility input: adapters derive
`CELL` when the coordinate columns are present and `NONE` when they are absent.
Rows with missing, blank, or null `anchor_type` and a non-null
`anchor_edge_direction` are malformed and must reject reload instead of being
repaired into authored absence. The compatibility derivation is source-local
mapping behavior and must not reintroduce nullable-cell transition placement as
a domain owner.

## Feature Marker Storage Semantics

`dungeon_feature_markers` stores authored feature marker facts for one dungeon
map:

- `feature_marker_id` stores the stable map-owned marker id
- `dungeon_map_id` stores the owning authored map
- `marker_kind` stores the domain marker kind: `OBJECT`, `ENCOUNTER`, or `POI`
- `cell_x`, `cell_y`, and `level_z` store the anchor cell coordinates
- `label` stores the authored marker label
- `description` stores the authored marker description

SQLite adapters MUST map these rows into the domain-owned
`FeatureMarkerCatalog` and MUST persist the domain-provided catalog back to the
same table. Obsolete marker rows for the saved map MUST be removed when a save
omits their ids. The table is source-local storage only; it MUST NOT own marker
defaults, marker validation, encounter/object foreign-key semantics, preview
state, render state, or travel behavior.

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

## Migration And Stability Rules

- new fields belong in source-local records first, then map into domain-owned
  values
- schema readiness creates the current table set and may run current topology
  and boundary topology backfills for installed current-schema databases
- old-install upgrades for `dungeon_structure_levels`,
  `dungeon_room_clusters.structure_object_id`, transition stair-anchor columns,
  and broad additive ALTER lists are retired; databases that still require
  those paths need explicit data cleanup or owner-approved repair before
  they are treated as supported authored maps
- direct runtime token movement does not justify new authored-position tables;
  runtime party position remains owned outside dungeon persistence
- revision, chunk inventory, and incremental chunk ownership may be introduced
  through an automatic destructive schema migration; existing Dungeon rows are
  disposable test data and have no compatibility or backup obligation

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields for preview state, render state, or other
  derived runtime state.
- Review must reject adapter code that becomes the owner of topology repair or
  semantic behavior.

## References

- [Dungeon Domain Model](../domain/domain-dungeon.md) (line 1)
- [Dungeon Map Surface Contract](../../maps/contract/contract-maps-dungeon-surface.md) (line 1)
- [Map Canvas Overview](../../maps/README.md) (line 1)
