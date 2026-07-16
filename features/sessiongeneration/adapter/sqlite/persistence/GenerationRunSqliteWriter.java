package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRun.Audit;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterBlock;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterPlan;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterTarget;
import features.sessiongeneration.domain.generation.GeneratedRun.LootLine;
import features.sessiongeneration.domain.generation.GeneratedRun.PackingRow;
import features.sessiongeneration.domain.generation.GeneratedRun.PartyLevel;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import features.sessiongeneration.domain.generation.GeneratedRun.TreasurePlan;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

final class GenerationRunSqliteWriter {

    void insert(Connection connection, GeneratedRun run) throws SQLException {
        insertRun(connection, run);
        insertParty(connection, run);
        insertTargets(connection, run);
        insertEncounters(connection, run);
        insertTreasures(connection, run);
        insertLoot(connection, run);
        insertPacking(connection, run);
        insertAudits(connection, run);
    }

    private static void insertRun(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.RUNS + " ("
                + "run_id, owner, schema_version, engine_version, catalog_version, catalog_hash, seed, "
                + "adventure_fraction, encounter_count, party_count, day_xp_budget, session_xp_target, average_level, "
                + "normal_budget_cp, overstock_budget_cp, nonmagic_slots, normal_magic, overstock_magic, treasure_count, "
                + "normal_actual_cp, overstock_actual_cp, magic_count, formatted_text) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            SessionContext session = run.session();
            statement.setString(1, run.runId());
            statement.setString(2, SqliteGenerationRunRepository.OWNER);
            statement.setInt(3, SqliteGenerationRunRepository.SCHEMA_VERSION);
            statement.setString(4, run.engineVersion());
            statement.setString(5, run.catalogVersion());
            statement.setString(6, run.catalogContentHash());
            statement.setLong(7, run.seed());
            statement.setString(8, session.adventureDayFraction().toPlainString());
            statement.setInt(9, session.encounterCount());
            statement.setInt(10, session.partyCount());
            statement.setLong(11, session.dayXpBudget());
            statement.setLong(12, session.sessionXpTarget());
            statement.setString(13, session.averageLevel().toPlainString());
            statement.setLong(14, session.normalBudgetCp());
            statement.setLong(15, session.overstockBudgetCp());
            statement.setInt(16, session.nonMagicSlots());
            statement.setInt(17, session.normalMagic());
            statement.setInt(18, session.overstockMagic());
            statement.setInt(19, session.treasureCount());
            statement.setLong(20, run.rewards().normalActualCp());
            statement.setLong(21, run.rewards().overstockActualCp());
            statement.setInt(22, run.rewards().magicCount());
            statement.setString(23, run.formattedText());
            statement.executeUpdate();
        }
    }

    private static void insertParty(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.PARTY
                + " (run_id, level, players, sort_order) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (PartyLevel item : run.party()) {
                statement.setString(1, run.runId()); statement.setInt(2, item.level());
                statement.setInt(3, item.players()); statement.setInt(4, order++); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertTargets(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.TARGETS
                + " (run_id, encounter_no, target_xp, sort_order) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (EncounterTarget item : run.encounterTargets()) {
                statement.setString(1, run.runId()); statement.setInt(2, item.encounterNumber());
                statement.setLong(3, item.targetXp()); statement.setInt(4, order++); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertEncounters(Connection connection, GeneratedRun run) throws SQLException {
        String encounterSql = "INSERT INTO " + SessionGenerationSchema.ENCOUNTERS
                + " (run_id, encounter_no, target_xp, adjusted_xp, difficulty, candidate_id, monster_summary, monster_count, "
                + "multiplier, max_challenge_code, boss_score, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        String blockSql = "INSERT INTO " + SessionGenerationSchema.ENCOUNTER_BLOCKS
                + " (run_id, encounter_no, block_order, block_id, role, challenge_code, challenge_label, unit_xp, quantity) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement encounter = connection.prepareStatement(encounterSql);
                PreparedStatement block = connection.prepareStatement(blockSql)) {
            int order = 0;
            for (EncounterPlan item : run.encounters()) {
                encounter.setString(1, run.runId()); encounter.setInt(2, item.encounterNumber());
                encounter.setLong(3, item.targetXp()); encounter.setLong(4, item.adjustedXp());
                encounter.setString(5, item.difficulty().name()); encounter.setString(6, item.candidateId());
                encounter.setString(7, item.monsterSummary()); encounter.setInt(8, item.monsterCount());
                encounter.setString(9, item.multiplier().toPlainString()); encounter.setInt(10, item.maxChallengeCode());
                encounter.setString(11, item.bossScore().toPlainString()); encounter.setInt(12, order++);
                encounter.addBatch();
                int blockOrder = 0;
                for (EncounterBlock value : item.blocks()) {
                    block.setString(1, run.runId()); block.setInt(2, item.encounterNumber());
                    block.setInt(3, blockOrder++); block.setString(4, value.id()); block.setString(5, value.role().name());
                    block.setInt(6, value.challengeCode()); block.setString(7, value.challengeLabel());
                    block.setLong(8, value.unitXp()); block.setInt(9, value.quantity()); block.addBatch();
                }
            }
            encounter.executeBatch();
            block.executeBatch();
        }
    }

    private static void insertTreasures(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.TREASURES
                + " (run_id, treasure_id, stock_class, reward_channel, anchor_encounter_no, theme, magic_type, target_cp, "
                + "nonmagic_slots, magic_slots, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (TreasurePlan item : run.treasures()) {
                statement.setString(1, run.runId()); statement.setInt(2, item.treasureId());
                statement.setString(3, item.stockClass().name()); statement.setString(4, item.channel().name());
                statement.setInt(5, item.anchorEncounterNumber()); statement.setString(6, item.theme());
                statement.setString(7, item.magicType()); statement.setLong(8, item.targetCp());
                statement.setInt(9, item.nonMagicSlots()); statement.setInt(10, item.magicSlots());
                statement.setInt(11, order++); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertLoot(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.LOOT
                + " (run_id, line_id, treasure_id, role, item_id, display_text, quantity, unit_cp, actual_cp, total_capacity, "
                + "allowed_containers, magic_rarity, cursed, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (LootLine item : run.loot()) {
                statement.setString(1, run.runId()); statement.setInt(2, item.lineId());
                statement.setInt(3, item.treasureId()); statement.setString(4, item.role().name());
                statement.setString(5, item.itemId()); statement.setString(6, item.text());
                statement.setLong(7, item.quantity()); statement.setLong(8, item.unitCp());
                statement.setLong(9, item.actualCp()); statement.setString(10, item.totalCapacity().toPlainString());
                statement.setString(11, item.allowedContainers()); statement.setString(12, item.magicRarity());
                statement.setBoolean(13, item.cursed()); statement.setInt(14, order++); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertPacking(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.PACKING
                + " (run_id, line_id, treasure_id, container_type, container_count, container_id, valid, sort_order) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (PackingRow item : run.packing()) {
                statement.setString(1, run.runId()); statement.setInt(2, item.lineId());
                statement.setInt(3, item.treasureId()); statement.setString(4, item.containerType());
                statement.setInt(5, item.containerCount()); statement.setString(6, item.containerId());
                statement.setBoolean(7, item.valid()); statement.setInt(8, order++); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertAudits(Connection connection, GeneratedRun run) throws SQLException {
        String sql = "INSERT INTO " + SessionGenerationSchema.AUDITS
                + " (run_id, audit_order, code, status, detail) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (Audit item : run.audits()) {
                statement.setString(1, run.runId()); statement.setInt(2, order++);
                statement.setString(3, item.code()); statement.setString(4, item.status().name());
                statement.setString(5, item.detail()); statement.addBatch();
            }
            statement.executeBatch();
        }
    }
}
