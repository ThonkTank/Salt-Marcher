package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyPersistenceSchema;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Creates the only supported Party schema on an empty owner namespace. */
final class PartySchemaInitializer {

    void initializeCurrent(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String sql : PartyPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') "
                             + "AND (name GLOB 'player_characters*' "
                             + "OR name GLOB 'party_roster_metadata*') LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Party owner namespace is not empty.");
            }
        }
    }
}
