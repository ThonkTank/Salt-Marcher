package src.data.party.datasource.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

final class PartyRosterMetadataSqliteStore {

    long loadNextCharacterId(Connection connection) throws SQLException {
        String sql = "SELECT next_character_id FROM " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                + " WHERE singleton_id = 1";
        try (PreparedStatement statement = connection.prepareStatement(sql);
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
        String sql = "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                + " SET next_character_id = ? WHERE singleton_id = 1";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, Math.max(1L, nextCharacterId));
            statement.executeUpdate();
        }
    }

    private long queryMaxCharacterId(Connection connection) throws SQLException {
        String sql = "SELECT COALESCE(MAX(id), 0) AS max_id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            return resultSet.next() ? resultSet.getLong("max_id") : 0L;
        }
    }
}
