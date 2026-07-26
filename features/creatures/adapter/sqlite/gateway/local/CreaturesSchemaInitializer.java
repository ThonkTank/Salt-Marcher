package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Creates the one current pre-completion Creatures schema from an empty owner namespace. */
final class CreaturesSchemaInitializer {

    void initializeCurrentTarget(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : CreaturesPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : CreaturesPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') AND ("
                             + "name GLOB 'creatures*' OR name GLOB 'creature_*' "
                             + "OR name GLOB 'idx_creatures_*' OR name GLOB 'idx_creature_*') "
                             + "LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Creatures owner namespace is not empty.");
            }
        }
    }
}
