package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class PartyRosterSchemaTableManager {

    void createBaseTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(PartyPersistenceSchema.CREATE_PLAYER_CHARACTERS_TABLE_SQL);
            statement.execute(PartyPersistenceSchema.CREATE_PARTY_ROSTER_METADATA_TABLE_SQL);
            statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
        }
    }
}
