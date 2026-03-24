package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
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
                + "wall_finish     TEXT,"
                + "light_level     TEXT,"
                + "atmosphere      TEXT,"
                + "detail_notes    TEXT,"
                + "component_x     INTEGER NOT NULL,"
                + "component_y     INTEGER NOT NULL,"
                + "level_z         INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                + "corridor_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_members ("
                + "corridor_id      INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "member_order     INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (corridor_id, room_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_vertices ("
                + "cluster_id       INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "vertex_index     INTEGER NOT NULL,"
                + "relative_x       INTEGER NOT NULL,"
                + "relative_y       INTEGER NOT NULL,"
                + "PRIMARY KEY (cluster_id, vertex_index)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_edges ("
                + "cluster_id       INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL,"
                + "edge_type        TEXT NOT NULL,"
                + "PRIMARY KEY (cluster_id, cell_x, cell_y, edge_direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_door_overrides ("
                + "corridor_id       INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "room_id           INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "cluster_id        INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "relative_cell_x   INTEGER NOT NULL,"
                + "relative_cell_y   INTEGER NOT NULL,"
                + "edge_direction    TEXT NOT NULL,"
                + "sort_order        INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (corridor_id, room_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_waypoints ("
                + "corridor_id       INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "sort_order        INTEGER NOT NULL,"
                + "cluster_id        INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "relative_x        INTEGER NOT NULL,"
                + "relative_y        INTEGER NOT NULL,"
                + "relative_z        INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (corridor_id, sort_order)"
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
                + "name             TEXT"
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
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
        }
        ensureColumn(conn, "dungeon_rooms", "wall_finish", "TEXT");
        ensureColumn(conn, "dungeon_rooms", "light_level", "TEXT");
        ensureColumn(conn, "dungeon_rooms", "atmosphere", "TEXT");
        ensureColumn(conn, "dungeon_rooms", "detail_notes", "TEXT");
    }

    public static void resetSchema(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = OFF");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_cluster_edges");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_cluster_vertices");
            stmt.execute("DROP TABLE IF EXISTS dungeon_room_exit_descriptions");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_waypoints");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_door_overrides");
            stmt.execute("DROP TABLE IF EXISTS dungeon_corridor_members");
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

    private static void ensureColumn(Connection conn, String tableName, String columnName, String columnType) throws SQLException {
        if (hasColumn(conn, tableName, columnName)) {
            return;
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + columnType);
        }
    }

    private static boolean hasColumn(Connection conn, String tableName, String columnName) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("PRAGMA table_info(" + tableName + ")");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                if (columnName.equalsIgnoreCase(rs.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }
}
