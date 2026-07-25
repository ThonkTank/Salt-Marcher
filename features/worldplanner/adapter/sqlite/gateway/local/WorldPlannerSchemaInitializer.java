package features.worldplanner.adapter.sqlite.gateway.local;

import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Creates the only supported World Planner schema on an empty owner namespace. */
final class WorldPlannerSchemaInitializer {

    void initializeCurrent(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String sql : WorldPlannerPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            for (String sql : WorldPlannerPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') "
                             + "AND (name GLOB 'world_planner_*' "
                             + "OR name GLOB 'idx_world_planner_*') LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("World Planner owner namespace is not empty.");
            }
        }
    }
}
