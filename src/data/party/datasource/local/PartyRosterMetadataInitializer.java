package src.data.party.datasource.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

final class PartyRosterMetadataInitializer {

    void initializeNextCharacterId(Connection connection) throws SQLException {
        long nextId = queryMaxCharacterId(connection) + 1L;
        String sql = "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                + " SET next_character_id = MAX(next_character_id, ?) WHERE singleton_id = 1";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, Math.max(1L, nextId));
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
