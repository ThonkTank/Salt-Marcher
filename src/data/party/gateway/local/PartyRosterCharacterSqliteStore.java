package src.data.party.gateway.local;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyPersistenceSchema;

import org.jspecify.annotations.Nullable;

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
                    + " short_rests_taken_since_long_rest, passive_perception, ac, in_party,"
                    + " travel_location_kind, travel_dungeon_map_id, travel_dungeon_location_kind,"
                    + " travel_dungeon_owner_id, travel_dungeon_q, travel_dungeon_r, travel_dungeon_level,"
                    + " travel_dungeon_heading, travel_overworld_map_id, travel_overworld_tile_id,"
                    + " attached_to_party_token FROM "
                    + PartyPersistenceSchema.PLAYER_CHARACTERS.name()
                    + " ORDER BY id";
    private static final String LOAD_CHARACTER_IDS_SQL =
            "SELECT id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
    private static final String DELETE_CHARACTER_SQL =
            "DELETE FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + " WHERE id = ?";
    private static final String UPSERT_CHARACTER_SQL =
            "INSERT INTO " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + "("
                    + "id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                    + " short_rests_taken_since_long_rest, passive_perception, ac, in_party,"
                    + " travel_location_kind, travel_dungeon_map_id, travel_dungeon_location_kind,"
                    + " travel_dungeon_owner_id, travel_dungeon_q, travel_dungeon_r, travel_dungeon_level,"
                    + " travel_dungeon_heading, travel_overworld_map_id, travel_overworld_tile_id,"
                    + " attached_to_party_token)"
                    + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
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
                    + " in_party = excluded.in_party,"
                    + " travel_location_kind = excluded.travel_location_kind,"
                    + " travel_dungeon_map_id = excluded.travel_dungeon_map_id,"
                    + " travel_dungeon_location_kind = excluded.travel_dungeon_location_kind,"
                    + " travel_dungeon_owner_id = excluded.travel_dungeon_owner_id,"
                    + " travel_dungeon_q = excluded.travel_dungeon_q,"
                    + " travel_dungeon_r = excluded.travel_dungeon_r,"
                    + " travel_dungeon_level = excluded.travel_dungeon_level,"
                    + " travel_dungeon_heading = excluded.travel_dungeon_heading,"
                    + " travel_overworld_map_id = excluded.travel_overworld_map_id,"
                    + " travel_overworld_tile_id = excluded.travel_overworld_tile_id,"
                    + " attached_to_party_token = excluded.attached_to_party_token";

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
                        resultSet.getInt("in_party") == 1 ? "ACTIVE" : "RESERVE",
                        new PartyCharacterRecord.Travel(
                                resultSet.getString("travel_location_kind"),
                                nullableLong(resultSet, "travel_dungeon_map_id"),
                                resultSet.getString("travel_dungeon_location_kind"),
                                nullableLong(resultSet, "travel_dungeon_owner_id"),
                                nullableInteger(resultSet, "travel_dungeon_q"),
                                nullableInteger(resultSet, "travel_dungeon_r"),
                                nullableInteger(resultSet, "travel_dungeon_level"),
                                resultSet.getString("travel_dungeon_heading"),
                                nullableLong(resultSet, "travel_overworld_map_id"),
                                nullableLong(resultSet, "travel_overworld_tile_id"),
                                resultSet.getInt("attached_to_party_token") == 1)));
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

    private static @Nullable Long nullableLong(ResultSet resultSet, String columnName) throws SQLException {
        long value = resultSet.getLong(columnName);
        return resultSet.wasNull() ? null : value;
    }

    private static @Nullable Integer nullableInteger(ResultSet resultSet, String columnName) throws SQLException {
        int value = resultSet.getInt(columnName);
        return resultSet.wasNull() ? null : value;
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
