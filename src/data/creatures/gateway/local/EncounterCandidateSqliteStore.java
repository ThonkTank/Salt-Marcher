package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;
import src.data.creatures.model.EncounterCandidateCriteriaRecord;
import src.data.creatures.model.EncounterCandidateRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class EncounterCandidateSqliteStore {

    private static final String LOAD_ENCOUNTER_CANDIDATES_SQL =
            "SELECT id, name, creature_type, cr, xp, hp, hit_dice_count, hit_dice_sides, hit_dice_modifier, "
                    + "ac, initiative_bonus, legendary_action_count FROM "
                    + CreaturesPersistenceSchema.CREATURES.name()
                    + " "
                    + "WHERE xp >= ? AND xp <= ? "
                    + "AND ((SELECT COUNT(*) FROM " + CreaturesPersistenceSchema.TEMP_FILTER_TYPES_TABLE + ") = 0 "
                    + "OR LOWER(creature_type) IN (SELECT value FROM "
                    + CreaturesPersistenceSchema.TEMP_FILTER_TYPES_TABLE + ")) "
                    + "AND ((SELECT COUNT(*) FROM " + CreaturesPersistenceSchema.TEMP_FILTER_SUBTYPES_TABLE + ") = 0 "
                    + "OR id IN (SELECT creature_id FROM " + CreaturesPersistenceSchema.CREATURE_SUBTYPES.name()
                    + " WHERE LOWER(subtype) IN (SELECT value FROM "
                    + CreaturesPersistenceSchema.TEMP_FILTER_SUBTYPES_TABLE + "))) "
                    + "AND ((SELECT COUNT(*) FROM " + CreaturesPersistenceSchema.TEMP_FILTER_BIOMES_TABLE + ") = 0 "
                    + "OR id IN (SELECT creature_id FROM " + CreaturesPersistenceSchema.CREATURE_BIOMES.name()
                    + " WHERE LOWER(biome) IN (SELECT value FROM "
                    + CreaturesPersistenceSchema.TEMP_FILTER_BIOMES_TABLE + "))) "
                    + "ORDER BY xp ASC, name ASC LIMIT ?";

    List<EncounterCandidateRecord> loadEncounterCandidates(
            Connection connection,
            EncounterCandidateCriteriaRecord spec
    ) throws SQLException {
        CreatureFilterTempTables.prepareEncounterFilters(connection, spec);
        try (PreparedStatement statement = connection.prepareStatement(LOAD_ENCOUNTER_CANDIDATES_SQL)) {
            statement.setInt(1, spec.minimumXp());
            statement.setInt(2, spec.maximumXp());
            statement.setInt(3, spec.limit());
            return readEncounterCandidates(statement);
        } finally {
            CreatureFilterTempTables.clearFilters(connection);
        }
    }

    private List<EncounterCandidateRecord> readEncounterCandidates(PreparedStatement statement) throws SQLException {
        List<EncounterCandidateRecord> results = new ArrayList<>();
        try (ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                results.add(new EncounterCandidateRecord(
                        new EncounterCandidateRecord.Identity(
                                resultSet.getLong("id"),
                                resultSet.getString("name"),
                                resultSet.getString("creature_type")),
                        new EncounterCandidateRecord.Challenge(
                                resultSet.getString("cr"),
                                resultSet.getInt("xp")),
                        new EncounterCandidateRecord.Durability(
                                resultSet.getInt("hp"),
                                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_count"),
                                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_sides"),
                                CreaturesSqliteQuerySupport.getNullableInt(resultSet, "hit_dice_modifier")),
                        new EncounterCandidateRecord.Combat(
                                resultSet.getInt("ac"),
                                resultSet.getInt("initiative_bonus"),
                                resultSet.getInt("legendary_action_count"))));
            }
        }
        return results;
    }
}
