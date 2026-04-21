package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;

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
    private static final String QUERY_MAX_CHARACTER_ID_SQL =
            "SELECT COALESCE(MAX(id), 0) AS max_id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();

    long loadNextCharacterId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_NEXT_CHARACTER_ID_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            if (resultSet.next()) {
                return Math.max(1L, resultSet.getLong("next_character_id"));
            }
        }
        long nextId = queryMaxCharacterId(connection) + 1L;
        saveNextCharacterId(connection, nextId);
        return Math.max(1L, nextId);
    }

    void saveNextCharacterId(Connection connection, long nextCharacterId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SAVE_NEXT_CHARACTER_ID_SQL)) {
            statement.setLong(1, Math.max(1L, nextCharacterId));
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
