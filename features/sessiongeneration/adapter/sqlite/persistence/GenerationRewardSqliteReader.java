package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationRewardBatch;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

final class GenerationRewardSqliteReader {

    static final int MAX_KEYS_PER_QUERY = 400;

    GenerationRewardBatch load(Connection connection, List<GenerationRewardReference> requested) throws SQLException {
        List<GenerationRewardReference> callerOrder = List.copyOf(requested);
        if (callerOrder.isEmpty()) {
            return new GenerationRewardBatch(List.of(), List.of());
        }
        List<GenerationRewardReference> unique = List.copyOf(new LinkedHashSet<>(callerOrder));
        Map<GenerationRewardReference, GenerationRewardBatch.ResolvedReward> byReference = new LinkedHashMap<>();
        for (int start = 0; start < unique.size(); start += MAX_KEYS_PER_QUERY) {
            loadChunk(connection, unique.subList(start, Math.min(start + MAX_KEYS_PER_QUERY, unique.size())), byReference);
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
        return new GenerationRewardBatch(resolved, missing);
    }

    private static void loadChunk(
            Connection connection,
            List<GenerationRewardReference> references,
            Map<GenerationRewardReference, GenerationRewardBatch.ResolvedReward> target
    ) throws SQLException {
        String predicates = String.join(" OR ", java.util.Collections.nCopies(
                references.size(), "(treasure.run_id = ? AND treasure.treasure_id = ?)"));
        String sql = "SELECT treasure.*, loot.line_id, loot.role, loot.item_id, loot.display_text, "
                + "loot.quantity, loot.unit_cp, loot.actual_cp, loot.total_capacity, loot.allowed_containers, "
                + "loot.magic_rarity, loot.cursed, loot.sort_order AS loot_order, packing.container_type, "
                + "packing.container_count, packing.container_id, packing.valid "
                + "FROM " + SessionGenerationSchema.TREASURES + " treasure "
                + "LEFT JOIN " + SessionGenerationSchema.LOOT + " loot ON loot.run_id = treasure.run_id "
                + "AND loot.treasure_id = treasure.treasure_id "
                + "LEFT JOIN " + SessionGenerationSchema.PACKING + " packing ON packing.run_id = loot.run_id "
                + "AND packing.line_id = loot.line_id WHERE " + predicates
                + " ORDER BY treasure.run_id, treasure.treasure_id, loot.sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int parameter = 1;
            for (GenerationRewardReference reference : references) {
                statement.setString(parameter++, reference.runId());
                statement.setInt(parameter++, reference.treasureId());
            }
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
