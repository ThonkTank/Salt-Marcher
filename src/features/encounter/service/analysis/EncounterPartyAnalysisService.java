package features.encounter.service.analysis;

import database.DatabaseManager;
import features.encounter.model.CreatureCapabilityTag;
import features.encounter.model.CreatureRoleProfile;
import features.encounter.model.EncounterWeightClass;
import features.encounter.repository.EncounterPartyAnalysisRepository;
import features.encounter.repository.EncounterPartyAnalysisRepository.CreatureBaseRow;
import features.encounter.repository.EncounterPartyAnalysisRepository.CreatureDynamicRow;
import features.encounter.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.encounter.repository.EncounterPartyCacheRepository;
import features.encounter.repository.EncounterPartyCacheRepository.CacheState;
import features.encounter.repository.EncounterPartyCacheRepository.CacheStatus;
import features.gamerules.model.MonsterRole;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class EncounterPartyAnalysisService {
    private static final Logger LOGGER = Logger.getLogger(EncounterPartyAnalysisService.class.getName());

    private EncounterPartyAnalysisService() {
        throw new AssertionError("No instances");
    }

    public enum CacheReadiness {
        READY,
        NOT_READY,
        STORAGE_ERROR
    }

    public enum CreatureDataRefreshOutcome {
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public static CacheReadiness ensureCacheReady() {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (hasCurrentValidCache(conn)) {
                return CacheReadiness.READY;
            }
            return CacheReadiness.NOT_READY;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterPartyAnalysisService.ensureCacheReady(): DB access failed", e);
            return CacheReadiness.STORAGE_ERROR;
        }
    }

    public static boolean invalidateCurrentPartyCache() {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterPartyCacheRepository.invalidateForCurrentParty(conn);
            return true;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterPartyAnalysisService.invalidateCurrentPartyCache(): DB access failed", e);
            return false;
        }
    }

    public static boolean rebuildCurrentPartyCache() {
        try (Connection conn = DatabaseManager.getConnection()) {
            rebuildCurrentPartyCache(conn);
            return true;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "EncounterPartyAnalysisService.rebuildCurrentPartyCache(): DB rebuild failed", e);
            return false;
        }
    }

    public static void rebuildCurrentPartyCacheAsyncBestEffort() {
        CompletableFuture.runAsync(() -> {
            boolean rebuilt = rebuildCurrentPartyCache();
            if (!rebuilt) {
                LOGGER.warning("EncounterPartyAnalysisService.rebuildCurrentPartyCacheAsyncBestEffort(): rebuild failed");
            }
        });
    }

    public static void refreshCurrentPartyCacheAsyncBestEffort() {
        CompletableFuture.runAsync(() -> {
            boolean invalidated = invalidateCurrentPartyCache();
            if (!invalidated) {
                LOGGER.warning("EncounterPartyAnalysisService.refreshCurrentPartyCacheAsyncBestEffort(): invalidation failed");
                return;
            }
            boolean rebuilt = rebuildCurrentPartyCache();
            if (!rebuilt) {
                LOGGER.warning("EncounterPartyAnalysisService.refreshCurrentPartyCacheAsyncBestEffort(): rebuild failed");
            }
        });
    }

    public static CreatureDataRefreshOutcome refreshCacheForCreatureDataChange() {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (hasActiveParty(conn)) {
                rebuildCurrentPartyCache(conn);
                return CreatureDataRefreshOutcome.REBUILT;
            }
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return CreatureDataRefreshOutcome.INVALIDATED_NO_ACTIVE_PARTY;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.refreshCacheForCreatureDataChange(): DB refresh failed", e);
            return CreatureDataRefreshOutcome.STORAGE_ERROR;
        }
    }

    public static void rebuildCurrentPartyCache(Connection conn) throws SQLException {
        boolean wasAutoCommit = conn.getAutoCommit();
        Long runId = null;
        boolean lockAcquired = false;

        try {
            conn.setAutoCommit(false);
            CacheState invalidated = EncounterPartyCacheRepository.invalidateForCurrentParty(conn);
            runId = EncounterPartyAnalysisRepository.createRun(
                    conn,
                    invalidated.partyCompVersion(),
                    invalidated.partyCompHash());
            lockAcquired = EncounterPartyCacheRepository.markRebuilding(
                    conn,
                    runId,
                    invalidated.partyCompVersion(),
                    invalidated.partyCompHash());
            if (!lockAcquired) {
                EncounterPartyAnalysisRepository.markRunFailed(conn, runId, "rebuild already in progress");
                EncounterPartyAnalysisRepository.cleanupRuns(conn);
                conn.commit();
                LOGGER.log(Level.FINE,
                        "EncounterPartyAnalysisService.rebuildCurrentPartyCache(): skipped concurrent rebuild for run {0}",
                        runId);
                return;
            }
            conn.commit();

            conn.setAutoCommit(false);
            List<Integer> partyLevels = loadActivePartyLevels(conn);
            if (partyLevels.isEmpty()) {
                EncounterPartyAnalysisRepository.markRunFailed(conn, runId, "active party is empty");
                EncounterPartyCacheRepository.markError(conn, runId, "active party is empty");
                conn.commit();
                return;
            }
            RebuildPayload payload = buildPayload(conn, partyLevels);
            EncounterPartyAnalysisRepository.insertPartyDynamicRows(conn, runId, payload.dynamicRows());
            EncounterPartyAnalysisRepository.markRunReady(conn, runId);
            if (!EncounterPartyCacheRepository.markValid(conn, runId)) {
                throw new SQLException("party cache rebuild lock lost before finalization");
            }
            EncounterPartyAnalysisRepository.cleanupRuns(conn);
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            if (runId != null && lockAcquired) {
                try {
                    conn.setAutoCommit(false);
                    EncounterPartyAnalysisRepository.markRunFailed(conn, runId, sanitizeError(e.getMessage()));
                    EncounterPartyCacheRepository.markError(conn, runId, sanitizeError(e.getMessage()));
                    conn.commit();
                } catch (SQLException markEx) {
                    conn.rollback();
                }
            }
            throw e;
        } finally {
            if (conn.getAutoCommit() != wasAutoCommit) {
                conn.setAutoCommit(wasAutoCommit);
            }
        }
    }

    public static Map<Long, MonsterRole> loadDynamicRolesForActiveParty() {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
                return Map.of();
            }
            return EncounterPartyAnalysisRepository.loadDynamicRolesForActiveRun(conn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.loadDynamicRolesForActiveParty(): DB access failed", e);
            return Map.of();
        }
    }

    public static MonsterRole loadDynamicRoleForCreature(long creatureId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
                return null;
            }
            return EncounterPartyAnalysisRepository.loadDynamicRoleForCreature(conn, creatureId);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.loadDynamicRoleForCreature(): DB access failed", e);
            return null;
        }
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForActiveParty() {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
                return Map.of();
            }
            return EncounterPartyAnalysisRepository.loadRoleProfilesForActiveRun(conn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.loadRoleProfilesForActiveParty(): DB access failed", e);
            return Map.of();
        }
    }

    private static boolean hasCurrentValidCache(Connection conn) throws SQLException {
        CacheState state = EncounterPartyCacheRepository.ensureState(conn);
        if (state.cacheStatus() != CacheStatus.VALID || state.activeRunId() == null) {
            return false;
        }
        String currentHash = EncounterPartyCacheRepository.computeCurrentPartyHash(conn);
        return currentHash.equals(state.partyCompHash());
    }

    private static RebuildPayload buildPayload(Connection conn, List<Integer> partyLevels) throws SQLException {
        PartyBenchmarks party = PartyBenchmarks.fromLevels(partyLevels);

        Map<Long, CreatureBaseRow> creatures = EncounterPartyAnalysisRepository.loadAllCreatureBaseRows(conn);
        Map<Long, CreatureStaticRow> persistedStaticRows = EncounterPartyAnalysisRepository.loadStaticRows(conn);
        List<CreatureDynamicRow> dynamicRows = new ArrayList<>(creatures.size());

        for (CreatureBaseRow creature : creatures.values()) {
            CreatureStaticRow staticRow = persistedStaticRows.get(creature.creatureId());
            if (staticRow == null) {
                staticRow = CreatureStaticAnalysisService.ensureStaticRow(conn, creature.creatureId());
            }
            if (staticRow == null) continue;
            dynamicRows.add(computeDynamicRow(creature, staticRow, party));
        }

        return new RebuildPayload(partyLevels, dynamicRows);
    }

    private static boolean hasActiveParty(Connection conn) throws SQLException {
        return !loadActivePartyLevels(conn).isEmpty();
    }

    private static List<Integer> loadActivePartyLevels(Connection conn) throws SQLException {
        List<Integer> levels = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT level FROM player_characters WHERE in_party = 1 ORDER BY id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                levels.add(rs.getInt("level"));
            }
        }
        return levels;
    }

    private static CreatureDynamicRow computeDynamicRow(
            CreatureBaseRow creature,
            CreatureStaticRow staticRow,
            PartyBenchmarks party) {

        double hitChanceByParty = expectedHitChance(party.attackBonusPerAction(), creature.ac());
        double partyDamagePerAction = Math.max(1.0, party.damagePerAction());

        double survivabilityActions = Math.max(0.5,
                creature.hp() / Math.max(1.0, partyDamagePerAction * hitChanceByParty));

        double creatureBaseDamage = estimateCreatureDamagePerAction(creature.xp());
        double offensePressure = creatureBaseDamage * staticRow.baseActionUnitsPerRound() / Math.max(1.0, party.partyHpPool());
        double expectedTurnShare = staticRow.baseActionUnitsPerRound() / Math.max(1.0, party.actionsPerRound());
        double gmLoad = (staticRow.totalComplexityPoints() / 6.0) + (staticRow.baseActionUnitsPerRound() - 1.0);
        Set<CreatureCapabilityTag> capabilityTags = parseCapabilityTags(staticRow.capabilityTags());
        double averageOffensePressure = party.averageOffensePressurePerCreature();
        EncounterWeightClass weightClass = EncounterWeightClassClassifier.classify(
                staticRow,
                capabilityTags,
                survivabilityActions,
                offensePressure,
                averageOffensePressure,
                gmLoad);
        double minionness = EncounterWeightClassClassifier.minionness(
                survivabilityActions,
                offensePressure,
                averageOffensePressure);
        MonsterRole role = LegacyMonsterRoleMapper.toMonsterRole(
                weightClass,
                staticRow.primaryFunctionRole(),
                staticRow,
                survivabilityActions,
                offensePressure);
        String fitFlags = buildFitFlags(staticRow, survivabilityActions, expectedTurnShare);

        return new CreatureDynamicRow(
                creature.creatureId(),
                role,
                weightClass,
                survivabilityActions,
                offensePressure,
                expectedTurnShare,
                minionness,
                gmLoad,
                fitFlags);
    }

    private static String buildFitFlags(CreatureStaticRow staticRow, double survivabilityActions, double expectedTurnShare) {
        List<String> flags = new ArrayList<>();
        if (survivabilityActions <= 1.2) flags.add("ONE_SHOT_RISK");
        if (survivabilityActions >= 6.0) flags.add("LONG_TO_KILL");
        if (staticRow.totalComplexityPoints() >= 8) flags.add("HIGH_COMPLEXITY");
        if (expectedTurnShare >= 0.5) flags.add("HIGH_ACTION_SHARE");
        return String.join(",", flags);
    }

    private static double estimateCreatureDamagePerAction(int xp) {
        return Math.max(2.0, Math.sqrt(Math.max(1, xp)) * 0.55);
    }

    private static double expectedHitChance(double attackBonus, int targetAc) {
        double needed = targetAc - attackBonus;
        double raw = (21.0 - needed) / 20.0;
        return Math.max(0.05, Math.min(0.95, raw));
    }

    private static String sanitizeError(String message) {
        if (message == null || message.isBlank()) return "unknown rebuild failure";
        return message.length() > 400 ? message.substring(0, 400) : message;
    }

    private record PartyBenchmarks(
            double actionsPerRound,
            double damagePerAction,
            double attackBonusPerAction,
            double partyHpPool,
            int partySize
    ) {
        static PartyBenchmarks fromLevels(List<Integer> levels) {
            if (levels == null || levels.isEmpty()) {
                return new PartyBenchmarks(0.0, 0.0, 0.0, 0.0, 0);
            }
            double actions = 0.0;
            double damage = 0.0;
            double attackBonus = 0.0;
            double hp = 0.0;
            for (Integer rawLevel : levels) {
                int level = Math.max(1, Math.min(20, rawLevel == null ? 1 : rawLevel));
                actions += expectedActionsPerRound(level);
                damage += expectedDamagePerAction(level);
                attackBonus += expectedAttackBonus(level);
                hp += expectedPlayerHp(level);
            }
            return new PartyBenchmarks(
                    actions,
                    damage / levels.size(),
                    attackBonus / levels.size(),
                    hp,
                    levels.size());
        }

        private double averageOffensePressurePerCreature() {
            if (partySize <= 0 || partyHpPool <= 0.0) return 0.05;
            return (0.25 * expectedPlayerHp(Math.max(1, averagePartyLevel()))) / partyHpPool;
        }

        private int averagePartyLevel() {
            double hpPerCharacter = partyHpPool / Math.max(1, partySize);
            int level = (int) Math.round((hpPerCharacter - 10.0) / 7.5);
            return Math.max(1, Math.min(20, level));
        }

        private static double expectedActionsPerRound(int level) {
            if (level >= 11) return 1.45;
            if (level >= 5) return 1.30;
            return 1.10;
        }

        private static double expectedDamagePerAction(int level) {
            return 6.0 + (level - 1) * 1.75;
        }

        private static double expectedAttackBonus(int level) {
            if (level >= 17) return 11.0;
            if (level >= 13) return 10.0;
            if (level >= 9) return 9.0;
            if (level >= 5) return 8.0;
            return 6.0;
        }

        private static double expectedPlayerHp(int level) {
            return 10.0 + level * 7.5;
        }
    }

    private record RebuildPayload(
            List<Integer> partyLevels,
            List<CreatureDynamicRow> dynamicRows
    ) {}

    private static Set<CreatureCapabilityTag> parseCapabilityTags(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        java.util.EnumSet<CreatureCapabilityTag> tags = java.util.EnumSet.noneOf(CreatureCapabilityTag.class);
        for (String token : raw.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            try {
                tags.add(CreatureCapabilityTag.valueOf(trimmed));
            } catch (IllegalArgumentException ignored) {
                // Ignore stale persisted tag values.
            }
        }
        return Set.copyOf(tags);
    }

}
