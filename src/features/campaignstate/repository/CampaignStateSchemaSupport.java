package features.campaignstate.repository;

import database.SchemaCompatibility;

import java.sql.Connection;
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
                + "dungeon_location_type TEXT,"
                + "dungeon_room_id     INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL,"
                + "dungeon_corridor_id INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE SET NULL,"
                + "dungeon_location_key TEXT,"
                + "dungeon_heading     TEXT"
                + ")");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
        }
        ensureColumn(conn, "campaign_state", "dungeon_map_id",
                "INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL");
        ensureColumn(conn, "campaign_state", "dungeon_location_type",
                "TEXT");
        ensureColumn(conn, "campaign_state", "dungeon_room_id",
                "INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL");
        ensureColumn(conn, "campaign_state", "dungeon_corridor_id",
                "INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE SET NULL");
        ensureColumn(conn, "campaign_state", "dungeon_location_key",
                "TEXT");
        ensureColumn(conn, "campaign_state", "dungeon_heading",
                "TEXT");
    }

    private static void ensureColumn(Connection conn, String table, String column, String definition) throws SQLException {
        SchemaCompatibility.ensureColumn(conn, table, column, definition);
    }
}
