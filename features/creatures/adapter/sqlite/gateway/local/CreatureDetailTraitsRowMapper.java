package features.creatures.adapter.sqlite.gateway.local;

import java.sql.ResultSet;
import java.sql.SQLException;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailTraitsRowMapper {

    CreatureDetailRecord.Traits traits(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Traits(
                traitProficiencies(resultSet),
                defenses(resultSet),
                awareness(resultSet),
                resultSet.getInt("legendary_action_count"));
    }

    private CreatureDetailRecord.TraitProficiencies traitProficiencies(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.TraitProficiencies(
                resultSet.getString("saving_throws"),
                resultSet.getString("skills"));
    }

    private CreatureDetailRecord.Defenses defenses(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Defenses(
                resultSet.getString("damage_vulnerabilities"),
                resultSet.getString("damage_resistances"),
                resultSet.getString("damage_immunities"),
                resultSet.getString("condition_immunities"));
    }

    private CreatureDetailRecord.Awareness awareness(ResultSet resultSet) throws SQLException {
        return new CreatureDetailRecord.Awareness(
                resultSet.getString("senses"),
                resultSet.getInt("passive_perception"),
                resultSet.getString("languages"));
    }
}
