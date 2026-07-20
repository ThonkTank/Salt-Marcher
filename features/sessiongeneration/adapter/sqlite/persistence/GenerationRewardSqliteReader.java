package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationRewardBatch;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

final class GenerationRewardSqliteReader {

    private static final String REQUESTS = "temp_generation_reward_requests";

    ReadResult load(Connection connection, List<GenerationRewardReference> requested) throws SQLException {
        List<GenerationRewardReference> callerOrder = List.copyOf(requested);
        if (callerOrder.isEmpty()) {
            return new ReadResult(new GenerationRewardBatch(List.of(), List.of()), 0);
        }
        List<GenerationRewardReference> unique = List.copyOf(new LinkedHashSet<>(callerOrder));
        Map<GenerationRewardReference, GenerationRewardBatch.ResolvedReward> byReference = new LinkedHashMap<>();
        boolean requestTableReady = false;
        int statementCount = 0;
        SQLException primaryFailure = null;
        try {
            statementCount += ensureTable(connection);
            requestTableReady = true;
            clear(connection);
            statementCount++;
            statementCount += insertRequests(connection, unique);
            statementCount += loadRequested(connection, byReference);
        } catch (SQLException failure) {
            primaryFailure = failure;
            throw failure;
        } finally {
            if (requestTableReady) {
                try {
                    clear(connection);
                    statementCount++;
                } catch (SQLException cleanupFailure) {
                    if (primaryFailure != null) {
                        primaryFailure.addSuppressed(cleanupFailure);
                    } else {
                        throw cleanupFailure;
                    }
                }
            }
        }
        List<GenerationRewardBatch.ResolvedReward> resolved = new ArrayList<>();
        List<GenerationRewardReference> missing = new ArrayList<>();
        for (GenerationRewardReference reference : callerOrder) {
            GenerationRewardBatch.ResolvedReward detail = byReference.get(reference);
            if (detail == null) {
                missing.add(reference);
            } else {
                resolved.add(detail);
            }
        }
        return new ReadResult(new GenerationRewardBatch(resolved, missing), statementCount);
    }

    private static int loadRequested(
            Connection connection,
            Map<GenerationRewardReference, GenerationRewardBatch.ResolvedReward> target
    ) throws SQLException {
        String sql = "SELECT treasure.*, loot.line_id, loot.role, loot.item_id, loot.display_text, "
                + "loot.quantity, loot.unit_cp, loot.actual_cp, loot.total_capacity, loot.allowed_containers, "
                + "loot.magic_rarity, loot.cursed, loot.sort_order AS loot_order, packing.container_type, "
                + "packing.container_count, packing.container_id, packing.valid "
                + "FROM " + SessionGenerationSchema.TREASURES + " treasure "
                + "LEFT JOIN " + SessionGenerationSchema.LOOT + " loot ON loot.run_id = treasure.run_id "
                + "AND loot.treasure_id = treasure.treasure_id "
                + "LEFT JOIN " + SessionGenerationSchema.PACKING + " packing ON packing.run_id = loot.run_id "
                + "AND packing.line_id = loot.line_id "
                + "JOIN " + REQUESTS + " request ON request.run_id = treasure.run_id "
                + "AND request.treasure_id = treasure.treasure_id "
                + "ORDER BY request.request_order, loot.sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            try (ResultSet rows = statement.executeQuery()) {
                Map<GenerationRewardReference, RewardAccumulator> loaded = new LinkedHashMap<>();
                while (rows.next()) {
                    GenerationRewardReference reference = new GenerationRewardReference(
                            rows.getString("run_id"), rows.getInt("treasure_id"));
                    RewardAccumulator reward = loaded.get(reference);
                    if (reward == null) {
                        reward = new RewardAccumulator(
                                reference,
                                new GeneratedRun.TreasurePlan(
                                        reference.treasureId(),
                                        GeneratedRun.StockClass.valueOf(rows.getString("stock_class")),
                                        GeneratedRun.RewardChannel.valueOf(rows.getString("reward_channel")),
                                        rows.getInt("anchor_encounter_no"), rows.getString("theme"),
                                        rows.getString("magic_type"), rows.getLong("target_cp"),
                                        rows.getInt("nonmagic_slots"), rows.getInt("magic_slots")));
                        loaded.put(reference, reward);
                    }
                    int lineId = rows.getInt("line_id");
                    if (!rows.wasNull()) {
                        reward.add(
                                new GeneratedRun.LootLine(
                                        lineId, reference.treasureId(),
                                        GeneratedRun.LootRole.valueOf(rows.getString("role")),
                                        rows.getString("item_id"), rows.getString("display_text"),
                                        rows.getLong("quantity"), rows.getLong("unit_cp"), rows.getLong("actual_cp"),
                                        new BigDecimal(rows.getString("total_capacity")),
                                        rows.getString("allowed_containers"), rows.getString("magic_rarity"),
                                        rows.getBoolean("cursed")),
                                new GeneratedRun.PackingRow(
                                        lineId, reference.treasureId(), rows.getString("container_type"),
                                        rows.getInt("container_count"), rows.getString("container_id"),
                                        rows.getBoolean("valid")));
                    }
                }
                loaded.forEach((reference, reward) -> target.put(reference, reward.toResolved()));
            }
        }
        return 1;
    }

    private static int ensureTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TEMP TABLE IF NOT EXISTS " + REQUESTS
                    + " (run_id TEXT NOT NULL, treasure_id INTEGER NOT NULL, request_order INTEGER NOT NULL, "
                    + "PRIMARY KEY (run_id, treasure_id))");
        }
        return 1;
    }

    private static int insertRequests(Connection connection, List<GenerationRewardReference> references)
            throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + REQUESTS + " (run_id, treasure_id, request_order) VALUES (?, ?, ?)")) {
            for (int index = 0; index < references.size(); index++) {
                GenerationRewardReference reference = references.get(index);
                insert.setString(1, reference.runId());
                insert.setInt(2, reference.treasureId());
                insert.setInt(3, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        return 1;
    }

    private static void clear(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM " + REQUESTS);
        }
    }

    record ReadResult(GenerationRewardBatch batch, int statementCount) {
    }

    private static final class RewardAccumulator {
        private final GenerationRewardReference reference;
        private final GeneratedRun.TreasurePlan treasure;
        private final List<GeneratedRun.LootLine> loot = new ArrayList<>();
        private final List<GeneratedRun.PackingRow> packing = new ArrayList<>();

        private RewardAccumulator(GenerationRewardReference reference, GeneratedRun.TreasurePlan treasure) {
            this.reference = reference;
            this.treasure = treasure;
        }

        void add(GeneratedRun.LootLine line, GeneratedRun.PackingRow row) {
            loot.add(line);
            packing.add(row);
        }

        GenerationRewardBatch.ResolvedReward toResolved() {
            return new GenerationRewardBatch.ResolvedReward(reference, treasure, loot, packing);
        }
    }
}
