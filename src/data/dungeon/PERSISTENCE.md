Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-22
Source of Truth: Persistence path, schema ownership, and adapter boundaries
for the `dungeon` feature.

# Dungeon Persistence

This document is normative for the dungeon feature's persistence path.

## Root Contract

- `src/data/dungeon/DungeonServiceContribution.java` is the only root service
  entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers `DungeonApplicationService.class` through the
  shell-owned service registry, `shell.api.ServiceRegistry`.
- Domain ports are implementation collaborators. They must not be registered
  as runtime services or looked up directly by view code.

## Port Adapters

- `SqliteDungeonMapRepository` implements `DungeonMapRepository` and owns
  authored dungeon-map write-model persistence.
- `SqliteDungeonMapSearch` implements `DungeonMapSearch` and owns read-only
  map lookup for application use cases.
- Both adapters use `DungeonSqliteGateway` as a source adapter. The gateway
  confronts SQLite and returns source-local records, not published carriers.
- `DungeonMapRecordMapper` translates between source-local records and the
  `DungeonMap` aggregate.

## Mandatory Schema

- `src/data/dungeon/model/DungeonPersistenceSchema.java` is the canonical
  in-code schema declaration for dungeon persistence.
- The current schema manager creates one authoritative map-topology table plus
  the legacy-compatible dungeon detail table family:
  - `dungeon_maps`
  - `dungeon_topology_elements`
  - `dungeon_room_clusters`
  - `dungeon_rooms`
  - `dungeon_corridors`
  - `dungeon_corridor_members`
  - `dungeon_room_cluster_vertices`
  - `dungeon_room_cluster_edges`
  - `dungeon_room_floors`
  - `dungeon_corridor_door_overrides`
  - `dungeon_corridor_waypoints`
  - `dungeon_room_exit_descriptions`
  - `dungeon_stairs`
  - `dungeon_stair_path_nodes`
  - `dungeon_stair_exits`
  - `dungeon_transitions`
- Existing databases receive additive compatibility migrations for
  `dungeon_rooms.visual_description`, room-cluster center columns
  `center_x`, `center_y`, and `level_z`, legacy stair columns `shape`,
  `direction`, `dimension1`, `dimension2`, and `corridor_id`, transition
  anchor columns `cell_x`, `cell_y`, and `level_z`, and persisted
  `topology_element_id` columns for room-cluster edges and corridor door
  overrides.
- Existing legacy room clusters backed by `dungeon_structure_levels` are
  backfilled into the current center columns and then migrated away from the
  obsolete `structure_object_id` room-cluster column so new map creation and
  full map saves can use the current authored cluster schema. Legacy
  stair-anchored transitions are backfilled into the current nullable
  transition anchor columns when those columns are first added.
- Existing legacy dungeon rows are backfilled into `dungeon_topology_elements`
  when that table is introduced or still empty. After that point, the topology
  element table is the SQLite source of truth for map-owned
  `DungeonTopologyRef(kind,id)` identity and binding rows.
- Existing obsolete demo maps are removed only when they match the old seed
  signature: generated map name, one `Entry Hall`, one cluster, the known
  generated anchor and center, and no authored connections or narration.
  Generated seed floors, vertices, walls, and topology rows do not protect that
  obsolete map from deletion, while empty authored maps without the `Entry Hall`
  signature remain valid.

## Current Mapping

The current adapter persists and reloads map identity, map name, grid bounds,
authoritative topology elements, authored room records, room floor anchors,
room visual and exit narration, room-cluster centers, room-cluster vertices,
explicit cluster wall or door edges, corridor membership, corridor waypoints,
corridor door overrides, stair path nodes, stair exits, stair corridor
attachments, and transition destination rows.
Cluster wall and door rows store the source-local tile-side marker:
`cell_x/cell_y/level_z` name the owning tile and `edge_direction` names that
tile side. The domain derives the rendered boundary as grid-vertex endpoints
from that marker, so the persistence schema does not store center-to-neighbor
line coordinates.
`dungeon_topology_elements` stores the persisted map-owned topology refs for
`ROOM`, `CORRIDOR`, `DOOR`, `WALL`, `STAIR`, and `TRANSITION`. `CLUSTER` is not
a topology ref kind; clusters remain organizational bindings stored as
`cluster_id` on topology elements and detail rows. Legacy detail tables store
source-local attributes and compatibility geometry. After loading, the domain
map remains the behavioral topology owner: rooms, clusters, corridors, doors,
stairs, and transitions bind to stable map-owned topology refs instead of
owning mutable topology themselves.
Map saves are full synchronizations for authored topology and its detail rows:
retained topology elements are rewritten, retained clusters, rooms,
connections, stairs, transitions, vertices, boundaries, floors, exit
descriptions, waypoints, door bindings, stair path nodes, and stair exits are
upserted or replaced, and removed rows are deleted so SQLite cascade rules
clear dependent compatibility rows. New maps may remain empty until the editor
creates authored room geometry; the gateway no longer creates seed rooms or
demo topology rows.
Selection-tool narration saves reuse this same full synchronization path:
visual room descriptions persist on `dungeon_rooms.visual_description`, and
exit descriptions persist in `dungeon_room_exit_descriptions` keyed by room
cell and edge direction.

This is infrastructure for behavioural parity, not complete parity. Room
semantics, cluster boundary geometry, and corridor read geometry are now
represented. Room paint/delete now persists through the authored room topology
sync path. Doors, stairs, and transitions are now source-to-domain mapped as
authored facts. Runtime local movement derives one domain traversal-link model
from door boundaries and stair exits, while transition movement remains a
separate runtime action for cross-map and overworld targets. Character-specific
travel position persistence belongs to party persistence, so this dungeon step
introduces no character-position tables, columns, or ports. Direct token-drag
movement, wall/door mutation paths, corridor/stair/transition editor mutation
paths, cross-map dungeon transition follow-through, and non-space feature
mapping still need follow-up work before the legacy dungeon behaviour is fully
represented.

## Stability Rules

- Dungeon persistence must keep authored truth in SQLite and derived editor,
  inspector, route, and render state out of the write model. SQLite table
  ownership does not imply domain behavior ownership; adapters translate the
  authoritative topology table plus legacy detail family into the map-owned
  topology model.
- `dungeon_topology_elements` is authoritative for persisted topology identity
  and bindings. Legacy tables may carry `topology_element_id` for detail-row
  correlation, but they must not become the semantic owner of topology.
- New dungeon source fields first belong in source-local records under
  `src/data/dungeon/model/`, then map into domain-owned values or aggregate
  behaviour.
- Gateway code must not become a public backend boundary or own business
  policy.
- Adding parity tables or columns must update this document in the same
  change.
