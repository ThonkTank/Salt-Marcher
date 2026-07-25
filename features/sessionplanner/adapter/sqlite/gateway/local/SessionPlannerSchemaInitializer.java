package features.sessionplanner.adapter.sqlite.gateway.local;

import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

final class SessionPlannerSchemaInitializer {

    void initializeCurrentTargetSchema(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : SessionPlannerPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : SessionPlannerPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') "
                             + "AND name GLOB 'session_planner_*' LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Session Planner owner namespace is not empty.");
            }
        }
    }
}
