package src.data.creatures.gateway.local;

import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class EncounterCandidateSqliteStore {

    List<EncounterCandidateRecord> loadEncounterCandidates(
            Connection connection,
            CreatureCatalogQueryPort.EncounterCandidateSpec spec
    ) throws SQLException {
        StringBuilder sql = new StringBuilder(
                "SELECT id, name, creature_type, cr, xp, hp, hit_dice_count, hit_dice_sides, hit_dice_modifier, "
                        + "ac, initiative_bonus, legendary_action_count FROM creatures WHERE xp >= ? AND xp <= ?");
        List<Object> params = new ArrayList<>();
        params.add(spec.minimumXp());
        params.add(spec.maximumXp());
        CreaturesCatalogFilterSqlAppender.appendStringListEquals(sql, params, "creature_type", spec.types());
        CreaturesCatalogFilterSqlAppender.appendStringListInSubquery(sql, params, "creature_subtypes", "subtype", spec.subtypes());
        CreaturesCatalogFilterSqlAppender.appendStringListInSubquery(sql, params, "creature_biomes", "biome", spec.biomes());
        sql.append(" ORDER BY xp ASC, name ASC LIMIT ?");
        params.add(spec.limit());

        List<EncounterCandidateRecord> results = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            CreaturesSqliteQuerySupport.bindParams(statement, params);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    results.add(new EncounterCandidateRecord(
                            resultSet.getLong("id"),
                            resultSet.getString("name"),
                            resultSet.getString("creature_type"),
                            resultSet.getString("cr"),
                            resultSet.getInt("xp"),
                            resultSet.getInt("hp"),
                            CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_count"),
                            CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_sides"),
                            CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_modifier"),
                            resultSet.getInt("ac"),
                            resultSet.getInt("initiative_bonus"),
                            resultSet.getInt("legendary_action_count")));
                }
            }
        }
        return results;
    }
}
