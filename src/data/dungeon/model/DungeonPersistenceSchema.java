package src.data.dungeon.model;

import java.util.List;

public final class DungeonPersistenceSchema {

    private static final String ALTER_TABLE = "ALTER TABLE ";

    public static final String DATABASE_FILE_NAME = String.valueOf("game.db");
    public static final String MAPS_TABLE = "dungeon_maps";
    public static final String ROOMS_TABLE = "dungeon_rooms";
    public static final String ROOM_CLUSTERS_TABLE = "dungeon_room_clusters";
    public static final String CORRIDORS_TABLE = "dungeon_corridors";
    public static final String CORRIDOR_MEMBERS_TABLE = "dungeon_corridor_members";
    public static final String ROOM_CLUSTER_VERTICES_TABLE = "dungeon_room_cluster_vertices";
    public static final String ROOM_CLUSTER_EDGES_TABLE = "dungeon_room_cluster_edges";
    public static final String ROOM_FLOORS_TABLE = "dungeon_room_floors";
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
    public static final String LEGACY_STRUCTURE_LEVELS_TABLE = "dungeon_structure_levels";

    public static final String CREATE_DUNGEON_MAPS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_maps ("
                    + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name           TEXT NOT NULL"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_clusters ("
                    + "cluster_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "center_x         INTEGER NOT NULL,"
                    + "center_y         INTEGER NOT NULL,"
                    + "level_z          INTEGER NOT NULL DEFAULT 0"
                    + ")";

    public static final String DROP_LEGACY_ROOM_CLUSTERS_STRUCTURE_OBJECT_TABLE_SQL =
            "DROP TABLE IF EXISTS dungeon_room_clusters_legacy_structure_object";

    public static final String RENAME_ROOM_CLUSTERS_TO_LEGACY_STRUCTURE_OBJECT_TABLE_SQL =
            "ALTER TABLE dungeon_room_clusters RENAME TO dungeon_room_clusters_legacy_structure_object";

    public static final String COPY_LEGACY_STRUCTURE_OBJECT_CLUSTERS_TO_ROOM_CLUSTERS_SQL =
            "INSERT INTO dungeon_room_clusters(cluster_id, dungeon_map_id, center_x, center_y, level_z)"
                    + " SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                    + " FROM dungeon_room_clusters_legacy_structure_object";

    public static final String CREATE_DUNGEON_ROOMS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                    + "room_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id     INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "cluster_id         INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "name               TEXT NOT NULL,"
                    + "visual_description TEXT,"
                    + "component_x        INTEGER NOT NULL,"
                    + "component_y        INTEGER NOT NULL,"
                    + "level_z            INTEGER NOT NULL DEFAULT 0"
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

    public static final String CREATE_DUNGEON_ROOM_CLUSTER_VERTICES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_cluster_vertices ("
                    + "cluster_id   INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z      INTEGER NOT NULL DEFAULT 0,"
                    + "vertex_index INTEGER NOT NULL,"
                    + "relative_x   INTEGER NOT NULL,"
                    + "relative_y   INTEGER NOT NULL,"
                    + "PRIMARY KEY (cluster_id, level_z, vertex_index)"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_CLUSTER_EDGES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_cluster_edges ("
                    + "cluster_id     INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL DEFAULT 0,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "edge_direction TEXT NOT NULL,"
                    + "edge_type      TEXT NOT NULL,"
                    + "topology_element_id INTEGER,"
                    + "PRIMARY KEY (cluster_id, level_z, cell_x, cell_y, edge_direction)"
                    + ")";

    public static final String CREATE_DUNGEON_ROOM_FLOORS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_room_floors ("
                    + "room_id  INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "level_z  INTEGER NOT NULL,"
                    + "anchor_x INTEGER NOT NULL,"
                    + "anchor_y INTEGER NOT NULL,"
                    + "PRIMARY KEY (room_id, level_z)"
                    + ")";

    public static final String CREATE_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS dungeon_corridor_door_overrides ("
                    + "corridor_id     INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "room_id         INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "cluster_id      INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "relative_cell_x INTEGER NOT NULL,"
                    + "relative_cell_y INTEGER NOT NULL,"
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
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "edge_direction TEXT NOT NULL,"
                    + "description    TEXT,"
                    + "sort_order     INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (room_id, cell_x, cell_y, edge_direction)"
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
                    + "destination_type         TEXT NOT NULL,"
                    + "target_overworld_map_id  INTEGER,"
                    + "target_overworld_tile_id INTEGER,"
                    + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                    + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                    + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                    + ")";

    public static final String ADD_DUNGEON_ROOMS_VISUAL_DESCRIPTION_COLUMN_SQL =
            ALTER_TABLE + ROOMS_TABLE + " ADD COLUMN visual_description TEXT";

    public static final String ADD_DUNGEON_STAIRS_SHAPE_COLUMN_SQL =
            ALTER_TABLE + STAIRS_TABLE + " ADD COLUMN shape TEXT NOT NULL DEFAULT 'LADDER'";

    public static final String ADD_DUNGEON_STAIRS_DIRECTION_COLUMN_SQL =
            ALTER_TABLE + STAIRS_TABLE + " ADD COLUMN direction INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_STAIRS_DIMENSION1_COLUMN_SQL =
            ALTER_TABLE + STAIRS_TABLE + " ADD COLUMN dimension1 INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_STAIRS_DIMENSION2_COLUMN_SQL =
            ALTER_TABLE + STAIRS_TABLE + " ADD COLUMN dimension2 INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_STAIRS_CORRIDOR_ID_COLUMN_SQL =
            ALTER_TABLE + STAIRS_TABLE
                    + " ADD COLUMN corridor_id INTEGER REFERENCES "
                    + CORRIDORS_TABLE
                    + "(corridor_id) ON DELETE CASCADE";

    public static final String ADD_DUNGEON_ROOM_CLUSTERS_CENTER_X_COLUMN_SQL =
            ALTER_TABLE + ROOM_CLUSTERS_TABLE + " ADD COLUMN center_x INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_ROOM_CLUSTERS_CENTER_Y_COLUMN_SQL =
            ALTER_TABLE + ROOM_CLUSTERS_TABLE + " ADD COLUMN center_y INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_ROOM_CLUSTERS_LEVEL_Z_COLUMN_SQL =
            ALTER_TABLE + ROOM_CLUSTERS_TABLE + " ADD COLUMN level_z INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_DUNGEON_TRANSITIONS_CELL_X_COLUMN_SQL =
            ALTER_TABLE + TRANSITIONS_TABLE + " ADD COLUMN cell_x INTEGER";

    public static final String ADD_DUNGEON_TRANSITIONS_CELL_Y_COLUMN_SQL =
            ALTER_TABLE + TRANSITIONS_TABLE + " ADD COLUMN cell_y INTEGER";

    public static final String ADD_DUNGEON_TRANSITIONS_LEVEL_Z_COLUMN_SQL =
            ALTER_TABLE + TRANSITIONS_TABLE + " ADD COLUMN level_z INTEGER";

    public static final String ADD_DUNGEON_ROOM_CLUSTER_EDGES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL =
            ALTER_TABLE + ROOM_CLUSTER_EDGES_TABLE + " ADD COLUMN topology_element_id INTEGER";

    public static final String ADD_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL =
            ALTER_TABLE + CORRIDOR_DOOR_OVERRIDES_TABLE + " ADD COLUMN topology_element_id INTEGER";

    public static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_DUNGEON_MAPS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL,
            CREATE_DUNGEON_ROOMS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDORS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_MEMBERS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CLUSTER_VERTICES_TABLE_SQL,
            CREATE_DUNGEON_ROOM_CLUSTER_EDGES_TABLE_SQL,
            CREATE_DUNGEON_ROOM_FLOORS_TABLE_SQL,
            CREATE_DUNGEON_TOPOLOGY_ELEMENTS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ANCHORS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_ANCHOR_REFS_TABLE_SQL,
            CREATE_DUNGEON_CORRIDOR_WAYPOINTS_TABLE_SQL,
            CREATE_DUNGEON_ROOM_EXIT_DESCRIPTIONS_TABLE_SQL,
            CREATE_DUNGEON_STAIRS_TABLE_SQL,
            CREATE_DUNGEON_STAIR_PATH_NODES_TABLE_SQL,
            CREATE_DUNGEON_STAIR_EXITS_TABLE_SQL,
            CREATE_DUNGEON_TRANSITIONS_TABLE_SQL
    );

    public static final List<String> COMPATIBILITY_ALTER_TABLE_SQL = List.of(
            ADD_DUNGEON_ROOMS_VISUAL_DESCRIPTION_COLUMN_SQL,
            ADD_DUNGEON_ROOM_CLUSTERS_CENTER_X_COLUMN_SQL,
            ADD_DUNGEON_ROOM_CLUSTERS_CENTER_Y_COLUMN_SQL,
            ADD_DUNGEON_ROOM_CLUSTERS_LEVEL_Z_COLUMN_SQL,
            ADD_DUNGEON_STAIRS_SHAPE_COLUMN_SQL,
            ADD_DUNGEON_STAIRS_DIRECTION_COLUMN_SQL,
            ADD_DUNGEON_STAIRS_DIMENSION1_COLUMN_SQL,
            ADD_DUNGEON_STAIRS_DIMENSION2_COLUMN_SQL,
            ADD_DUNGEON_STAIRS_CORRIDOR_ID_COLUMN_SQL,
            ADD_DUNGEON_TRANSITIONS_CELL_X_COLUMN_SQL,
            ADD_DUNGEON_TRANSITIONS_CELL_Y_COLUMN_SQL,
            ADD_DUNGEON_TRANSITIONS_LEVEL_Z_COLUMN_SQL,
            ADD_DUNGEON_ROOM_CLUSTER_EDGES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL,
            ADD_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL
    );

    private DungeonPersistenceSchema() {
    }
}
