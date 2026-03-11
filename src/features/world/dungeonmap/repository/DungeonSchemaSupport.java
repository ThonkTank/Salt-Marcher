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
                + "encounter_table_id  INTEGER REFERENCES encounter_tables(table_id)"
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
    }

    public static void createIndexes(Statement stmt) throws SQLException {
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_squares_map ON dungeon_squares(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_map ON dungeon_rooms(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_areas_map ON dungeon_areas(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_endpoints_map ON dungeon_endpoints(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_links_map ON dungeon_links(map_id)");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
            createIndexes(stmt);
        }
        ensureColumn(conn, "campaign_state", "dungeon_map_id",
                "INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL");
        ensureColumn(conn, "campaign_state", "dungeon_endpoint_id",
                "INTEGER REFERENCES dungeon_endpoints(endpoint_id) ON DELETE SET NULL");
        ensureCampaignStateDungeonForeignKeys(conn);
    }

    private static void ensureCampaignStateDungeonForeignKeys(Connection conn) throws SQLException {
        if (!campaignStateDungeonForeignKeysNeedRebuild(conn)) {
            return;
        }

        boolean previousAutoCommit = conn.getAutoCommit();
        try {
            conn.setAutoCommit(false);
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = OFF");
                stmt.execute("ALTER TABLE campaign_state RENAME TO campaign_state_old");
                stmt.execute("CREATE TABLE campaign_state ("
                        + "campaign_id         INTEGER PRIMARY KEY DEFAULT 1,"
                        + "map_id              INTEGER REFERENCES hex_maps(map_id),"
                        + "party_tile_id       INTEGER REFERENCES hex_tiles(tile_id),"
                        + "calendar_id         INTEGER REFERENCES calendar_config(calendar_id),"
                        + "current_epoch_day   INTEGER NOT NULL DEFAULT 0,"
                        + "current_phase_id    INTEGER REFERENCES time_of_day_phases(phase_id),"
                        + "current_weather     TEXT,"
                        + "notes               TEXT,"
                        + "dungeon_map_id      INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                        + "dungeon_endpoint_id INTEGER REFERENCES dungeon_endpoints(endpoint_id) ON DELETE SET NULL"
                        + ")");
                stmt.execute("INSERT INTO campaign_state("
                        + "campaign_id, map_id, party_tile_id, calendar_id, current_epoch_day, current_phase_id, "
                        + "current_weather, notes, dungeon_map_id, dungeon_endpoint_id"
                        + ") SELECT "
                        + "campaign_id, map_id, party_tile_id, calendar_id, current_epoch_day, current_phase_id, "
                        + "current_weather, notes, dungeon_map_id, dungeon_endpoint_id "
                        + "FROM campaign_state_old");
                stmt.execute("DROP TABLE campaign_state_old");
                stmt.execute("PRAGMA foreign_keys = ON");
            }
            conn.commit();
        } catch (SQLException ex) {
            conn.rollback();
            throw ex;
        } finally {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = ON");
            }
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    private static boolean campaignStateDungeonForeignKeysNeedRebuild(Connection conn) throws SQLException {
        boolean mapNeedsSetNull = false;
        boolean endpointNeedsSetNull = false;
        try (PreparedStatement ps = conn.prepareStatement("PRAGMA foreign_key_list(campaign_state)");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String from = rs.getString("from");
                String onDelete = rs.getString("on_delete");
                if ("dungeon_map_id".equalsIgnoreCase(from)) {
                    mapNeedsSetNull = !"SET NULL".equalsIgnoreCase(onDelete);
                } else if ("dungeon_endpoint_id".equalsIgnoreCase(from)) {
                    endpointNeedsSetNull = !"SET NULL".equalsIgnoreCase(onDelete);
                }
            }
        }
        return mapNeedsSetNull || endpointNeedsSetNull;
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
}
