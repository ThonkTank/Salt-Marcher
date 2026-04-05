package features.world.dungeonmap.repository;

import java.sql.SQLException;
import java.sql.Statement;

/**
 * The tables declared here define the active dungeon truth.
 *
 * <p>When behavior changes, this schema should continue to point at the real owners instead of keeping parallel
 * compatibility state alive.
 */
public final class DungeonStorageSupport {

    private DungeonStorageSupport() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_clusters ("
                + "cluster_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "center_x         INTEGER NOT NULL,"
                + "center_y         INTEGER NOT NULL,"
                + "level_z          INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "cluster_id      INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "name            TEXT NOT NULL,"
                + "visual_description TEXT,"
                + "component_x     INTEGER NOT NULL,"
                + "component_y     INTEGER NOT NULL,"
                + "level_z         INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                + "corridor_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_nodes ("
                + "corridor_node_id      INTEGER PRIMARY KEY,"
                + "corridor_id           INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "grid_x2               INTEGER NOT NULL,"
                + "grid_y2               INTEGER NOT NULL,"
                + "room_id               INTEGER,"
                + "room_cell_x           INTEGER,"
                + "room_cell_y           INTEGER,"
                + "room_edge_direction   TEXT,"
                + "UNIQUE(corridor_id, corridor_node_id),"
                + "UNIQUE(corridor_id, grid_x2, grid_y2),"
                + "CHECK ("
                + "    (room_id IS NULL AND room_cell_x IS NULL AND room_cell_y IS NULL AND room_edge_direction IS NULL)"
                + " OR (room_id IS NOT NULL AND room_cell_x IS NOT NULL AND room_cell_y IS NOT NULL AND room_edge_direction IS NOT NULL)"
                + ")"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_segments ("
                + "corridor_segment_id   INTEGER PRIMARY KEY,"
                + "corridor_id           INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "start_node_id         INTEGER NOT NULL,"
                + "end_node_id           INTEGER NOT NULL,"
                + "CHECK(start_node_id < end_node_id),"
                + "UNIQUE(corridor_id, start_node_id, end_node_id),"
                + "FOREIGN KEY(corridor_id, start_node_id) REFERENCES dungeon_corridor_nodes(corridor_id, corridor_node_id) ON DELETE CASCADE,"
                + "FOREIGN KEY(corridor_id, end_node_id) REFERENCES dungeon_corridor_nodes(corridor_id, corridor_node_id) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_boundary_doors ("
                + "corridor_id           INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "start_x2              INTEGER NOT NULL,"
                + "start_y2              INTEGER NOT NULL,"
                + "end_x2                INTEGER NOT NULL,"
                + "end_y2                INTEGER NOT NULL,"
                + "PRIMARY KEY (corridor_id, start_x2, start_y2, end_x2, end_y2)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_levels ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "anchor_x2        INTEGER NOT NULL,"
                + "anchor_y2        INTEGER NOT NULL,"
                + "PRIMARY KEY (room_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_levels ("
                + "cluster_id       INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "anchor_x2        INTEGER NOT NULL,"
                + "anchor_y2        INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_level_seeds ("
                + "cluster_id       INTEGER NOT NULL,"
                + "level_z          INTEGER NOT NULL,"
                + "seed_x2          INTEGER NOT NULL,"
                + "seed_y2          INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z, seed_x2, seed_y2),"
                + "FOREIGN KEY(cluster_id, level_z) REFERENCES dungeon_room_cluster_levels(cluster_id, level_z) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_level_segments ("
                + "cluster_id       INTEGER NOT NULL,"
                + "level_z          INTEGER NOT NULL,"
                + "segment_kind     TEXT NOT NULL,"
                + "start_x2         INTEGER NOT NULL,"
                + "start_y2         INTEGER NOT NULL,"
                + "end_x2           INTEGER NOT NULL,"
                + "end_y2           INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z, segment_kind, start_x2, start_y2, end_x2, end_y2),"
                + "FOREIGN KEY(cluster_id, level_z) REFERENCES dungeon_room_cluster_levels(cluster_id, level_z) ON DELETE CASCADE,"
                + "CHECK(segment_kind IN ('BOUNDARY','OPENING'))"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_level_floor_cells ("
                + "cluster_id       INTEGER NOT NULL,"
                + "level_z          INTEGER NOT NULL,"
                + "cell_x2          INTEGER NOT NULL,"
                + "cell_y2          INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z, cell_x2, cell_y2),"
                + "FOREIGN KEY(cluster_id, level_z) REFERENCES dungeon_room_cluster_levels(cluster_id, level_z) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_exit_descriptions ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL,"
                + "description      TEXT,"
                + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (room_id, level_z, cell_x, cell_y, edge_direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stairs ("
                + "stair_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name             TEXT,"
                + "anchor_cell_x    INTEGER NOT NULL,"
                + "anchor_cell_y    INTEGER NOT NULL,"
                + "anchor_level_z   INTEGER NOT NULL,"
                + "shape            TEXT NOT NULL,"
                + "direction_code   INTEGER NOT NULL DEFAULT 0,"
                + "dimension1       INTEGER NOT NULL DEFAULT 0,"
                + "dimension2       INTEGER NOT NULL DEFAULT 0,"
                + "min_level_z      INTEGER NOT NULL,"
                + "max_level_z      INTEGER NOT NULL,"
                + "CHECK(shape IN ('LADDER','STRAIGHT','SQUARE','RECTANGULAR','CIRCULAR'))"
                + ")");
        // Ordered path nodes are the canonical persisted stair geometry.
        // Exits are intentionally absent from the schema and must be re-derived from the path plus authored stop levels.
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_path_nodes ("
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "cell_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (stair_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_stop_levels ("
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "PRIMARY KEY (stair_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transition_stair_path_nodes ("
                + "transition_id     INTEGER NOT NULL REFERENCES dungeon_transitions(transition_id) ON DELETE CASCADE,"
                + "sort_order        INTEGER NOT NULL,"
                + "cell_x            INTEGER NOT NULL,"
                + "cell_y            INTEGER NOT NULL,"
                + "cell_z            INTEGER NOT NULL,"
                + "PRIMARY KEY (transition_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transition_stair_stop_levels ("
                + "transition_id     INTEGER NOT NULL REFERENCES dungeon_transitions(transition_id) ON DELETE CASCADE,"
                + "level_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (transition_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transitions ("
                + "transition_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id           INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "description              TEXT,"
                + "placement_type           TEXT,"
                + "door_level_z             INTEGER,"
                + "door_start_x2            INTEGER,"
                + "door_start_y2            INTEGER,"
                + "door_end_x2              INTEGER,"
                + "door_end_y2              INTEGER,"
                + "door_endpoint_type       TEXT,"
                + "door_endpoint_id         INTEGER,"
                + "stair_anchor_cell_x      INTEGER,"
                + "stair_anchor_cell_y      INTEGER,"
                + "stair_anchor_level_z     INTEGER,"
                + "stair_shape              TEXT,"
                + "stair_direction_code     INTEGER,"
                + "stair_dimension1         INTEGER,"
                + "stair_dimension2         INTEGER,"
                + "stair_min_level_z        INTEGER,"
                + "stair_max_level_z        INTEGER,"
                + "destination_type         TEXT NOT NULL,"
                + "target_overworld_map_id  INTEGER REFERENCES hex_maps(map_id) ON DELETE SET NULL,"
                + "target_overworld_tile_id INTEGER REFERENCES hex_tiles(tile_id) ON DELETE SET NULL,"
                + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                + ")");
    }
}
