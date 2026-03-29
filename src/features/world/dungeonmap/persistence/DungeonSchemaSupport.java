package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonSchemaSupport {

    private DungeonSchemaSupport() {
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
                + "level_z          INTEGER NOT NULL DEFAULT 0,"
                + "directly_adjacent INTEGER NOT NULL DEFAULT 0,"
                + "routable         INTEGER NOT NULL DEFAULT 1"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_path_nodes ("
                + "corridor_id      INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "cell_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (corridor_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_connections ("
                + "corridor_connection_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "corridor_id      INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_connection_endpoints ("
                + "corridor_connection_id INTEGER NOT NULL REFERENCES dungeon_corridor_connections(corridor_connection_id) ON DELETE CASCADE,"
                + "endpoint_order   INTEGER NOT NULL,"
                + "endpoint_type    TEXT NOT NULL,"
                + "endpoint_id      INTEGER NOT NULL,"
                + "PRIMARY KEY (corridor_connection_id, endpoint_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversals ("
                + "traversal_id     INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversal_members ("
                + "traversal_id     INTEGER NOT NULL REFERENCES dungeon_traversals(traversal_id) ON DELETE CASCADE,"
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "member_order     INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (traversal_id, room_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversal_door_bindings ("
                + "traversal_id      INTEGER NOT NULL REFERENCES dungeon_traversals(traversal_id) ON DELETE CASCADE,"
                + "room_id           INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "cluster_id        INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "relative_cell_x   INTEGER NOT NULL,"
                + "relative_cell_y   INTEGER NOT NULL,"
                + "edge_direction    TEXT NOT NULL,"
                + "sort_order        INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (traversal_id, room_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversal_waypoints ("
                + "traversal_id      INTEGER NOT NULL REFERENCES dungeon_traversals(traversal_id) ON DELETE CASCADE,"
                + "sort_order        INTEGER NOT NULL,"
                + "cluster_id        INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "relative_x        INTEGER NOT NULL,"
                + "relative_y        INTEGER NOT NULL,"
                + "relative_z        INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (traversal_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_vertices ("
                + "cluster_id       INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0,"
                + "vertex_index     INTEGER NOT NULL,"
                + "relative_x       INTEGER NOT NULL,"
                + "relative_y       INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z, vertex_index)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_edges ("
                + "cluster_id       INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL,"
                + "edge_type        TEXT NOT NULL,"
                + "PRIMARY KEY (cluster_id, level_z, cell_x, cell_y, edge_direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_floors ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "anchor_x         INTEGER NOT NULL,"
                + "anchor_y         INTEGER NOT NULL,"
                + "PRIMARY KEY (room_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_exit_descriptions ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL,"
                + "description      TEXT,"
                + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (room_id, cell_x, cell_y, edge_direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stairs ("
                + "stair_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name             TEXT,"
                + "anchor_x         INTEGER NOT NULL DEFAULT 0,"
                + "anchor_y         INTEGER NOT NULL DEFAULT 0,"
                + "shape            TEXT NOT NULL DEFAULT 'LADDER',"
                + "direction        TEXT NOT NULL DEFAULT 'NORTH',"
                + "dimension1       INTEGER NOT NULL DEFAULT 0,"
                + "dimension2       INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_path_nodes ("
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "cell_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (stair_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_exits ("
                + "stair_exit_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "cell_z           INTEGER NOT NULL,"
                + "label            TEXT"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversal_corridor_segments ("
                + "traversal_id     INTEGER NOT NULL REFERENCES dungeon_traversals(traversal_id) ON DELETE CASCADE,"
                + "segment_key      TEXT NOT NULL,"
                + "corridor_id      INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (traversal_id, segment_key),"
                + "UNIQUE (corridor_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_traversal_stair_segments ("
                + "traversal_id     INTEGER NOT NULL REFERENCES dungeon_traversals(traversal_id) ON DELETE CASCADE,"
                + "segment_key      TEXT NOT NULL,"
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (traversal_id, segment_key),"
                + "UNIQUE (stair_id)"
                + ")");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
            addColumnIfMissing(stmt, "dungeon_corridors", "level_z INTEGER NOT NULL DEFAULT 0");
            addColumnIfMissing(stmt, "dungeon_corridors", "directly_adjacent INTEGER NOT NULL DEFAULT 0");
            addColumnIfMissing(stmt, "dungeon_corridors", "routable INTEGER NOT NULL DEFAULT 1");
            addColumnIfMissing(stmt, "dungeon_stairs", "name TEXT");
            addColumnIfMissing(stmt, "dungeon_stairs", "anchor_x INTEGER NOT NULL DEFAULT 0");
            addColumnIfMissing(stmt, "dungeon_stairs", "anchor_y INTEGER NOT NULL DEFAULT 0");
            addColumnIfMissing(stmt, "dungeon_stairs", "shape TEXT NOT NULL DEFAULT 'LADDER'");
            addColumnIfMissing(stmt, "dungeon_stairs", "direction TEXT NOT NULL DEFAULT 'NORTH'");
            addColumnIfMissing(stmt, "dungeon_stairs", "dimension1 INTEGER NOT NULL DEFAULT 0");
            addColumnIfMissing(stmt, "dungeon_stairs", "dimension2 INTEGER NOT NULL DEFAULT 0");
        }
    }

    private static void addColumnIfMissing(Statement stmt, String table, String columnDefinition) throws SQLException {
        try {
            stmt.execute("ALTER TABLE " + table + " ADD COLUMN " + columnDefinition);
        } catch (SQLException ex) {
            String message = ex.getMessage();
            if (message == null || !message.toLowerCase(java.util.Locale.ROOT).contains("duplicate column name")) {
                throw ex;
            }
        }
    }

    public static void resetSchema(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = OFF");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversal_corridor_segments");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversal_stair_segments");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_connection_endpoints");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_connections");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_path_nodes");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_floors");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_cluster_edges");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_cluster_vertices");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_exit_descriptions");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_waypoints");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_door_overrides");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_members");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversal_waypoints");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversal_door_bindings");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversal_members");
            stmt.execute("DROP TABLE IF EXISTS dungeon_traversals");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridors");
            stmt.execute("DROP TABLE IF EXISTS dungeon_rooms");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_clusters");
            stmt.execute("DROP TABLE IF EXISTS dungeon_stair_exits");
            stmt.execute("DROP TABLE IF EXISTS dungeon_stair_path_nodes");
            stmt.execute("DROP TABLE IF EXISTS dungeon_stairs");
            stmt.execute("DROP TABLE IF EXISTS dungeon_maps");
            stmt.execute("PRAGMA foreign_keys = ON");
            createSchema(stmt);
        }
    }

}
