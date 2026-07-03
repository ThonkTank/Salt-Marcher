package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

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
