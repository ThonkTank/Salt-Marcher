package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRun.Audit;
import features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus;
import features.sessiongeneration.domain.generation.GeneratedRun.Difficulty;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterBlock;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterPlan;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterRole;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterTarget;
import features.sessiongeneration.domain.generation.GeneratedRun.LootLine;
import features.sessiongeneration.domain.generation.GeneratedRun.LootRole;
import features.sessiongeneration.domain.generation.GeneratedRun.PackingRow;
import features.sessiongeneration.domain.generation.GeneratedRun.PartyLevel;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardChannel;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardSummary;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import features.sessiongeneration.domain.generation.GeneratedRun.StockClass;
import features.sessiongeneration.domain.generation.GeneratedRun.TreasurePlan;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

final class GenerationRunSqliteReader {

    Optional<GeneratedRun> load(Connection connection, String runId) throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.RUNS + " WHERE run_id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                SessionContext session = new SessionContext(
                        result.getInt("party_count"), new BigDecimal(result.getString("adventure_fraction")),
                        result.getInt("encounter_count"), result.getLong("day_xp_budget"),
                        result.getLong("session_xp_target"), new BigDecimal(result.getString("average_level")),
                        result.getLong("normal_budget_cp"), result.getLong("overstock_budget_cp"),
                        result.getInt("nonmagic_slots"), result.getInt("normal_magic"),
                        result.getInt("overstock_magic"), result.getInt("treasure_count"));
                RewardSummary rewards = new RewardSummary(
                        result.getLong("normal_actual_cp"), result.getLong("overstock_actual_cp"),
                        result.getInt("magic_count"));
                return Optional.of(new GeneratedRun(
                        runId, result.getString("engine_version"), result.getString("catalog_version"),
                        result.getString("catalog_hash"), result.getLong("seed"), loadParty(connection, runId),
                        session, loadTargets(connection, runId), loadEncounters(connection, runId),
                        loadTreasures(connection, runId), loadLoot(connection, runId), loadPacking(connection, runId),
                        rewards, result.getString("formatted_text"), loadAudits(connection, runId)));
            }
        }
    }

    private static List<PartyLevel> loadParty(Connection connection, String runId) throws SQLException {
        String sql = "SELECT level, players FROM " + SessionGenerationSchema.PARTY
                + " WHERE run_id = ? ORDER BY sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<PartyLevel> result = new ArrayList<>();
                while (rows.next()) result.add(new PartyLevel(rows.getInt(1), rows.getInt(2)));
                return List.copyOf(result);
            }
        }
    }

    private static List<EncounterTarget> loadTargets(Connection connection, String runId) throws SQLException {
        String sql = "SELECT encounter_no, target_xp FROM " + SessionGenerationSchema.TARGETS
                + " WHERE run_id = ? ORDER BY sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<EncounterTarget> result = new ArrayList<>();
                while (rows.next()) result.add(new EncounterTarget(rows.getInt(1), rows.getLong(2)));
                return List.copyOf(result);
            }
        }
    }

    private static List<EncounterPlan> loadEncounters(Connection connection, String runId) throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.ENCOUNTERS
                + " WHERE run_id = ? ORDER BY sort_order";
        List<EncounterRow> loaded = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) loaded.add(new EncounterRow(
                        rows.getInt("encounter_no"), rows.getLong("target_xp"), rows.getLong("adjusted_xp"),
                        Difficulty.valueOf(rows.getString("difficulty")), rows.getString("candidate_id"),
                        rows.getString("monster_summary"), rows.getInt("monster_count"),
                        new BigDecimal(rows.getString("multiplier")), rows.getInt("max_challenge_code"),
                        new BigDecimal(rows.getString("boss_score"))));
            }
        }
        List<EncounterPlan> result = new ArrayList<>();
        for (EncounterRow row : loaded) result.add(row.toPlan(loadBlocks(connection, runId, row.number())));
        return List.copyOf(result);
    }

    private static List<TreasurePlan> loadTreasures(Connection connection, String runId) throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.TREASURES
                + " WHERE run_id = ? ORDER BY sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<TreasurePlan> result = new ArrayList<>();
                while (rows.next()) result.add(new TreasurePlan(
                        rows.getInt("treasure_id"), StockClass.valueOf(rows.getString("stock_class")),
                        RewardChannel.valueOf(rows.getString("reward_channel")), rows.getInt("anchor_encounter_no"),
                        rows.getString("theme"), rows.getString("magic_type"), rows.getLong("target_cp"),
                        rows.getInt("nonmagic_slots"), rows.getInt("magic_slots")));
                return List.copyOf(result);
            }
        }
    }

    private static List<LootLine> loadLoot(Connection connection, String runId) throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.LOOT
                + " WHERE run_id = ? ORDER BY sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<LootLine> result = new ArrayList<>();
                while (rows.next()) result.add(new LootLine(
                        rows.getInt("line_id"), rows.getInt("treasure_id"), LootRole.valueOf(rows.getString("role")),
                        rows.getString("item_id"), rows.getString("display_text"), rows.getLong("quantity"),
                        rows.getLong("unit_cp"), rows.getLong("actual_cp"),
                        new BigDecimal(rows.getString("total_capacity")), rows.getString("allowed_containers"),
                        rows.getString("magic_rarity"), rows.getBoolean("cursed")));
                return List.copyOf(result);
            }
        }
    }

    private static List<PackingRow> loadPacking(Connection connection, String runId) throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.PACKING
                + " WHERE run_id = ? ORDER BY sort_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<PackingRow> result = new ArrayList<>();
                while (rows.next()) result.add(new PackingRow(
                        rows.getInt("line_id"), rows.getInt("treasure_id"), rows.getString("container_type"),
                        rows.getInt("container_count"), rows.getString("container_id"), rows.getBoolean("valid")));
                return List.copyOf(result);
            }
        }
    }

    private static List<Audit> loadAudits(Connection connection, String runId) throws SQLException {
        String sql = "SELECT audit_order, code, status, detail FROM " + SessionGenerationSchema.AUDITS
                + " WHERE run_id = ? ORDER BY audit_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            try (ResultSet rows = statement.executeQuery()) {
                List<Audit> result = new ArrayList<>();
                int expectedOrder = 0;
                while (rows.next()) {
                    requireOrder(rows.getInt("audit_order"), expectedOrder++, "audit");
                    result.add(new Audit(
                            rows.getString("code"),
                            AuditStatus.valueOf(rows.getString("status")),
                            rows.getString("detail")));
                }
                return List.copyOf(result);
            }
        }
    }

    private static List<EncounterBlock> loadBlocks(Connection connection, String runId, int encounterNo)
            throws SQLException {
        String sql = "SELECT * FROM " + SessionGenerationSchema.ENCOUNTER_BLOCKS
                + " WHERE run_id = ? AND encounter_no = ? ORDER BY block_order";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, runId);
            statement.setInt(2, encounterNo);
            try (ResultSet rows = statement.executeQuery()) {
                List<EncounterBlock> result = new ArrayList<>();
                int expectedOrder = 0;
                while (rows.next()) {
                    requireOrder(rows.getInt("block_order"), expectedOrder++, "encounter block");
                    result.add(new EncounterBlock(
                            rows.getString("block_id"), EncounterRole.valueOf(rows.getString("role")),
                            rows.getInt("challenge_code"), rows.getString("challenge_label"),
                            rows.getLong("unit_xp"), rows.getInt("quantity")));
                }
                return List.copyOf(result);
            }
        }
    }

    private static void requireOrder(int actual, int expected, String rowType) {
        if (actual != expected) {
            throw new IllegalStateException(rowType + " order is not contiguous");
        }
    }

    private record EncounterRow(
            int number,
            long targetXp,
            long adjustedXp,
            Difficulty difficulty,
            String candidateId,
            String summary,
            int monsterCount,
            BigDecimal multiplier,
            int maxChallengeCode,
            BigDecimal bossScore
    ) {
        EncounterPlan toPlan(List<EncounterBlock> blocks) {
            return new EncounterPlan(
                    number, targetXp, adjustedXp, difficulty, candidateId, summary, monsterCount,
                    multiplier, maxChallengeCode, bossScore, blocks);
        }
    }
}
