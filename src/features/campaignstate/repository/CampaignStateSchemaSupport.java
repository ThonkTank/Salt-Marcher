package features.campaignstate.repository;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Owns the current campaign_state schema shape.
 *
 * <p>Repository-wide schema resets remain the migration mechanism, so this seam creates the live table definition
 * but does not translate older campaign_state location shapes in place.
 */
public final class CampaignStateSchemaSupport {

    private CampaignStateSchemaSupport() {
        throw new AssertionError("No instances");
    }

    private static void createSchema(Statement stmt) throws SQLException {
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
                + "dungeon_level_z     INTEGER,"
                + "dungeon_cell_x      INTEGER,"
                + "dungeon_cell_y      INTEGER,"
                + "dungeon_heading     TEXT"
                + ")");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
        }
    }
}
