package features.encounter.repository;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Encounter-specific schema support for persisted encounter snapshots.
 */
public final class EncounterSchemaSupport {

    private EncounterSchemaSupport() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS encounters ("
                + "encounter_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL,"
                + "difficulty     TEXT,"
                + "average_level  INTEGER NOT NULL DEFAULT 1,"
                + "party_size     INTEGER NOT NULL DEFAULT 1,"
                + "xp_budget      INTEGER NOT NULL DEFAULT 0,"
                + "shape_label    TEXT,"
                + "created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS encounter_slots ("
                + "encounter_slot_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "encounter_id            INTEGER NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,"
                + "display_order           INTEGER NOT NULL,"
                + "creature_id             INTEGER NOT NULL,"
                + "creature_name           TEXT NOT NULL,"
                + "creature_xp             INTEGER NOT NULL DEFAULT 0,"
                + "creature_hp             INTEGER NOT NULL DEFAULT 0,"
                + "hit_dice_count          INTEGER,"
                + "hit_dice_sides          INTEGER,"
                + "hit_dice_modifier       INTEGER,"
                + "creature_ac             INTEGER NOT NULL DEFAULT 0,"
                + "initiative_bonus        INTEGER NOT NULL DEFAULT 0,"
                + "cr_display              TEXT,"
                + "creature_type           TEXT,"
                + "count                   INTEGER NOT NULL DEFAULT 1,"
                + "weight_class            TEXT,"
                + "primary_function_role   TEXT"
                + ")");
    }

    public static void createIndexes(Statement stmt) throws SQLException {
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_slots_encounter ON encounter_slots(encounter_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_slots_order ON encounter_slots(encounter_id, display_order)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounters_created_at ON encounters(created_at)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounters_name ON encounters(name)");
    }

    public static void ensureCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createSchema(stmt);
            createIndexes(stmt);
        }
    }
}
