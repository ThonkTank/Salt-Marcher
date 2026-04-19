package src.data.party.gateway.local;

import src.data.party.model.PartyCharacterRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class PartyRosterCharacterSqliteStore {

    private static final String LOAD_CHARACTERS_SQL =
            "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                    + " short_rests_taken_since_long_rest, passive_perception, ac, in_party FROM player_characters"
                    + " ORDER BY id";
    private static final String LOAD_CHARACTER_IDS_SQL =
            "SELECT id FROM player_characters";
    private static final String DELETE_CHARACTER_SQL =
            "DELETE FROM player_characters WHERE id = ?";
    private static final String UPSERT_CHARACTER_SQL =
            "INSERT INTO player_characters("
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

    private final PartyRosterSqliteValueBinder valueBinder = new PartyRosterSqliteValueBinder();

    List<PartyCharacterRecord> loadCharacters(Connection connection) throws SQLException {
        List<PartyCharacterRecord> characters = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CHARACTERS_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                characters.add(new PartyCharacterRecord(
                        resultSet.getLong("id"),
                        new PartyCharacterRecord.Identity(
                                resultSet.getString("name"),
                                resultSet.getString("player_name")),
                        new PartyCharacterRecord.Progress(
                                resultSet.getInt("level"),
                                resultSet.getInt("current_xp"),
                                resultSet.getInt("xp_since_long_rest"),
                                resultSet.getInt("xp_since_short_rest"),
                                resultSet.getInt("short_rests_taken_since_long_rest")),
                        new PartyCharacterRecord.Combat(
                                resultSet.getInt("passive_perception"),
                                resultSet.getInt("ac")),
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
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CHARACTER_IDS_SQL);
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
        try (PreparedStatement delete = connection.prepareStatement(DELETE_CHARACTER_SQL)) {
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
        try (PreparedStatement statement = connection.prepareStatement(UPSERT_CHARACTER_SQL)) {
            for (PartyCharacterRecord character : characters) {
                valueBinder.bindCharacter(statement, character);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }
}
