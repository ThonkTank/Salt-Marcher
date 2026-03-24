package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonTransitionSchemaSupport {

    private DungeonTransitionSchemaSupport() {
        throw new AssertionError("No instances");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transitions ("
                    + "transition_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id           INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "description              TEXT,"
                    + "cell_x                   INTEGER,"
                    + "cell_y                   INTEGER,"
                    + "level_z                  INTEGER,"
                    + "destination_type         TEXT NOT NULL,"
                    + "target_overworld_map_id  INTEGER REFERENCES hex_maps(map_id) ON DELETE SET NULL,"
                    + "target_overworld_tile_id INTEGER REFERENCES hex_tiles(tile_id) ON DELETE SET NULL,"
                    + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                    + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                    + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                    + ")");
        }
    }
}
