package features.dungeon.adapter.sqlite.model;

import java.util.List;

public final class DungeonPersistenceSchema {

    public static final String DATABASE_FILE_NAME = String.valueOf("game.db");
    public static final String MAPS_TABLE = "dungeon_maps";
    public static final String ROOMS_TABLE = "dungeon_rooms";
    public static final String ROOM_CLUSTERS_TABLE = "dungeon_room_clusters";
    public static final String CORRIDORS_TABLE = "dungeon_corridors";
    public static final String CORRIDOR_MEMBERS_TABLE = "dungeon_corridor_members";
    public static final String ROOM_CLUSTER_EDGES_TABLE = "dungeon_room_cluster_edges";
    public static final String ROOM_CELLS_TABLE = "dungeon_room_cells";
    public static final String TOPOLOGY_ELEMENTS_TABLE = "dungeon_topology_elements";
    public static final String CORRIDOR_DOOR_OVERRIDES_TABLE = "dungeon_corridor_door_overrides";
    public static final String CORRIDOR_ANCHORS_TABLE = "dungeon_corridor_anchors";
    public static final String CORRIDOR_ANCHOR_REFS_TABLE = "dungeon_corridor_anchor_refs";
    public static final String CORRIDOR_WAYPOINTS_TABLE = "dungeon_corridor_waypoints";
    public static final String ROOM_EXIT_DESCRIPTIONS_TABLE = "dungeon_room_exit_descriptions";
    public static final String STAIRS_TABLE = "dungeon_stairs";
    public static final String STAIR_PATH_NODES_TABLE = "dungeon_stair_path_nodes";
    public static final String STAIR_EXITS_TABLE = "dungeon_stair_exits";
    public static final String TRANSITIONS_TABLE = "dungeon_transitions";
    public static final String FEATURE_MARKERS_TABLE = "dungeon_feature_markers";
    public static final String CHUNKS_TABLE = "dungeon_chunks";
    public static final String ENTITY_CHUNKS_TABLE = "dungeon_entity_chunks";
    public static final String AUTHORED_LEVEL_BOUNDS_TABLE = "dungeon_authored_level_bounds";
    public static final String CORRIDOR_ROUTE_CELLS_TABLE = "dungeon_corridor_route_cells";
    public static final String CORRIDOR_ROUTE_DEPENDENCIES_TABLE = "dungeon_corridor_route_dependencies";
    public static final String IDENTITY_SEQUENCES_TABLE = "dungeon_identity_sequences";

