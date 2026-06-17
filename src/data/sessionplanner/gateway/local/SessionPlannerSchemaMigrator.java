package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

final class SessionPlannerSchemaMigrator {

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
                    SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE,
                    "display_name")) {
                statement.execute("ALTER TABLE "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
            }
            statement.execute("UPDATE "
                    + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                    + " SET display_name = 'Session #' || session_id WHERE TRIM(display_name) = ''");
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_RESTS_ORDER_INDEX_SQL);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL);
        }
    }
}
