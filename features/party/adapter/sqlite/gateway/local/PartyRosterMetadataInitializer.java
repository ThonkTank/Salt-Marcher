package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

final class PartyRosterMetadataInitializer {

    private static final String INITIALIZE_NEXT_CHARACTER_ID_SQL =
            "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                    + " SET next_character_id = MAX(next_character_id, ?) WHERE singleton_id = 1";
    private static final String QUERY_MAX_CHARACTER_ID_SQL =
            "SELECT COALESCE(MAX(id), 0) AS max_id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();

    void initializeNextCharacterId(Connection connection) throws SQLException {
        long nextId = queryMaxCharacterId(connection) + 1L;
        try (PreparedStatement statement = connection.prepareStatement(INITIALIZE_NEXT_CHARACTER_ID_SQL)) {
            statement.setLong(1, Math.max(1L, nextId));
            statement.executeUpdate();
        }
    }

    private long queryMaxCharacterId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(QUERY_MAX_CHARACTER_ID_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            return resultSet.next() ? resultSet.getLong("max_id") : 0L;
        }
    }
}
