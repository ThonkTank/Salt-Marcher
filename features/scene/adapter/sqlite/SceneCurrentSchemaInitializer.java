package features.scene.adapter.sqlite;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Direct initializer for the only supported Scene persistence schema. */
final class SceneCurrentSchemaInitializer {

    void initializeCurrent(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : ScenePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : ScenePersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table','index','view','trigger') "
                             + "AND (name GLOB 'scene_*' OR name GLOB 'idx_scene_*') LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Scene owner namespace is not empty.");
            }
        }
    }
}
