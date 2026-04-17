package src.data.creatures.datasource.local;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureDetail;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class CreatureDetailSqliteStore {

    @Nullable CreatureDetail loadCreatureDetail(Connection connection, long creatureId) throws SQLException {
        String sql = "SELECT id, name, size, creature_type, alignment, cr, xp, hp, hit_dice, hit_dice_count, "
                + "hit_dice_sides, hit_dice_modifier, ac, ac_notes, speed, fly_speed, swim_speed, climb_speed, "
                + "burrow_speed, str, dex, con, intel, wis, cha, initiative_bonus, proficiency_bonus, "
                + "saving_throws, skills, damage_vulnerabilities, damage_resistances, damage_immunities, "
                + "condition_immunities, senses, passive_perception, languages, legendary_action_count "
                + "FROM creatures WHERE id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                return new CreatureDetail(
                        resultSet.getLong("id"),
                        resultSet.getString("name"),
                        resultSet.getString("size"),
                        resultSet.getString("creature_type"),
                        loadStringValues(connection, "creature_subtypes", "subtype", creatureId),
                        loadStringValues(connection, "creature_biomes", "biome", creatureId),
                        resultSet.getString("alignment"),
                        resultSet.getString("cr"),
                        resultSet.getInt("xp"),
                        resultSet.getInt("hp"),
                        resultSet.getString("hit_dice"),
                        CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_count"),
                        CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_sides"),
                        CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_modifier"),
                        resultSet.getInt("ac"),
                        resultSet.getString("ac_notes"),
                        resultSet.getInt("speed"),
                        resultSet.getInt("fly_speed"),
                        resultSet.getInt("swim_speed"),
                        resultSet.getInt("climb_speed"),
                        resultSet.getInt("burrow_speed"),
                        resultSet.getInt("str"),
                        resultSet.getInt("dex"),
                        resultSet.getInt("con"),
                        resultSet.getInt("intel"),
                        resultSet.getInt("wis"),
                        resultSet.getInt("cha"),
                        resultSet.getInt("initiative_bonus"),
                        resultSet.getInt("proficiency_bonus"),
                        resultSet.getString("saving_throws"),
                        resultSet.getString("skills"),
                        resultSet.getString("damage_vulnerabilities"),
                        resultSet.getString("damage_resistances"),
                        resultSet.getString("damage_immunities"),
                        resultSet.getString("condition_immunities"),
                        resultSet.getString("senses"),
                        resultSet.getInt("passive_perception"),
                        resultSet.getString("languages"),
                        resultSet.getInt("legendary_action_count"),
                        loadActions(connection, creatureId));
            }
        }
    }

    private List<String> loadStringValues(Connection connection, String tableName, String columnName, long creatureId)
            throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT " + columnName + " FROM " + tableName + " WHERE creature_id = ? ORDER BY " + columnName;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    values.add(resultSet.getString(1));
                }
            }
        }
        return values;
    }

    private List<CreatureActionDetail> loadActions(Connection connection, long creatureId) throws SQLException {
        List<CreatureActionDetail> actions = new ArrayList<>();
        String sql = "SELECT action_type, name, description, to_hit_bonus FROM creature_actions WHERE creature_id = ? "
                + "ORDER BY CASE action_type "
                + "WHEN 'trait' THEN 0 "
                + "WHEN 'action' THEN 1 "
                + "WHEN 'bonus_action' THEN 2 "
                + "WHEN 'reaction' THEN 3 "
                + "WHEN 'legendary_action' THEN 4 "
                + "ELSE 5 END, name";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    actions.add(new CreatureActionDetail(
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
