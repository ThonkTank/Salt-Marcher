package features.encountertable.adapter.sqlite.gateway.local;

import features.encountertable.adapter.sqlite.model.EncounterTablePersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Direct initializer for the only supported Encounter Table persistence schema. */
final class EncounterTableCurrentSchemaInitializer {

    void initializeCurrent(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : EncounterTablePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : EncounterTablePersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table','index','view','trigger') "
                             + "AND (name GLOB 'encounter_table*' "
                             + "OR name GLOB 'idx_encounter_table*') LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Encounter Table owner namespace is not empty.");
            }
        }
    }
}
