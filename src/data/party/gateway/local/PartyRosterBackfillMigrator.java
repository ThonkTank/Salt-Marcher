package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;
import src.domain.party.roster.PartyAdventuringDayBudget;
import src.domain.party.roster.PartyLevelProgression;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class PartyRosterBackfillMigrator {

    void normalizeExistingXp(Connection connection) throws SQLException {
        List<IntColumnUpdate> updates = new ArrayList<>();
        String sql = "SELECT id, level, current_xp FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                int normalizedXp = Math.max(
                        PartyLevelProgression.minimumXpForLevel(resultSet.getInt("level")),
                        resultSet.getInt("current_xp"));
                if (normalizedXp != resultSet.getInt("current_xp")) {
                    updates.add(new IntColumnUpdate(resultSet.getLong("id"), normalizedXp));
                }
            }
        }
        executeUpdates(
                connection,
                "UPDATE " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + " SET current_xp = ? WHERE id = ?",
                updates);
    }

    void backfillShortRestCadence(Connection connection) throws SQLException {
        List<IntColumnUpdate> updates = new ArrayList<>();
        String selectSql = "SELECT id, level, xp_since_long_rest, xp_since_short_rest FROM "
                + PartyPersistenceSchema.PLAYER_CHARACTERS.name();
        try (PreparedStatement statement = connection.prepareStatement(selectSql);
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
        executeUpdates(
                connection,
                "UPDATE " + PartyPersistenceSchema.PLAYER_CHARACTERS.name()
                        + " SET short_rests_taken_since_long_rest = ? WHERE id = ?",
                updates);
    }

    private void executeUpdates(Connection connection, String sql, List<IntColumnUpdate> updates) throws SQLException {
        if (updates.isEmpty()) {
            return;
        }
        try (PreparedStatement update = connection.prepareStatement(sql)) {
            for (IntColumnUpdate entry : updates) {
                update.setInt(1, entry.value());
                update.setLong(2, entry.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private int inferShortRestsTakenSinceLongRest(int level, int xpSinceLongRest, int xpSinceShortRest) {
        int safeLongRestXp = Math.max(0, xpSinceLongRest);
        int safeShortRestXp = Math.max(0, xpSinceShortRest);
        if (safeLongRestXp == 0 || safeLongRestXp == safeShortRestXp) {
            return 0;
        }
        int perThirdBudget = PartyAdventuringDayBudget.perThird(level);
        int secondThreshold = PartyAdventuringDayBudget.afterSecondShortRest(level);
        if (safeLongRestXp >= secondThreshold && safeShortRestXp < perThirdBudget) {
            return 2;
        }
        return 1;
    }

    private record IntColumnUpdate(long id, int value) {
    }
}
