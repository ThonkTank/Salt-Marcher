package features.creatures.adapter.sqlite.gateway.local;

import java.sql.ResultSet;
import java.sql.SQLException;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailVitalsRowMapper {

    CreatureDetailRecord.Vitals vitals(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Vitals(
                hitDice(resultSet),
                armor(resultSet),
                movement(resultSet),
                abilityScores(resultSet),
                proficiency(resultSet));
    }

    private CreatureDetailRecord.HitDice hitDice(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.HitDice(
                resultSet.getInt("hp"),
                resultSet.getString("hit_dice"),
                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_count"),
                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_sides"),
                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_modifier"));
    }

    private CreatureDetailRecord.Armor armor(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Armor(
                resultSet.getInt("ac"),
                resultSet.getString("ac_notes"));
    }

    private CreatureDetailRecord.Movement movement(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Movement(
                resultSet.getInt("speed"),
                resultSet.getInt("fly_speed"),
                resultSet.getInt("swim_speed"),
                resultSet.getInt("climb_speed"),
                resultSet.getInt("burrow_speed"));
    }

    private CreatureDetailRecord.AbilityScores abilityScores(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.AbilityScores(
                resultSet.getInt("str"),
                resultSet.getInt("dex"),
                resultSet.getInt("con"),
                resultSet.getInt("intel"),
                resultSet.getInt("wis"),
                resultSet.getInt("cha"));
    }

    private CreatureDetailRecord.Proficiency proficiency(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Proficiency(
                resultSet.getInt("initiative_bonus"),
                resultSet.getInt("proficiency_bonus"));
    }
}
