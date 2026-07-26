package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

final class PartyRosterMetadataSqliteStore {

    private static final String LOAD_NEXT_CHARACTER_ID_SQL =
            "SELECT next_character_id FROM " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                    + " WHERE singleton_id = 1";
    private static final String SAVE_NEXT_CHARACTER_ID_SQL =
            "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                    + " SET next_character_id = ? WHERE singleton_id = 1";
    long loadNextCharacterId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_NEXT_CHARACTER_ID_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            if (resultSet.next()) {
                return Math.max(1L, resultSet.getLong("next_character_id"));
            }
        }
        throw new SQLException("Party roster metadata row is missing.");
    }

    void saveNextCharacterId(Connection connection, long nextCharacterId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SAVE_NEXT_CHARACTER_ID_SQL)) {
            statement.setLong(1, Math.max(1L, nextCharacterId));
            if (statement.executeUpdate() != 1) {
                throw new SQLException("Party roster metadata row is missing.");
            }
        }
    }
}
