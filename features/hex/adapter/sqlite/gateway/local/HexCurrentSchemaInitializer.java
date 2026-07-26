package features.hex.adapter.sqlite.gateway.local;

import features.hex.adapter.sqlite.model.HexPersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Direct initializer for the only supported Hex persistence schema. */
final class HexCurrentSchemaInitializer {

    void initializeCurrent(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : HexPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : HexPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table','index','view','trigger') "
                             + "AND (name GLOB 'hex_*' OR name GLOB 'idx_hex_*' "
                             + "OR name GLOB 'sm_hex_*') LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Hex owner namespace is not empty.");
            }
        }
    }
}
