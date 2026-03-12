package features.world.dungeonmap.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Encapsulates dungeon-specific schema creation and compatibility work so bootstrap
 * only orchestrates feature migrations instead of owning their SQL details.
 */
public final class DungeonSchemaSupport {

    private DungeonSchemaSupport() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL,"
                + "width          INTEGER NOT NULL,"
                + "height         INTEGER NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_areas ("
                + "area_id             INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id              INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name                TEXT NOT NULL,"
                + "description         TEXT,"
                + "encounter_table_id  INTEGER"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id        INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name          TEXT NOT NULL,"
                + "description   TEXT,"
                + "area_id       INTEGER REFERENCES dungeon_areas(area_id) ON DELETE SET NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_squares ("
                + "square_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id         INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x              INTEGER NOT NULL,"
                + "y              INTEGER NOT NULL,"
                + "terrain_type   TEXT NOT NULL DEFAULT 'room_floor',"
                + "room_id        INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL,"
                + "UNIQUE (map_id, x, y)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_endpoints ("
                + "endpoint_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id         INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "square_id      INTEGER NOT NULL REFERENCES dungeon_squares(square_id) ON DELETE CASCADE,"
                + "name           TEXT,"
                + "notes          TEXT,"
                + "role           TEXT NOT NULL DEFAULT 'both',"
                + "is_default_entry INTEGER NOT NULL DEFAULT 0,"
                + "UNIQUE (square_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_links ("
                + "link_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id             INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "from_endpoint_id   INTEGER NOT NULL REFERENCES dungeon_endpoints(endpoint_id) ON DELETE CASCADE,"
                + "to_endpoint_id     INTEGER NOT NULL REFERENCES dungeon_endpoints(endpoint_id) ON DELETE CASCADE,"
                + "label              TEXT,"
                + "notes              TEXT,"
                + "CHECK (from_endpoint_id < to_endpoint_id),"
                + "UNIQUE (map_id, from_endpoint_id, to_endpoint_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_passages ("
                + "passage_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id       INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x            INTEGER NOT NULL,"
                + "y            INTEGER NOT NULL,"
                + "direction    TEXT NOT NULL CHECK(direction IN ('east','south')),"
                + "passage_type TEXT NOT NULL DEFAULT 'open',"
                + "name         TEXT,"
                + "notes        TEXT,"
                + "endpoint_id  INTEGER REFERENCES dungeon_endpoints(endpoint_id) ON DELETE SET NULL,"
                + "UNIQUE (map_id, x, y, direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_walls ("
                + "wall_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id       INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x            INTEGER NOT NULL,"
                + "y            INTEGER NOT NULL,"
                + "direction    TEXT NOT NULL CHECK(direction IN ('east','south')),"
                + "UNIQUE (map_id, x, y, direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_features ("
                + "feature_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id        INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "category      TEXT NOT NULL CHECK(category IN ('hazard','encounter','treasure','curiosity')),"
                + "encounter_id  INTEGER,"
                + "name          TEXT,"
                + "notes         TEXT"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_feature_tiles ("
                + "feature_id    INTEGER NOT NULL REFERENCES dungeon_features(feature_id) ON DELETE CASCADE,"
                + "square_id     INTEGER NOT NULL REFERENCES dungeon_squares(square_id) ON DELETE CASCADE,"
                + "PRIMARY KEY (feature_id, square_id)"
                + ")");
    }

    public static void createIndexes(Statement stmt) throws SQLException {
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_squares_map ON dungeon_squares(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_map ON dungeon_rooms(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_areas_map ON dungeon_areas(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_endpoints_map ON dungeon_endpoints(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_links_map ON dungeon_links(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_passages_map ON dungeon_passages(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_walls_map ON dungeon_walls(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_map ON dungeon_features(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_category ON dungeon_features(category)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_feature_tiles_square ON dungeon_feature_tiles(square_id)");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
            createIndexes(stmt);
        }
        ensureColumn(conn, "dungeon_endpoints", "role", "TEXT NOT NULL DEFAULT 'both'");
        ensureColumn(conn, "dungeon_endpoints", "is_default_entry", "INTEGER NOT NULL DEFAULT 0");
        clearInvalidDefaultEntries(conn);
        ensureColumn(conn, "dungeon_features", "encounter_id", "INTEGER");
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_encounter ON dungeon_features(encounter_id)");
        }
        normalizeDefaultEntryRoleCompatibility(conn);
        normalizePassageTopologyCompatibility(conn);
        normalizePassageTypeCompatibility(conn);
        normalizeWallTopologyCompatibility(conn);
    }

    private static void ensureColumn(Connection conn, String table, String column, String definition) throws SQLException {
        if (columnExists(conn, table, column)) {
            return;
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        }
    }

    private static boolean columnExists(Connection conn, String table, String column) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("PRAGMA table_info(" + table + ")");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                if (column.equalsIgnoreCase(rs.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static void normalizeDefaultEntryRoleCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("UPDATE dungeon_endpoints "
                    + "SET is_default_entry=0 "
                    + "WHERE is_default_entry=1 AND role='exit'");
        }
    }

    private static void clearInvalidDefaultEntries(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("UPDATE dungeon_endpoints "
                    + "SET is_default_entry=0 "
                    + "WHERE is_default_entry NOT IN (0,1)");
        }
    }

    private static void normalizePassageTopologyCompatibility(Connection conn) throws SQLException {
        for (Long mapId : loadMapIdsWithPassages(conn)) {
            DungeonPassageRepository.deleteInvalidPassages(conn, mapId);
        }
    }

    private static void normalizePassageTypeCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("UPDATE dungeon_passages SET passage_type='open' WHERE passage_type <> 'open'");
        }
    }

    private static void normalizeWallTopologyCompatibility(Connection conn) throws SQLException {
        for (Long mapId : loadMapIdsWithWalls(conn)) {
            DungeonWallRepository.deleteInvalidWalls(conn, mapId);
        }
    }

    private static java.util.List<Long> loadMapIdsWithPassages(Connection conn) throws SQLException {
        java.util.List<Long> mapIds = new java.util.ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT DISTINCT map_id FROM dungeon_passages");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                mapIds.add(rs.getLong(1));
            }
        }
        return mapIds;
    }

    private static java.util.List<Long> loadMapIdsWithWalls(Connection conn) throws SQLException {
        java.util.List<Long> mapIds = new java.util.ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT DISTINCT map_id FROM dungeon_walls");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                mapIds.add(rs.getLong(1));
            }
        }
        return mapIds;
    }
}
