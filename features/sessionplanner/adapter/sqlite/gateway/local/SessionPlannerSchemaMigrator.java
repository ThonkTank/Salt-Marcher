package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import platform.persistence.SqliteSchemaColumnSupport;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlannerSchemaMigrator {

    private static final String ALTER_TABLE = "ALTER TABLE ";
    private static final String ADD_COLUMN = " ADD COLUMN ";
    private static final String LEGACY_LOOT_TABLE = "session_planner_loot_placeholders";
    private static final String LEGACY_LOOT_ORDER_INDEX = "idx_session_planner_loot_order";
    private static final String LEGACY_LOOT_ENCOUNTER_COLUMN = "encounter_id";

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PLANS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_CURRENT_SESSION_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PARTICIPANTS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_ENCOUNTERS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_RESTS_SQL);
            if (SqliteSchemaColumnSupport.hasTable(connection, LEGACY_LOOT_TABLE)
                    && !SqliteSchemaColumnSupport.hasColumn(
                    connection,
                    LEGACY_LOOT_TABLE,
                    LEGACY_LOOT_ENCOUNTER_COLUMN)) {
                statement.execute(ALTER_TABLE
                        + LEGACY_LOOT_TABLE
                        + ADD_COLUMN
                        + LEGACY_LOOT_ENCOUNTER_COLUMN
                        + " INTEGER NOT NULL DEFAULT 0");
            }
            if (!SqliteSchemaColumnSupport.hasColumn(
                    connection,
                    SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE,
                    "display_name")) {
                statement.execute(ALTER_TABLE
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + ADD_COLUMN
                        + "display_name TEXT NOT NULL DEFAULT ''");
            }
            addSceneTitleColumnIfMissing(connection, statement);
            addSceneNotesColumnIfMissing(connection, statement);
            addLocationIdColumnIfMissing(connection, statement);
            statement.execute("UPDATE "
                    + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                    + " SET display_name = 'Session #' || session_id WHERE TRIM(display_name) = ''");
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_RESTS_ORDER_INDEX_SQL);
        }
    }

    void addGeneratedRewards(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_GENERATED_REWARDS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_GENERATED_REWARDS_ORDER_INDEX_SQL);
        }
    }

    void addRevisionAndManualLootNotes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            if (!SqliteSchemaColumnSupport.hasColumn(
                    connection,
                    SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE,
                    "revision")) {
                statement.execute(ALTER_TABLE
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + ADD_COLUMN
                        + "revision INTEGER NOT NULL DEFAULT 1");
            }
            statement.execute("UPDATE " + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                    + " SET revision = 1 WHERE revision < 1");
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_MANUAL_LOOT_NOTES_SQL);
            if (SqliteSchemaColumnSupport.hasTable(connection, LEGACY_LOOT_TABLE)) {
                statement.execute("INSERT INTO "
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " (session_id, note_id, scene_id, note_text, sort_order) "
                        + "SELECT legacy.session_id, legacy.loot_id, "
                        + "CASE WHEN legacy.encounter_id > 0 THEN legacy.encounter_id ELSE ("
                        + "SELECT scene.encounter_id FROM "
                        + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                        + " scene WHERE scene.session_id = legacy.session_id "
                        + "ORDER BY scene.sort_order, scene.encounter_id LIMIT 1) END, "
                        + "legacy.label, legacy.sort_order FROM "
                        + LEGACY_LOOT_TABLE
                        + " legacy ORDER BY legacy.session_id, legacy.sort_order, legacy.loot_id");
            }
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_MANUAL_LOOT_NOTES_ORDER_INDEX_SQL);
        }
    }

    void retireLegacyManualLoot(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP INDEX IF EXISTS " + LEGACY_LOOT_ORDER_INDEX);
            statement.execute("DROP TABLE IF EXISTS " + LEGACY_LOOT_TABLE);
        }
    }

    private static void addSceneTitleColumnIfMissing(Connection connection, Statement statement) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(
                connection,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_SCENE_TITLE_COLUMN)) {
            statement.execute(ALTER_TABLE
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                    + ADD_COLUMN
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_SCENE_TITLE_COLUMN
                    + " TEXT NOT NULL DEFAULT ''");
        }
    }

    private static void addSceneNotesColumnIfMissing(Connection connection, Statement statement) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(
                connection,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_SCENE_NOTES_COLUMN)) {
            statement.execute(ALTER_TABLE
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                    + ADD_COLUMN
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_SCENE_NOTES_COLUMN
                    + " TEXT NOT NULL DEFAULT ''");
        }
    }

    private static void addLocationIdColumnIfMissing(Connection connection, Statement statement) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(
                connection,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_LOCATION_ID_COLUMN)) {
            statement.execute(ALTER_TABLE
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                    + ADD_COLUMN
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTER_LOCATION_ID_COLUMN
                    + " INTEGER NOT NULL DEFAULT 0");
        }
    }
}
