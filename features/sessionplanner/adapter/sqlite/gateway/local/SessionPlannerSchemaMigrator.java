package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import platform.persistence.SqliteSchemaColumnSupport;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlannerSchemaMigrator {

    private static final String ALTER_TABLE = "ALTER TABLE ";
    private static final String ADD_COLUMN = " ADD COLUMN ";

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PLANS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_CURRENT_SESSION_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PARTICIPANTS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_ENCOUNTERS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_RESTS_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_LOOT_PLACEHOLDERS_SQL);
            if (!SqliteSchemaColumnSupport.hasColumn(
                    connection,
                    SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE,
                    SessionPlannerPersistenceSchema.SESSION_LOOT_ENCOUNTER_ID_COLUMN)) {
                statement.execute(ALTER_TABLE
                        + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE
                        + ADD_COLUMN
                        + SessionPlannerPersistenceSchema.SESSION_LOOT_ENCOUNTER_ID_COLUMN
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
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL);
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
                    + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE
                    + " legacy ORDER BY legacy.session_id, legacy.sort_order, legacy.loot_id");
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_MANUAL_LOOT_NOTES_ORDER_INDEX_SQL);
        }
    }

    void repairTargetSchema(Connection connection) throws SQLException {
        ensureSchema(connection);
        addGeneratedRewards(connection);
        try (Statement statement = connection.createStatement()) {
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_MANUAL_LOOT_NOTES_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_MANUAL_LOOT_NOTES_ORDER_INDEX_SQL);
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
