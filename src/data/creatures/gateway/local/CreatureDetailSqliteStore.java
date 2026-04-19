package src.data.creatures.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureActionRecord;
import src.data.creatures.model.CreatureDetailRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class CreatureDetailSqliteStore {

    private static final String LOAD_CREATURE_DETAIL_SQL =
            "SELECT id, name, size, creature_type, alignment, cr, xp, hp, hit_dice, hit_dice_count, "
                    + "hit_dice_sides, hit_dice_modifier, ac, ac_notes, speed, fly_speed, swim_speed, climb_speed, "
                    + "burrow_speed, str, dex, con, intel, wis, cha, initiative_bonus, proficiency_bonus, "
                    + "saving_throws, skills, damage_vulnerabilities, damage_resistances, damage_immunities, "
                    + "condition_immunities, senses, passive_perception, languages, legendary_action_count "
                    + "FROM creatures WHERE id = ?";
    private static final String LOAD_CREATURE_ACTIONS_SQL =
            "SELECT action_type, name, description, to_hit_bonus FROM creature_actions WHERE creature_id = ? "
                    + "ORDER BY CASE action_type "
                    + "WHEN 'trait' THEN 0 "
                    + "WHEN 'action' THEN 1 "
                    + "WHEN 'bonus_action' THEN 2 "
                    + "WHEN 'reaction' THEN 3 "
                    + "WHEN 'legendary_action' THEN 4 "
                    + "ELSE 5 END, name";

    private final CreatureDetailStringValuesSqliteStore stringValuesStore =
            new CreatureDetailStringValuesSqliteStore();
    private final CreatureDetailRowMapper rowMapper = new CreatureDetailRowMapper(stringValuesStore);

    @Nullable CreatureDetailRecord loadCreatureDetail(Connection connection, long creatureId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CREATURE_DETAIL_SQL)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return rowMapper.toRecord(
                        connection,
                        resultSet,
                        creatureId,
                        loadActions(connection, creatureId));
            }
        }
    }

    private List<CreatureActionRecord> loadActions(Connection connection, long creatureId) throws SQLException {
        List<CreatureActionRecord> actions = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CREATURE_ACTIONS_SQL)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    actions.add(new CreatureActionRecord(
                            resultSet.getString("action_type"),
                            resultSet.getString("name"),
                            resultSet.getString("description"),
                            CreaturesSqliteQuerySupport.getNullableInt(resultSet, "to_hit_bonus")));
                }
            }
        }
        return actions;
    }
}
