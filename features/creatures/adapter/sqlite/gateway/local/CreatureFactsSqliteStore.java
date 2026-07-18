package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;
import features.creatures.adapter.sqlite.model.EncounterCandidateRecord;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureFactsSpec;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

final class CreatureFactsSqliteStore {

    private static final String REQUEST_TABLE = "temp_creature_fact_requests";
    private static final String CREATE_REQUEST_TABLE = "CREATE TEMP TABLE IF NOT EXISTS " + REQUEST_TABLE
            + " (value INTEGER PRIMARY KEY)";
    private static final String CLEAR_REQUEST_TABLE = "DELETE FROM " + REQUEST_TABLE;
    private static final String INSERT_REQUEST = "INSERT INTO " + REQUEST_TABLE + " (value) VALUES (?)";
    private static final String SELECT_COLUMNS =
            "SELECT c.id, c.name, c.creature_type, c.cr, c.xp, c.hp, c.hit_dice_count, "
                    + "c.hit_dice_sides, c.hit_dice_modifier, c.ac, c.initiative_bonus, "
                    + "c.legendary_action_count FROM " + CreaturesPersistenceSchema.CREATURES.name() + " c ";

    List<EncounterCandidateRecord> load(Connection connection, CreatureFactsSpec spec) throws SQLException {
        prepareRequests(connection, spec.values());
        String joinColumn = spec.mode() == CreatureFactsSpec.FactsMode.XP_VALUES ? "c.xp" : "c.id";
        String sql = SELECT_COLUMNS + "JOIN " + REQUEST_TABLE + " r ON r.value = " + joinColumn
                + " ORDER BY c.id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet rows = statement.executeQuery()) {
            List<EncounterCandidateRecord> result = new ArrayList<>();
            while (rows.next()) {
                result.add(read(rows));
            }
            return List.copyOf(result);
        } finally {
            clearRequests(connection);
        }
    }

    private static void prepareRequests(Connection connection, List<Long> values) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(CREATE_REQUEST_TABLE);
            statement.executeUpdate(CLEAR_REQUEST_TABLE);
        }
        try (PreparedStatement insert = connection.prepareStatement(INSERT_REQUEST)) {
            for (Long value : values) {
                insert.setLong(1, value.longValue());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void clearRequests(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(CLEAR_REQUEST_TABLE);
        }
    }

    private static EncounterCandidateRecord read(ResultSet rows) throws SQLException {
        return new EncounterCandidateRecord(
                new EncounterCandidateRecord.Identity(
                        rows.getLong("id"), rows.getString("name"), rows.getString("creature_type")),
                new EncounterCandidateRecord.Challenge(rows.getString("cr"), rows.getInt("xp")),
                new EncounterCandidateRecord.Durability(
                        rows.getInt("hp"),
                        CreaturesSqliteQuerySupport.getNullableInt(rows, "hit_dice_count"),
                        CreaturesSqliteQuerySupport.getNullableInt(rows, "hit_dice_sides"),
                        CreaturesSqliteQuerySupport.getNullableInt(rows, "hit_dice_modifier")),
                new EncounterCandidateRecord.Combat(
                        rows.getInt("ac"), rows.getInt("initiative_bonus"),
                        rows.getInt("legendary_action_count")));
    }
}
