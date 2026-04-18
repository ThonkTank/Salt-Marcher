package src.data.party.gateway.local;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class PartyRosterCharacterSqliteStore {

    private final PartyRosterSqliteValueBinder valueBinder = new PartyRosterSqliteValueBinder();

    List<PartyCharacterRecord> loadCharacters(Connection connection) throws SQLException {
        List<PartyCharacterRecord> characters = new ArrayList<>();
        String sql = "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " short_rests_taken_since_long_rest, passive_perception, ac, in_party FROM "
                + PartyPersistenceSchema.PLAYER_CHARACTERS.name()
                + " ORDER BY id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                characters.add(new PartyCharacterRecord(
                        resultSet.getLong("id"),
                        resultSet.getString("name"),
                        resultSet.getString("player_name"),
                        resultSet.getInt("level"),
                        resultSet.getInt("current_xp"),
                        resultSet.getInt("xp_since_long_rest"),
                        resultSet.getInt("xp_since_short_rest"),
                        resultSet.getInt("short_rests_taken_since_long_rest"),
                        resultSet.getInt("passive_perception"),
                        resultSet.getInt("ac"),
                        resultSet.getInt("in_party") == 1 ? "ACTIVE" : "RESERVE"));
            }
        }
        return characters;
    }

    void deleteMissingCharacters(Connection connection, List<PartyCharacterRecord> characters) throws SQLException {
        Set<Long> idsToKeep = new HashSet<>();
        for (PartyCharacterRecord character : characters) {
            idsToKeep.add(character.id());
        }

        List<Long> idsToDelete = new ArrayList<>();
        String loadIdsSql = "SELECT id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
        try (PreparedStatement statement = connection.prepareStatement(loadIdsSql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                long id = resultSet.getLong("id");
                if (!idsToKeep.contains(id)) {
                    idsToDelete.add(id);
                }
            }
        }

        if (idsToDelete.isEmpty()) {
            return;
        }
        String deleteSql = "DELETE FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + " WHERE id = ?";
        try (PreparedStatement delete = connection.prepareStatement(deleteSql)) {
            for (Long id : idsToDelete) {
                delete.setLong(1, id);
                delete.addBatch();
            }
            delete.executeBatch();
        }
    }

    void upsertCharacters(Connection connection, List<PartyCharacterRecord> characters) throws SQLException {
        if (characters.isEmpty()) {
            return;
        }
        String sql = "INSERT INTO " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + "("
                + "id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " short_rests_taken_since_long_rest, passive_perception, ac, in_party)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?,?)"
                + " ON CONFLICT(id) DO UPDATE SET"
                + " name = excluded.name,"
                + " player_name = excluded.player_name,"
                + " level = excluded.level,"
                + " current_xp = excluded.current_xp,"
                + " xp_since_long_rest = excluded.xp_since_long_rest,"
                + " xp_since_short_rest = excluded.xp_since_short_rest,"
                + " short_rests_taken_since_long_rest = excluded.short_rests_taken_since_long_rest,"
                + " passive_perception = excluded.passive_perception,"
                + " ac = excluded.ac,"
                + " in_party = excluded.in_party";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (PartyCharacterRecord character : characters) {
                valueBinder.bindCharacter(statement, character);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }
}
