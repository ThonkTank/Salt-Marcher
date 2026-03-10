package features.encounter.analysis.service;

import database.DatabaseManager;
import features.creaturecatalog.model.Creature;
import features.encounter.analysis.model.CreatureCapabilityTag;
import features.encounter.analysis.model.CreatureRoleProfile;
import features.encounter.analysis.service.CreatureFunctionRoleClassifier.Classification;
import features.encounter.analysis.model.EncounterWeightClass;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureBaseRow;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureDynamicRow;
import features.encounter.analysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.encounter.analysis.repository.EncounterPartyCacheRepository;
import features.encounter.analysis.repository.EncounterPartyCacheRepository.CacheState;
import features.encounter.analysis.repository.EncounterPartyCacheRepository.CacheStatus;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.PartyRelativeMetrics;
import features.gamerules.model.MonsterRole;
import features.party.repository.PlayerCharacterRepository;

import java.sql.Connection;
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

    public record GenerationSnapshot(
            CacheReadiness readiness,
            Long runId,
            int partyCompositionVersion,
            String partyCompositionHash,
            Map<Long, CreatureRoleProfile> roleProfilesByCreatureId
    ) {
        public GenerationSnapshot {
            roleProfilesByCreatureId = roleProfilesByCreatureId == null ? Map.of() : Map.copyOf(roleProfilesByCreatureId);
        }
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

    public static MonsterRole classifyRoleForActiveParty(Creature creature) {
        if (creature == null) {
            return MonsterRole.SOLDIER;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            if (creature.Id != null && hasCurrentValidCache(conn)) {
                CreatureRoleProfile cachedProfile =
                        EncounterPartyAnalysisRepository.loadRoleProfileForCreature(conn, creature.Id);
                if (cachedProfile != null) {
                    return EncounterRoleProjector.projectMonsterRole(cachedProfile);
                }
            }
            List<Integer> partyLevels = loadActivePartyLevels(conn);
            if (partyLevels.isEmpty()) {
                return EncounterRoleProjector.projectMonsterRole(
                        fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1)));
            }
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
            }
            return EncounterRoleProjector.projectMonsterRole(
                    fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForLevels(partyLevels)));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.classifyRoleForActiveParty(): DB access failed", e);
            return EncounterRoleProjector.projectMonsterRole(
                    fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1)));
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

    public static GenerationSnapshot loadGenerationSnapshot() {
        return loadGenerationSnapshot(Set.of());
    }

    public static GenerationSnapshot loadGenerationSnapshot(Set<Long> creatureIds) {
        try (Connection conn = DatabaseManager.getConnection()) {
            CacheState state = EncounterPartyCacheRepository.ensureState(conn);
            String currentHash = EncounterPartyCacheRepository.computeCurrentPartyHash(conn);
            if (!isCurrentValidState(state, currentHash)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
                return new GenerationSnapshot(
                        CacheReadiness.NOT_READY,
                        null,
                        state.partyCompVersion(),
                        currentHash,
                        Map.of());
            }
            long runId = state.activeRunId();
            return new GenerationSnapshot(
                    CacheReadiness.READY,
                    runId,
                    state.partyCompVersion(),
                    state.partyCompHash(),
                    EncounterPartyAnalysisRepository.loadRoleProfilesForRun(conn, runId, creatureIds));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.loadGenerationSnapshot(): DB access failed", e);
            return new GenerationSnapshot(CacheReadiness.STORAGE_ERROR, null, 0, null, Map.of());
        }
    }

    private static boolean hasCurrentValidCache(Connection conn) throws SQLException {
        CacheState state = EncounterPartyCacheRepository.ensureState(conn);
        if (state.cacheStatus() != CacheStatus.VALID || state.activeRunId() == null) {
            return false;
        }
        String currentHash = EncounterPartyCacheRepository.computeCurrentPartyHash(conn);
        return isCurrentValidState(state, currentHash);
    }

    private static boolean isCurrentValidState(CacheState state, String currentHash) {
        if (state.cacheStatus() != CacheStatus.VALID || state.activeRunId() == null) {
            return false;
        }
        return currentHash.equals(state.partyCompHash());
    }

    private static RebuildPayload buildPayload(Connection conn, List<Integer> partyLevels) throws SQLException {
        EncounterPartyBenchmarks party = EncounterCalibrationService.partyBenchmarksForLevels(partyLevels);

        Map<Long, CreatureBaseRow> creatures = EncounterPartyAnalysisRepository.loadAllCreatureBaseRows(conn);
        Map<Long, CreatureStaticRow> persistedStaticRows = EncounterPartyAnalysisRepository.loadStaticRows(conn);
        List<CreatureDynamicRow> dynamicRows = new ArrayList<>(creatures.size());

        for (CreatureBaseRow creature : creatures.values()) {
            CreatureStaticRow staticRow = persistedStaticRows.get(creature.creatureId());
            if (staticRow == null || staticRow.analysisVersion() < CreatureStaticAnalysisService.analysisVersion()) {
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
        return new ArrayList<>(PlayerCharacterRepository.getActivePartyLevels(conn));
    }

    private static CreatureDynamicRow computeDynamicRow(
            CreatureBaseRow creature,
            CreatureStaticRow staticRow,
            EncounterPartyBenchmarks party) {
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(
                creature.hp(),
                creature.ac(),
                creature.xp(),
                staticRow.baseActionUnitsPerRound(),
                party);
        double survivabilityActions = metrics.survivabilityActions();
        double offensePressure = metrics.offensePressure();
        double expectedTurnShare = metrics.expectedTurnShare();
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
        CreatureRoleProfile profile = new CreatureRoleProfile(
                creature.creatureId(),
                weightClass,
                staticRow.primaryFunctionRole(),
                staticRow.secondaryFunctionRole(),
                capabilityTags,
                survivabilityActions,
                staticRow.baseActionUnitsPerRound(),
                offensePressure,
                expectedTurnShare,
                gmLoad,
                Set.of());
        MonsterRole role = EncounterRoleProjector.projectMonsterRole(profile);
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

    private static String sanitizeError(String message) {
        if (message == null || message.isBlank()) return "unknown rebuild failure";
        return message.length() > 400 ? message.substring(0, 400) : message;
    }

    private record RebuildPayload(
            List<Integer> partyLevels,
            List<CreatureDynamicRow> dynamicRows
    ) {}

    private static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party) {
        CreatureStaticRow staticRow = CreatureStaticAnalysisService.analyzeCreature(creature);
        Classification classification = CreatureFunctionRoleClassifier.classify(staticRow);
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(
                creature.HP,
                creature.AC,
                creature.XP,
                staticRow.baseActionUnitsPerRound(),
                party);
        double gmLoad = (staticRow.totalComplexityPoints() / 6.0) + (staticRow.baseActionUnitsPerRound() - 1.0);
        EncounterWeightClass weightClass = EncounterWeightClassClassifier.classify(
                staticRow,
                classification.capabilityTags(),
                metrics.survivabilityActions(),
                metrics.offensePressure(),
                party.averageOffensePressurePerCreature(),
                gmLoad);
        return new CreatureRoleProfile(
                creature.Id,
                weightClass,
                classification.primaryRole(),
                classification.secondaryRole(),
                classification.capabilityTags(),
                metrics.survivabilityActions(),
                staticRow.baseActionUnitsPerRound(),
                metrics.offensePressure(),
                metrics.expectedTurnShare(),
                gmLoad,
                Set.of());
    }

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
