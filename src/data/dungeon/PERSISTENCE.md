Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
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
- The current schema manager creates the legacy-compatible dungeon table
  family:
  - `dungeon_maps`
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
  `dungeon_rooms.visual_description` and the legacy stair columns
  `shape`, `direction`, `dimension1`, `dimension2`, and `corridor_id`.

## Current Mapping

The current adapter persists and reloads map identity, map name, topology seed,
authored room records, room floor anchors, room visual and exit narration,
room-cluster centers, room-cluster vertices, explicit cluster wall or door
edges, corridor membership, corridor waypoints, corridor door overrides, stair
path nodes, stair exits, stair corridor attachments, and transition destination
rows.
When a new map has no rooms, the gateway creates a seed room and cluster so
the existing map surfaces still have authorable spatial truth.

This is infrastructure for behavioural parity, not complete parity. Room
semantics, cluster boundary geometry, and corridor read geometry are now
represented. Doors, stairs, and transitions are now source-to-domain mapped as
authored facts. Runtime door, stair, and transition movement is derived from
those loaded facts and stored only in the shell runtime session; this step
introduces no new persistence tables, columns, or ports. Persistent
campaign/world movement, direct token-drag movement, editor mutation paths, and
non-space feature mapping still need follow-up work before the legacy dungeon
behaviour is fully represented.

## Stability Rules

- Dungeon persistence must keep authored truth in SQLite and derived editor,
  inspector, route, and render state out of the write model.
- New dungeon source fields first belong in source-local records under
  `src/data/dungeon/model/`, then map into domain-owned values or aggregate
  behaviour.
- Gateway code must not become a public backend boundary or own business
  policy.
- Adding parity tables or columns must update this document in the same
  change.