    public static final String CREATE_DUNGEON_MAPS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_maps ("
                    + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name           TEXT NOT NULL,"
                    + "revision       INTEGER NOT NULL DEFAULT 1"
                    + ")";

    public static final String CREATE_DUNGEON_IDENTITY_SEQUENCES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_identity_sequences ("
                    + "identity_kind TEXT PRIMARY KEY,"
                    + "next_id       INTEGER NOT NULL CHECK(next_id > 0)"
                    + ")";

    public static final String CREATE_DUNGEON_CHUNKS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_chunks ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL,"
                    + "chunk_q        INTEGER NOT NULL,"
                    + "chunk_r        INTEGER NOT NULL,"
                    + "content_revision INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (dungeon_map_id, level_z, chunk_q, chunk_r)"
                    + ")";

    public static final String CREATE_DUNGEON_ENTITY_CHUNKS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_entity_chunks ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "entity_kind    TEXT NOT NULL,"
                    + "entity_id      INTEGER NOT NULL,"
                    + "level_z        INTEGER NOT NULL,"
                    + "chunk_q        INTEGER NOT NULL,"
                    + "chunk_r        INTEGER NOT NULL,"
                    + "minimum_q      INTEGER NOT NULL,"
                    + "minimum_r      INTEGER NOT NULL,"
                    + "maximum_q      INTEGER NOT NULL,"
                    + "maximum_r      INTEGER NOT NULL,"
                    + "entity_chunk_count INTEGER NOT NULL CHECK(entity_chunk_count > 0),"
                    + "CHECK(maximum_q >= minimum_q AND maximum_r >= minimum_r),"
                    + "CHECK(minimum_q >= chunk_q * 64 AND maximum_q < (chunk_q + 1) * 64),"
                    + "CHECK(minimum_r >= chunk_r * 64 AND maximum_r < (chunk_r + 1) * 64),"
                    + "PRIMARY KEY (dungeon_map_id, entity_kind, entity_id, level_z, chunk_q, chunk_r),"
                    + "FOREIGN KEY (dungeon_map_id, level_z, chunk_q, chunk_r)"
                    + " REFERENCES dungeon_chunks(dungeon_map_id, level_z, chunk_q, chunk_r) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_DUNGEON_ENTITY_CHUNKS_LOOKUP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_entity_chunks_by_chunk "
                    + "ON dungeon_entity_chunks(dungeon_map_id, level_z, chunk_q, chunk_r, entity_kind, entity_id)";

    public static final String CREATE_DUNGEON_ENTITY_CHUNKS_EXTREMA_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_entity_chunks_level_extrema "
                    + "ON dungeon_entity_chunks(dungeon_map_id, level_z, minimum_q, maximum_q, minimum_r, maximum_r)";

    public static final String CREATE_DUNGEON_ENTITY_CHUNKS_CONTINUATION_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_entity_chunks_continuation "
                    + "ON dungeon_entity_chunks("
                    + "dungeon_map_id, entity_kind, entity_id, level_z, chunk_r, chunk_q)";

    public static final String CREATE_DUNGEON_AUTHORED_LEVEL_BOUNDS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_authored_level_bounds ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL,"
                    + "minimum_q      INTEGER NOT NULL,"
                    + "minimum_r      INTEGER NOT NULL,"
                    + "maximum_q      INTEGER NOT NULL,"
                    + "maximum_r      INTEGER NOT NULL,"
                    + "CHECK(maximum_q >= minimum_q AND maximum_r >= minimum_r),"
                    + "PRIMARY KEY (dungeon_map_id, level_z)"
                    + ")";

    public static final String CREATE_DUNGEON_CHUNKS_HORIZONTAL_LOOKUP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_chunks_by_horizontal_window "
                    + "ON dungeon_chunks(dungeon_map_id, chunk_q, chunk_r, level_z)";

    public static final String CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_route_cells ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "corridor_id    INTEGER NOT NULL,"
                    + "segment_order  INTEGER NOT NULL,"
                    + "cell_order     INTEGER NOT NULL,"
                    + "level_z        INTEGER NOT NULL,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "chunk_q        INTEGER NOT NULL,"
                    + "chunk_r        INTEGER NOT NULL,"
                    + "PRIMARY KEY (dungeon_map_id, corridor_id, segment_order, cell_order),"
                    + "UNIQUE (dungeon_map_id, corridor_id, level_z, cell_x, cell_y),"
                    + "FOREIGN KEY (dungeon_map_id, level_z, chunk_q, chunk_r)"
                    + " REFERENCES dungeon_chunks(dungeon_map_id, level_z, chunk_q, chunk_r) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_LOOKUP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_corridor_route_cells_by_chunk "
                    + "ON dungeon_corridor_route_cells("
                    + "dungeon_map_id, level_z, chunk_q, chunk_r, corridor_id, segment_order, cell_order)";

    public static final String CREATE_DUNGEON_CORRIDOR_ROUTE_DEPENDENCIES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_route_dependencies ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "corridor_id    INTEGER NOT NULL,"
                    + "level_z        INTEGER NOT NULL,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "PRIMARY KEY (dungeon_map_id, corridor_id, level_z, cell_x, cell_y)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_ROUTE_DEPENDENCIES_LOOKUP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_corridor_route_dependencies_by_cell "
                    + "ON dungeon_corridor_route_dependencies("
                    + "dungeon_map_id, level_z, cell_x, cell_y, corridor_id)";

    public static final String CREATE_DUNGEON_ROOMS_CLUSTER_LOOKUP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_by_cluster "
                    + "ON dungeon_rooms(cluster_id, room_id)";

    public static final String CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_clusters ("
                    + "cluster_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "name             TEXT NOT NULL"
                    + ")";

    public static final String CREATE_DUNGEON_ROOMS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                    + "room_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id     INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "cluster_id         INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "name               TEXT NOT NULL,"
                    + "visual_description TEXT"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_CELLS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_cells ("
                    + "room_id INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "level_z INTEGER NOT NULL,"
                    + "cell_x  INTEGER NOT NULL,"
                    + "cell_y  INTEGER NOT NULL,"
                    + "PRIMARY KEY (room_id, level_z, cell_y, cell_x)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDORS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                    + "corridor_id     INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "level_z         INTEGER NOT NULL DEFAULT 0"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_MEMBERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_members ("
                    + "corridor_id  INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "room_id      INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "member_order INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, room_id)"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_CLUSTER_EDGES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_cluster_edges ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "cluster_id     INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL DEFAULT 0,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "edge_direction TEXT NOT NULL,"
                    + "edge_type      TEXT NOT NULL,"
                    + "topology_element_id INTEGER,"
                    + "PRIMARY KEY (dungeon_map_id, cluster_id, level_z, cell_x, cell_y, edge_direction)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_door_overrides ("
                    + "corridor_id     INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "room_id         INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "cluster_id      INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "relative_cell_x INTEGER NOT NULL,"
                    + "relative_cell_y INTEGER NOT NULL,"
                    + "relative_cell_z INTEGER NOT NULL DEFAULT 0,"
                    + "edge_direction  TEXT NOT NULL,"
                    + "topology_element_id INTEGER,"
                    + "sort_order      INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, room_id)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_ANCHORS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_anchors ("
                    + "corridor_id     INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "anchor_id       INTEGER NOT NULL,"
                    + "host_corridor_id INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "cell_x          INTEGER NOT NULL,"
                    + "cell_y          INTEGER NOT NULL,"
                    + "cell_z          INTEGER NOT NULL DEFAULT 0,"
                    + "topology_element_id INTEGER,"
                    + "sort_order      INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, anchor_id)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_ANCHOR_REFS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_anchor_refs ("
                    + "corridor_id      INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "host_corridor_id INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "topology_element_id INTEGER NOT NULL,"
                    + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, topology_element_id)"
                    + ")";

    public static final String CREATE_DUNGEON_TOPOLOGY_ELEMENTS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_topology_elements ("
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "element_kind   TEXT NOT NULL,"
                    + "element_id     INTEGER NOT NULL,"
                    + "cluster_id     INTEGER REFERENCES dungeon_room_clusters(cluster_id) ON DELETE SET NULL,"
                    + "corridor_id    INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE SET NULL,"
                    + "label          TEXT,"
                    + "sort_order     INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (dungeon_map_id, element_kind, element_id)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_WAYPOINTS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_waypoints ("
                    + "corridor_id INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "sort_order  INTEGER NOT NULL,"
                    + "cluster_id  INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "relative_x  INTEGER NOT NULL,"
                    + "relative_y  INTEGER NOT NULL,"
                    + "relative_z  INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, sort_order)"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_EXIT_DESCRIPTIONS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_exit_descriptions ("
                    + "room_id        INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "edge_direction TEXT NOT NULL,"
                    + "description    TEXT,"
                    + "sort_order     INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (room_id, level_z, cell_x, cell_y, edge_direction)"
                    + ")";

    public static final String CREATE_DUNGEON_STAIRS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_stairs ("
                    + "stair_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "name           TEXT,"
                    + "shape          TEXT NOT NULL DEFAULT 'LADDER',"
                    + "direction      INTEGER NOT NULL DEFAULT 0,"
                    + "dimension1     INTEGER NOT NULL DEFAULT 0,"
                    + "dimension2     INTEGER NOT NULL DEFAULT 0,"
                    + "corridor_id    INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_DUNGEON_STAIR_PATH_NODES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_stair_path_nodes ("
                    + "stair_id   INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                    + "sort_order INTEGER NOT NULL,"
                    + "cell_x     INTEGER NOT NULL,"
                    + "cell_y     INTEGER NOT NULL,"
                    + "cell_z     INTEGER NOT NULL,"
                    + "PRIMARY KEY (stair_id, sort_order)"
                    + ")";

    public static final String CREATE_DUNGEON_STAIR_EXITS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_stair_exits ("
                    + "stair_exit_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "stair_id      INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                    + "cell_x        INTEGER NOT NULL,"
                    + "cell_y        INTEGER NOT NULL,"
                    + "cell_z        INTEGER NOT NULL,"
                    + "label         TEXT"
                    + ")";

    public static final String CREATE_DUNGEON_TRANSITIONS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_transitions ("
                    + "transition_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id           INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "description              TEXT,"
                    + "cell_x                   INTEGER,"
                    + "cell_y                   INTEGER,"
                    + "level_z                  INTEGER,"
                    + "anchor_type              TEXT,"
                    + "anchor_edge_direction    TEXT,"
                    + "destination_type         TEXT NOT NULL,"
                    + "target_overworld_map_id  INTEGER,"
                    + "target_overworld_tile_id INTEGER,"
                    + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                    + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                    + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                    + ")";

    public static final String CREATE_DUNGEON_FEATURE_MARKERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_feature_markers ("
                    + "feature_marker_id INTEGER NOT NULL,"
                    + "dungeon_map_id     INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "marker_kind        TEXT NOT NULL,"
                    + "cell_x             INTEGER NOT NULL,"
                    + "cell_y             INTEGER NOT NULL,"
                    + "level_z            INTEGER NOT NULL DEFAULT 0,"
                    + "label              TEXT,"
                    + "description        TEXT,"
                    + "PRIMARY KEY (dungeon_map_id, feature_marker_id)"
                    + ")";

    public static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_DUNGEON_MAPS_TABLE_SQL,
            CREATE_DUNGEON_IDENTITY_SEQUENCES_TABLE_SQL,
            CREATE_DUNGEON_CHUNKS_TABLE_SQL,
            CREATE_DUNGEON_ENTITY_CHUNKS_TABLE_SQL,
            CREATE_DUNGEON_AUTHORED_LEVEL_BOUNDS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ROUTE_DEPENDENCIES_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL,
            CREATE_DUNGEON_ROOMS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CELLS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDORS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_MEMBERS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CLUSTER_EDGES_TABLE_SQL,
            CREATE_DUNGEON_TOPOLOGY_ELEMENTS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ANCHORS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ANCHOR_REFS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_WAYPOINTS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_EXIT_DESCRIPTIONS_TABLE_SQL,
            CREATE_DUNGEON_STAIRS_TABLE_SQL,
            CREATE_DUNGEON_STAIR_PATH_NODES_TABLE_SQL,
            CREATE_DUNGEON_STAIR_EXITS_TABLE_SQL,
            CREATE_DUNGEON_TRANSITIONS_TABLE_SQL,
            CREATE_DUNGEON_FEATURE_MARKERS_TABLE_SQL
    );

    public static final List<String> CREATE_INDEX_SQL = List.of(
            CREATE_DUNGEON_CHUNKS_HORIZONTAL_LOOKUP_INDEX_SQL,
            CREATE_DUNGEON_ENTITY_CHUNKS_LOOKUP_INDEX_SQL,
            CREATE_DUNGEON_ENTITY_CHUNKS_EXTREMA_INDEX_SQL,
            CREATE_DUNGEON_ENTITY_CHUNKS_CONTINUATION_INDEX_SQL,
            CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_LOOKUP_INDEX_SQL,
            CREATE_DUNGEON_CORRIDOR_ROUTE_DEPENDENCIES_LOOKUP_INDEX_SQL,
            CREATE_DUNGEON_ROOMS_CLUSTER_LOOKUP_INDEX_SQL
    );

    private DungeonPersistenceSchema() {
    }
}
