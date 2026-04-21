package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;
import src.domain.party.roster.policy.PartyAdventuringDayBudgetPolicy;
import src.domain.party.roster.policy.PartyLevelProgressionPolicy;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class PartyRosterBackfillMigrator {

    private static final String SELECT_LEVEL_AND_CURRENT_XP_SQL =
            "SELECT id, level, current_xp FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
    private static final String UPDATE_CURRENT_XP_SQL =
            "UPDATE " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + " SET current_xp = ? WHERE id = ?";
    private static final String SELECT_SHORT_REST_CADENCE_INPUTS_SQL =
            "SELECT id, level, xp_since_long_rest, xp_since_short_rest FROM "
                    + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
    private static final String UPDATE_SHORT_REST_CADENCE_SQL =
            "UPDATE " + PartyPersistenceSchema.PLAYER_CHARACTERS.name()
                    + " SET short_rests_taken_since_long_rest = ? WHERE id = ?";

    void normalizeExistingXp(Connection connection) throws SQLException {
        List<IntColumnUpdate> updates = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(SELECT_LEVEL_AND_CURRENT_XP_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                int normalizedXp = Math.max(
                        PartyLevelProgressionPolicy.minimumXpForLevel(resultSet.getInt("level")),
                        resultSet.getInt("current_xp"));
                if (normalizedXp != resultSet.getInt("current_xp")) {
                    updates.add(new IntColumnUpdate(resultSet.getLong("id"), normalizedXp));
                }
            }
        }
        updateCurrentXp(connection, updates);
    }

    void backfillShortRestCadence(Connection connection) throws SQLException {
        List<IntColumnUpdate> updates = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(SELECT_SHORT_REST_CADENCE_INPUTS_SQL);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                updates.add(new IntColumnUpdate(
                        resultSet.getLong("id"),
                        inferShortRestsTakenSinceLongRest(
                                resultSet.getInt("level"),
                                resultSet.getInt("xp_since_long_rest"),
                                resultSet.getInt("xp_since_short_rest"))));
            }
        }
        updateShortRestCadence(connection, updates);
    }

    private void updateCurrentXp(Connection connection, List<IntColumnUpdate> updates) throws SQLException {
        if (updates.isEmpty()) {
            return;
        }
        try (PreparedStatement update = connection.prepareStatement(UPDATE_CURRENT_XP_SQL)) {
            executeUpdates(update, updates);
        }
    }

    private void updateShortRestCadence(Connection connection, List<IntColumnUpdate> updates) throws SQLException {
        if (updates.isEmpty()) {
            return;
        }
        try (PreparedStatement update = connection.prepareStatement(UPDATE_SHORT_REST_CADENCE_SQL)) {
            executeUpdates(update, updates);
        }
    }

    private void executeUpdates(PreparedStatement update, List<IntColumnUpdate> updates) throws SQLException {
        for (IntColumnUpdate entry : updates) {
            update.setInt(1, entry.value());
            update.setLong(2, entry.id());
            update.addBatch();
        }
        update.executeBatch();
    }

    private int inferShortRestsTakenSinceLongRest(int level, int xpSinceLongRest, int xpSinceShortRest) {
        int safeLongRestXp = Math.max(0, xpSinceLongRest);
        int safeShortRestXp = Math.max(0, xpSinceShortRest);
        if (safeLongRestXp == 0 || safeLongRestXp == safeShortRestXp) {
            return 0;
        }
        int perThirdBudget = PartyAdventuringDayBudgetPolicy.perThird(level);
        int secondThreshold = PartyAdventuringDayBudgetPolicy.afterSecondShortRest(level);
        if (safeLongRestXp >= secondThreshold && safeShortRestXp < perThirdBudget) {
            return 2;
        }
        return 1;
    }

    private record IntColumnUpdate(long id, int value) {
    }
}
