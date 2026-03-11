package features.campaignstate.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Owns schema creation and compatibility work for the campaign_state aggregate.
 */
public final class CampaignStateSchemaSupport {

    private CampaignStateSchemaSupport() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS campaign_state ("
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
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
        }
        ensureColumn(conn, "campaign_state", "dungeon_map_id",
                "INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL");
        ensureColumn(conn, "campaign_state", "dungeon_endpoint_id",
                "INTEGER REFERENCES dungeon_endpoints(endpoint_id) ON DELETE SET NULL");
        ensureDungeonForeignKeys(conn);
    }

    private static void ensureDungeonForeignKeys(Connection conn) throws SQLException {
        if (!dungeonForeignKeysNeedRebuild(conn)) {
            return;
        }

        boolean previousAutoCommit = conn.getAutoCommit();
        try {
            conn.setAutoCommit(false);
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = OFF");
                stmt.execute("ALTER TABLE campaign_state RENAME TO campaign_state_old");
                createSchema(stmt);
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

    private static boolean dungeonForeignKeysNeedRebuild(Connection conn) throws SQLException {
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
