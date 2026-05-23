package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class PartyRosterBackfillMigrator {

    private static final int[] XP_THRESHOLDS = {
            0,
            0,
            300,
            900,
            2_700,
            6_500,
            14_000,
            23_000,
            34_000,
            48_000,
            64_000,
            85_000,
            100_000,
            120_000,
            140_000,
            165_000,
            195_000,
            225_000,
            265_000,
            305_000,
            355_000
    };
    private static final int[] ADVENTURING_DAY_BUDGETS = {
            0,
            300,
            600,
            1_200,
            1_700,
            3_500,
            4_000,
            5_000,
            6_000,
            7_500,
            9_000,
            10_500,
            11_500,
            13_500,
            15_000,
            18_000,
            20_000,
            25_000,
            27_000,
            30_000,
            40_000
    };
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
                        minimumXpForLevel(resultSet.getInt("level")),
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
        int safeBudget = ADVENTURING_DAY_BUDGETS[clampLevel(level)];
        int perThirdBudget = Math.max(0, (int) Math.round(safeBudget / 3.0));
        int secondThreshold = Math.max(0, (int) Math.round(safeBudget * 2.0 / 3.0));
        if (safeLongRestXp >= secondThreshold && safeShortRestXp < perThirdBudget) {
            return 2;
        }
        return 1;
    }

    private static int minimumXpForLevel(int level) {
        return XP_THRESHOLDS[clampLevel(level)];
    }

    private static int clampLevel(int value) {
        return Math.max(1, Math.min(maxSupportedLevel(), value));
    }

    private static int maxSupportedLevel() {
        return Math.min(XP_THRESHOLDS.length, ADVENTURING_DAY_BUDGETS.length) - 1;
    }

    private record IntColumnUpdate(long id, int value) {
    }
}
