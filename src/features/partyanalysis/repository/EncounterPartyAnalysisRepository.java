package features.partyanalysis.repository;

import features.creatures.model.CreatureCapabilityTag;
import features.partyanalysis.model.CreatureRoleProfile;
import features.creatures.model.EncounterFunctionRole;
import features.partyanalysis.model.EncounterWeightClass;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class EncounterPartyAnalysisRepository {
    private static final int IN_CLAUSE_BATCH_SIZE = 500;

    private EncounterPartyAnalysisRepository() {
        throw new AssertionError("No instances");
    }

    public record ActionRow(
            long actionId,
            long creatureId,
            String actionType,
            String name,
            String description,
            Integer toHitBonus
    ) {}

    public record CreatureBaseRow(
            long creatureId,
            int xp,
            int hp,
            int ac,
            int speed,
            int flySpeed,
            int legendaryActionCount
    ) {}

    public record CreatureDynamicRow(
            long creatureId,
            EncounterWeightClass weightClass,
            double survivabilityActions,
            double offensePressure,
            double expectedTurnShare,
            double minionnessScore,
            double gmComplexityLoad,
            String fitFlags
    ) {}

    public record CreatureStaticRow(
            long creatureId,
            int analysisVersion,
            EncounterFunctionRole primaryFunctionRole,
            String capabilityTags,
            double baseActionUnitsPerRound,
            double legendaryActionUnits,
            int hasReaction,
            int totalComplexityPoints,
            int complexFeatureCount,
            double supportSignalScore,
            double controlSignalScore,
            double mobilitySignalScore,
            double rangedSignalScore,
            double meleeSignalScore,
            double spellcastingSignalScore,
            double aoeSignalScore,
            double healingSignalScore,
            double summonSignalScore,
            double reactionSignalScore,
            double soldierRoleScore,
            double archerRoleScore,
            double controllerRoleScore,
            double skirmisherRoleScore,
            double supportRoleScore
    ) {}

    public record ActionAnalysisRow(
            long actionId,
            int analysisVersion,
            int isMelee,
            int isRanged,
            int isAoe,
            int isBuff,
            int isHeal,
            int isControl,
            int hasMobility,
            int hasSummon,
            int requiresRecharge,
            int estimatedRuleLines,
            int complexityPoints,
            double expectedUsesPerRound
    ) {}

    public static long createRun(Connection conn, int partyCompVersion, String partyCompHash) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO encounter_party_cache_runs(party_comp_version, party_comp_hash, status, started_at) "
                        + "VALUES(?, ?, 'BUILDING', CURRENT_TIMESTAMP)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, partyCompVersion);
            ps.setString(2, partyCompHash);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("createRun(): missing generated key");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void markRunReady(Connection conn, long runId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_party_cache_runs SET status = 'READY', finished_at = CURRENT_TIMESTAMP "
                        + "WHERE run_id = ?")) {
            ps.setLong(1, runId);
            ps.executeUpdate();
        }
    }

    public static void markRunFailed(Connection conn, long runId, String message) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_party_cache_runs "
                        + "SET status = 'FAILED', error_message = ?, finished_at = CURRENT_TIMESTAMP "
                        + "WHERE run_id = ?")) {
            ps.setString(1, message);
            ps.setLong(2, runId);
            ps.executeUpdate();
        }
    }

    public static Map<Long, CreatureBaseRow> loadAllCreatureBaseRows(Connection conn) throws SQLException {
        Map<Long, CreatureBaseRow> rows = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, xp, hp, ac, speed, fly_speed, legendary_action_count FROM creatures");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long creatureId = rs.getLong("id");
                rows.put(creatureId, new CreatureBaseRow(
                        creatureId,
                        rs.getInt("xp"),
                        rs.getInt("hp"),
                        rs.getInt("ac"),
                        rs.getInt("speed"),
                        rs.getInt("fly_speed"),
                        rs.getInt("legendary_action_count")));
            }
        }
        return rows;
    }

    public static Map<Long, ActionRow> loadActionRowsForCreature(Connection conn, long creatureId) throws SQLException {
        Map<Long, ActionRow> rows = new HashMap<>();
        String sql = "SELECT id, creature_id, action_type, name, description, to_hit_bonus "
                + "FROM creature_actions WHERE creature_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, creatureId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Number toHitRaw = (Number) rs.getObject("to_hit_bonus");
                    Integer toHit = toHitRaw != null ? toHitRaw.intValue() : null;
                    long actionId = rs.getLong("id");
                    rows.put(actionId, new ActionRow(
                            actionId,
                            rs.getLong("creature_id"),
                            rs.getString("action_type"),
                            rs.getString("name"),
                            rs.getString("description"),
                            toHit));
                }
            }
        }
        return rows;
    }

    public static void insertPartyDynamicRows(Connection conn, long runId, Iterable<CreatureDynamicRow> rows) throws SQLException {
        String sql = "INSERT INTO creature_party_analysis(" 
                + "run_id, creature_id, weight_class, survivability_actions, offense_pressure, "
                + "expected_turn_share, minionness_score, gm_complexity_load, fit_flags, computed_at"
                + ") VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (CreatureDynamicRow row : rows) {
                ps.setLong(1, runId);
                ps.setLong(2, row.creatureId());
                ps.setString(3, row.weightClass().name());
                ps.setDouble(4, row.survivabilityActions());
                ps.setDouble(5, row.offensePressure());
                ps.setDouble(6, row.expectedTurnShare());
                ps.setDouble(7, row.minionnessScore());
                ps.setDouble(8, row.gmComplexityLoad());
                ps.setString(9, row.fitFlags());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static void upsertStaticRows(Connection conn, Iterable<CreatureStaticRow> rows) throws SQLException {
        String sql = "INSERT INTO creature_static_analysis("
                + "creature_id, analysis_version, primary_function_role, capability_tags, "
                + "base_action_units_per_round, legendary_action_units, has_reaction, total_complexity_points, "
                + "complex_feature_count, support_signal_score, control_signal_score, mobility_signal_score, "
                + "ranged_signal_score, melee_signal_score, spellcasting_signal_score, aoe_signal_score, "
                + "healing_signal_score, summon_signal_score, reaction_signal_score, soldier_role_score, "
                + "archer_role_score, controller_role_score, skirmisher_role_score, support_role_score, updated_at"
                + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) "
                + "ON CONFLICT(creature_id) DO UPDATE SET "
                + "analysis_version=excluded.analysis_version, "
                + "primary_function_role=excluded.primary_function_role, "
                + "capability_tags=excluded.capability_tags, "
                + "base_action_units_per_round=excluded.base_action_units_per_round, "
                + "legendary_action_units=excluded.legendary_action_units, "
                + "has_reaction=excluded.has_reaction, "
                + "total_complexity_points=excluded.total_complexity_points, "
                + "complex_feature_count=excluded.complex_feature_count, "
                + "support_signal_score=excluded.support_signal_score, "
                + "control_signal_score=excluded.control_signal_score, "
                + "mobility_signal_score=excluded.mobility_signal_score, "
                + "ranged_signal_score=excluded.ranged_signal_score, "
                + "melee_signal_score=excluded.melee_signal_score, "
                + "spellcasting_signal_score=excluded.spellcasting_signal_score, "
                + "aoe_signal_score=excluded.aoe_signal_score, "
                + "healing_signal_score=excluded.healing_signal_score, "
                + "summon_signal_score=excluded.summon_signal_score, "
                + "soldier_role_score=excluded.soldier_role_score, "
                + "archer_role_score=excluded.archer_role_score, "
                + "controller_role_score=excluded.controller_role_score, "
                + "skirmisher_role_score=excluded.skirmisher_role_score, "
                + "support_role_score=excluded.support_role_score, "
                + "reaction_signal_score=excluded.reaction_signal_score, "
                + "updated_at=CURRENT_TIMESTAMP";

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (CreatureStaticRow row : rows) {
                ps.setLong(1, row.creatureId());
                ps.setInt(2, row.analysisVersion());
                ps.setString(3, enumName(row.primaryFunctionRole()));
                ps.setString(4, row.capabilityTags());
                ps.setDouble(5, row.baseActionUnitsPerRound());
                ps.setDouble(6, row.legendaryActionUnits());
                ps.setInt(7, row.hasReaction());
                ps.setInt(8, row.totalComplexityPoints());
                ps.setInt(9, row.complexFeatureCount());
                ps.setDouble(10, row.supportSignalScore());
                ps.setDouble(11, row.controlSignalScore());
                ps.setDouble(12, row.mobilitySignalScore());
                ps.setDouble(13, row.rangedSignalScore());
                ps.setDouble(14, row.meleeSignalScore());
                ps.setDouble(15, row.spellcastingSignalScore());
                ps.setDouble(16, row.aoeSignalScore());
                ps.setDouble(17, row.healingSignalScore());
                ps.setDouble(18, row.summonSignalScore());
                ps.setDouble(19, row.reactionSignalScore());
                ps.setDouble(20, row.soldierRoleScore());
                ps.setDouble(21, row.archerRoleScore());
                ps.setDouble(22, row.controllerRoleScore());
                ps.setDouble(23, row.skirmisherRoleScore());
                ps.setDouble(24, row.supportRoleScore());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static void upsertActionAnalysisRows(Connection conn, Iterable<ActionAnalysisRow> rows) throws SQLException {
        String sql = "INSERT INTO creature_action_analysis("
                + "action_id, analysis_version, is_melee, is_ranged, is_aoe, is_buff, is_heal, is_control, "
                + "has_mobility, has_summon, requires_recharge, estimated_rule_lines, complexity_points, "
                + "expected_uses_per_round, parsed_at"
                + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) "
                + "ON CONFLICT(action_id) DO UPDATE SET "
                + "analysis_version=excluded.analysis_version, "
                + "is_melee=excluded.is_melee, "
                + "is_ranged=excluded.is_ranged, "
                + "is_aoe=excluded.is_aoe, "
                + "is_buff=excluded.is_buff, "
                + "is_heal=excluded.is_heal, "
                + "is_control=excluded.is_control, "
                + "has_mobility=excluded.has_mobility, "
                + "has_summon=excluded.has_summon, "
                + "requires_recharge=excluded.requires_recharge, "
                + "estimated_rule_lines=excluded.estimated_rule_lines, "
                + "complexity_points=excluded.complexity_points, "
                + "expected_uses_per_round=excluded.expected_uses_per_round, "
                + "parsed_at=CURRENT_TIMESTAMP";

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (ActionAnalysisRow row : rows) {
                ps.setLong(1, row.actionId());
                ps.setInt(2, row.analysisVersion());
                ps.setInt(3, row.isMelee());
                ps.setInt(4, row.isRanged());
                ps.setInt(5, row.isAoe());
                ps.setInt(6, row.isBuff());
                ps.setInt(7, row.isHeal());
                ps.setInt(8, row.isControl());
                ps.setInt(9, row.hasMobility());
                ps.setInt(10, row.hasSummon());
                ps.setInt(11, row.requiresRecharge());
                ps.setInt(12, row.estimatedRuleLines());
                ps.setInt(13, row.complexityPoints());
                ps.setDouble(14, row.expectedUsesPerRound());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static Map<Long, CreatureStaticRow> loadStaticRows(Connection conn) throws SQLException {
        Map<Long, CreatureStaticRow> rows = new HashMap<>();
        String sql = "SELECT creature_id, analysis_version, primary_function_role, capability_tags, "
                + "base_action_units_per_round, legendary_action_units, has_reaction, total_complexity_points, "
                + "complex_feature_count, support_signal_score, control_signal_score, mobility_signal_score, "
                + "ranged_signal_score, melee_signal_score, spellcasting_signal_score, aoe_signal_score, "
                + "healing_signal_score, summon_signal_score, reaction_signal_score, soldier_role_score, "
                + "archer_role_score, controller_role_score, skirmisher_role_score, support_role_score "
                + "FROM creature_static_analysis";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long creatureId = rs.getLong("creature_id");
                rows.put(creatureId, new CreatureStaticRow(
                        creatureId,
                        rs.getInt("analysis_version"),
                        parseEnumOrNull(rs.getString("primary_function_role"), EncounterFunctionRole.class),
                        rs.getString("capability_tags"),
                        rs.getDouble("base_action_units_per_round"),
                        rs.getDouble("legendary_action_units"),
                        rs.getInt("has_reaction"),
                        rs.getInt("total_complexity_points"),
                        rs.getInt("complex_feature_count"),
                        rs.getDouble("support_signal_score"),
                        rs.getDouble("control_signal_score"),
                        rs.getDouble("mobility_signal_score"),
                        rs.getDouble("ranged_signal_score"),
                        rs.getDouble("melee_signal_score"),
                        rs.getDouble("spellcasting_signal_score"),
                        rs.getDouble("aoe_signal_score"),
                        rs.getDouble("healing_signal_score"),
                        rs.getDouble("summon_signal_score"),
                        rs.getDouble("reaction_signal_score"),
                        rs.getDouble("soldier_role_score"),
                        rs.getDouble("archer_role_score"),
                        rs.getDouble("controller_role_score"),
                        rs.getDouble("skirmisher_role_score"),
                        rs.getDouble("support_role_score")));
            }
        }
        return rows;
    }

    public static CreatureStaticRow loadStaticRow(Connection conn, long creatureId) throws SQLException {
        String sql = "SELECT creature_id, analysis_version, primary_function_role, capability_tags, "
                + "base_action_units_per_round, legendary_action_units, has_reaction, total_complexity_points, "
                + "complex_feature_count, support_signal_score, control_signal_score, mobility_signal_score, "
                + "ranged_signal_score, melee_signal_score, spellcasting_signal_score, aoe_signal_score, "
                + "healing_signal_score, summon_signal_score, reaction_signal_score, soldier_role_score, "
                + "archer_role_score, controller_role_score, skirmisher_role_score, support_role_score "
                + "FROM creature_static_analysis WHERE creature_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, creatureId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new CreatureStaticRow(
                        creatureId,
                        rs.getInt("analysis_version"),
                        parseEnumOrNull(rs.getString("primary_function_role"), EncounterFunctionRole.class),
                        rs.getString("capability_tags"),
                        rs.getDouble("base_action_units_per_round"),
                        rs.getDouble("legendary_action_units"),
                        rs.getInt("has_reaction"),
                        rs.getInt("total_complexity_points"),
                        rs.getInt("complex_feature_count"),
                        rs.getDouble("support_signal_score"),
                        rs.getDouble("control_signal_score"),
                        rs.getDouble("mobility_signal_score"),
                        rs.getDouble("ranged_signal_score"),
                        rs.getDouble("melee_signal_score"),
                        rs.getDouble("spellcasting_signal_score"),
                        rs.getDouble("aoe_signal_score"),
                        rs.getDouble("healing_signal_score"),
                        rs.getDouble("summon_signal_score"),
                        rs.getDouble("reaction_signal_score"),
                        rs.getDouble("soldier_role_score"),
                        rs.getDouble("archer_role_score"),
                        rs.getDouble("controller_role_score"),
                        rs.getDouble("skirmisher_role_score"),
                        rs.getDouble("support_role_score"));
            }
        }
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForActiveRun(Connection conn) throws SQLException {
        String sql = "SELECT active_run_id FROM encounter_party_cache_state WHERE id = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return Map.of();
            }
            Number runIdRaw = (Number) rs.getObject("active_run_id");
            if (runIdRaw == null) {
                return Map.of();
            }
            return loadRoleProfilesForRun(conn, runIdRaw.longValue());
        }
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForRun(Connection conn, long runId) throws SQLException {
        Map<Long, CreatureRoleProfile> profiles = new HashMap<>();
        String sql = "SELECT cpa.creature_id, cpa.weight_class, cpa.survivability_actions, cpa.offense_pressure, "
                + "cpa.expected_turn_share, cpa.gm_complexity_load, cpa.fit_flags, "
                + "csa.primary_function_role, csa.capability_tags, "
                + "csa.base_action_units_per_round "
                + "FROM creature_party_analysis cpa "
                + "JOIN creature_static_analysis csa ON csa.creature_id = cpa.creature_id "
                + "WHERE cpa.run_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, runId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long creatureId = rs.getLong("creature_id");
                    profiles.put(creatureId, new CreatureRoleProfile(
                            creatureId,
                            parseEnumOrNull(rs.getString("weight_class"), EncounterWeightClass.class),
                            parseEnumOrNull(rs.getString("primary_function_role"), EncounterFunctionRole.class),
                            parseCapabilityTags(rs.getString("capability_tags")),
                            rs.getDouble("survivability_actions"),
                            rs.getDouble("base_action_units_per_round"),
                            rs.getDouble("offense_pressure"),
                            rs.getDouble("expected_turn_share"),
                            rs.getDouble("gm_complexity_load"),
                            parseFlags(rs.getString("fit_flags"))));
                }
            }
        }
        return profiles;
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForRun(
            Connection conn,
            long runId,
            Set<Long> creatureIds) throws SQLException {
        List<Long> filteredIds = normalizeCreatureIds(creatureIds);
        if (filteredIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, CreatureRoleProfile> profiles = new HashMap<>(filteredIds.size());
        for (List<Long> batch : partitionIds(filteredIds)) {
            String sql = "SELECT cpa.creature_id, cpa.weight_class, cpa.survivability_actions, cpa.offense_pressure, "
                    + "cpa.expected_turn_share, cpa.gm_complexity_load, cpa.fit_flags, "
                    + "csa.primary_function_role, csa.capability_tags, "
                    + "csa.base_action_units_per_round "
                    + "FROM creature_party_analysis cpa "
                    + "JOIN creature_static_analysis csa ON csa.creature_id = cpa.creature_id "
                    + "WHERE cpa.run_id = ? AND cpa.creature_id IN (" + inClausePlaceholders(batch.size()) + ")";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, runId);
                bindCreatureIds(ps, batch, 2);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        long creatureId = rs.getLong("creature_id");
                        profiles.put(creatureId, new CreatureRoleProfile(
                                creatureId,
                                parseEnumOrNull(rs.getString("weight_class"), EncounterWeightClass.class),
                                parseEnumOrNull(rs.getString("primary_function_role"), EncounterFunctionRole.class),
                                parseCapabilityTags(rs.getString("capability_tags")),
                                rs.getDouble("survivability_actions"),
                                rs.getDouble("base_action_units_per_round"),
                                rs.getDouble("offense_pressure"),
                                rs.getDouble("expected_turn_share"),
                                rs.getDouble("gm_complexity_load"),
                                parseFlags(rs.getString("fit_flags"))));
                    }
                }
            }
        }
        return profiles;
    }

    public static CreatureRoleProfile loadRoleProfileForCreature(Connection conn, long creatureId) throws SQLException {
        String sql = "SELECT cpa.creature_id, cpa.weight_class, csa.primary_function_role, "
                + "csa.capability_tags, cpa.survivability_actions, csa.base_action_units_per_round, cpa.offense_pressure, "
                + "cpa.expected_turn_share, cpa.gm_complexity_load, cpa.fit_flags "
                + "FROM creature_party_analysis cpa "
                + "JOIN creature_static_analysis csa ON csa.creature_id = cpa.creature_id "
                + "JOIN encounter_party_cache_state s ON s.id = 1 "
                + "WHERE s.active_run_id IS NOT NULL AND cpa.run_id = s.active_run_id AND cpa.creature_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, creatureId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return new CreatureRoleProfile(
                        rs.getLong("creature_id"),
                        parseEnumOrNull(rs.getString("weight_class"), EncounterWeightClass.class),
                        parseEnumOrNull(rs.getString("primary_function_role"), EncounterFunctionRole.class),
                        parseCapabilityTags(rs.getString("capability_tags")),
                        rs.getDouble("survivability_actions"),
                        rs.getDouble("base_action_units_per_round"),
                        rs.getDouble("offense_pressure"),
                        rs.getDouble("expected_turn_share"),
                        rs.getDouble("gm_complexity_load"),
                        parseFlags(rs.getString("fit_flags")));
            }
        }
    }

    public static Map<Long, ActionRow> loadAllActionRows(Connection conn) throws SQLException {
        Map<Long, ActionRow> rows = new HashMap<>();
        String sql = "SELECT id, creature_id, action_type, name, description, to_hit_bonus FROM creature_actions";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Number toHitRaw = (Number) rs.getObject("to_hit_bonus");
                Integer toHit = toHitRaw != null ? toHitRaw.intValue() : null;
                long actionId = rs.getLong("id");
                rows.put(actionId, new ActionRow(
                        actionId,
                        rs.getLong("creature_id"),
                        rs.getString("action_type"),
                        rs.getString("name"),
                        rs.getString("description"),
                        toHit));
            }
        }
        return rows;
    }

    public static void cleanupRuns(Connection conn) throws SQLException {
        String sql = "DELETE FROM encounter_party_cache_runs "
                + "WHERE run_id NOT IN ("
                + "  SELECT run_id FROM encounter_party_cache_runs WHERE status = 'READY' ORDER BY run_id DESC LIMIT 2"
                + ") AND run_id NOT IN ("
                + "  SELECT run_id FROM encounter_party_cache_runs WHERE status = 'FAILED' ORDER BY run_id DESC LIMIT 3"
                + ") AND run_id NOT IN (SELECT COALESCE(active_run_id, -1) FROM encounter_party_cache_state WHERE id = 1)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM creature_party_analysis "
                        + "WHERE run_id NOT IN (SELECT run_id FROM encounter_party_cache_runs)")) {
            ps.executeUpdate();
        }
    }

    private static String enumName(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private static List<Long> normalizeCreatureIds(Set<Long> creatureIds) {
        if (creatureIds == null || creatureIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> filteredIds = new LinkedHashSet<>();
        for (Long creatureId : creatureIds) {
            if (creatureId != null) {
                filteredIds.add(creatureId);
            }
        }
        return filteredIds.isEmpty() ? List.of() : List.copyOf(filteredIds);
    }

    private static List<List<Long>> partitionIds(List<Long> creatureIds) {
        if (creatureIds.isEmpty()) {
            return List.of();
        }
        List<List<Long>> batches = new ArrayList<>((creatureIds.size() + IN_CLAUSE_BATCH_SIZE - 1) / IN_CLAUSE_BATCH_SIZE);
        for (int index = 0; index < creatureIds.size(); index += IN_CLAUSE_BATCH_SIZE) {
            batches.add(creatureIds.subList(index, Math.min(creatureIds.size(), index + IN_CLAUSE_BATCH_SIZE)));
        }
        return batches;
    }

    private static String inClausePlaceholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static void bindCreatureIds(PreparedStatement ps, List<Long> creatureIds, int startIndex) throws SQLException {
        for (int index = 0; index < creatureIds.size(); index++) {
            ps.setLong(startIndex + index, creatureIds.get(index));
        }
    }

    private static <E extends Enum<E>> E parseEnumOrNull(String raw, Class<E> enumType) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Enum.valueOf(enumType, raw.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static Set<CreatureCapabilityTag> parseCapabilityTags(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        EnumSet<CreatureCapabilityTag> tags = EnumSet.noneOf(CreatureCapabilityTag.class);
        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> parseEnumOrNull(s, CreatureCapabilityTag.class))
                .filter(tag -> tag != null)
                .forEach(tags::add);
        return Set.copyOf(tags);
    }

    private static Set<String> parseFlags(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
