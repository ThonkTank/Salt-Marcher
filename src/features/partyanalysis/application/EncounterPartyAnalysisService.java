package features.partyanalysis.application;

import database.DatabaseManager;
import features.creatures.model.Creature;
import features.partyanalysis.service.CreatureStaticAnalysisService;
import features.partyanalysis.service.EncounterWeightClassClassifier;
import features.partyanalysis.model.AnalysisModelVersion;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.EncounterWeightClass;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureBaseRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureDynamicRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ParsedActionProfile;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.partyanalysis.service.CreatureDamagePotentialCalculator;
import features.partyanalysis.repository.EncounterPartyCacheRepository;
import features.partyanalysis.repository.EncounterPartyCacheRepository.CacheState;
import features.partyanalysis.repository.EncounterPartyCacheRepository.CacheStatus;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.PartyRelativeMetrics;
import features.party.api.PartyApi;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
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

    public enum AnalysisInputRefreshOutcome {
        INVALIDATED,
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

    public static AnalysisInputRefreshOutcome refreshForAnalysisInputChange() {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return AnalysisInputRefreshOutcome.INVALIDATED;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.refreshForAnalysisInputChange(): refresh failed", e);
            return AnalysisInputRefreshOutcome.STORAGE_ERROR;
        }
    }

    public static AnalysisInputRefreshOutcome rebuildForAnalysisInputChange() {
        try (Connection conn = DatabaseManager.getConnection()) {
            rebuildAllPersistedAnalysis(conn);
            if (hasActiveParty(conn)) {
                rebuildCurrentPartyCache(conn);
                return AnalysisInputRefreshOutcome.REBUILT;
            }
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return AnalysisInputRefreshOutcome.INVALIDATED_NO_ACTIVE_PARTY;
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.rebuildForAnalysisInputChange(): refresh failed", e);
            return AnalysisInputRefreshOutcome.STORAGE_ERROR;
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

    public static CreatureRoleProfile classifyRoleProfileForActiveParty(Creature creature) {
        if (creature == null) {
            return new CreatureRoleProfile(null, EncounterWeightClass.REGULAR, null, Set.of(),
                    0.0, 1.0, 0.0, 0, Set.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            if (creature.Id != null && hasCurrentValidCache(conn)) {
                CreatureRoleProfile cachedProfile =
                        EncounterPartyAnalysisRepository.loadRoleProfileForCreature(conn, creature.Id);
                if (cachedProfile != null) {
                    return cachedProfile;
                }
            }
            List<Integer> partyLevels = loadActivePartyLevels(conn);
            if (partyLevels.isEmpty()) {
                return fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1));
            }
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort();
            }
            return fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForLevels(partyLevels), conn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.classifyRoleProfileForActiveParty(): DB access failed", e);
            return fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1));
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
        return state.analysisModelVersion() == AnalysisModelVersion.current()
                && currentHash.equals(state.partyCompHash());
    }

    private static RebuildPayload buildPayload(Connection conn, List<Integer> partyLevels) throws SQLException {
        EncounterPartyBenchmarks party = EncounterCalibrationService.partyBenchmarksForLevels(partyLevels);

        Map<Long, CreatureBaseRow> creatures = EncounterPartyAnalysisRepository.loadAllCreatureBaseRows(conn);
        Map<Long, List<ParsedActionProfile>> actionRowsByCreatureId =
                groupActionRowsByCreatureId(EncounterPartyAnalysisRepository.loadAllParsedActionProfiles(conn).values());
        Map<Long, CreatureStaticRow> persistedStaticRows = EncounterPartyAnalysisRepository.loadStaticRows(conn);
        List<CreatureDynamicRow> dynamicRows = new ArrayList<>(creatures.size());

        for (CreatureBaseRow creature : creatures.values()) {
            CreatureStaticRow staticRow = persistedStaticRows.get(creature.creatureId());
            if (staticRow == null || staticRow.analysisVersion() < AnalysisModelVersion.current()) {
                staticRow = CreatureStaticAnalysisService.ensureStaticRow(conn, creature.creatureId());
            }
            if (staticRow == null) continue;
            List<ParsedActionProfile> actionProfiles = actionRowsByCreatureId.get(creature.creatureId());
            if (actionProfiles == null || hasIncompleteActionProfiles(actionProfiles)) {
                CreatureStaticAnalysisService.refreshForCreature(conn, creature.creatureId());
                staticRow = CreatureStaticAnalysisService.ensureStaticRow(conn, creature.creatureId());
                actionProfiles = new ArrayList<>(EncounterPartyAnalysisRepository
                        .loadParsedActionProfilesForCreature(conn, creature.creatureId()).values());
            }
            dynamicRows.add(computeDynamicRow(
                    creature,
                    staticRow,
                    actionProfiles == null ? List.of() : actionProfiles,
                    party));
        }

        return new RebuildPayload(partyLevels, dynamicRows);
    }

    private static void rebuildAllPersistedAnalysis(Connection conn) throws SQLException {
        for (CreatureBaseRow creature : EncounterPartyAnalysisRepository.loadAllCreatureBaseRows(conn).values()) {
            CreatureStaticAnalysisService.refreshForCreature(conn, creature.creatureId());
        }
    }

    private static boolean hasActiveParty(Connection conn) throws SQLException {
        return !loadActivePartyLevels(conn).isEmpty();
    }

    private static List<Integer> loadActivePartyLevels(Connection conn) throws SQLException {
        return new ArrayList<>(PartyApi.loadActivePartyLevels(conn));
    }

    private static CreatureDynamicRow computeDynamicRow(
            CreatureBaseRow creature,
            CreatureStaticRow staticRow,
            List<ParsedActionProfile> actionRows,
            EncounterPartyBenchmarks party) {
        CreatureDamagePotentialCalculator.DamagePotentialSummary damagePotential =
                CreatureDamagePotentialCalculator.summarize(
                        actionRows,
                        creature.legendaryActionCount(),
                        estimateSurvivabilityActions(creature.hp(), creature.ac(), party),
                        party);
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(
                creature.hp(),
                creature.ac(),
                party);
        double survivabilityActions = metrics.survivabilityActions();
        double offensePressure = damagePotential.normalizedDamagePotential();
        double gmLoad = staticRow.complexFeatureCount();
        EncounterWeightClass weightClass = EncounterWeightClassClassifier.classify(
                survivabilityActions,
                metrics.survivabilityRounds(),
                offensePressure);
        double minionness = EncounterWeightClassClassifier.minionness(
                survivabilityActions,
                offensePressure);
        String fitFlags = buildFitFlags(staticRow, survivabilityActions, offensePressure);

        return new CreatureDynamicRow(
                creature.creatureId(),
                weightClass,
                survivabilityActions,
                damagePotential.actionUnitsPerRound(),
                offensePressure,
                minionness,
                gmLoad,
                fitFlags);
    }

    private static String buildFitFlags(CreatureStaticRow staticRow, double survivabilityActions, double damagePotential) {
        List<String> flags = new ArrayList<>();
        if (survivabilityActions <= 1.2) flags.add("ONE_SHOT_RISK");
        if (survivabilityActions >= 6.0) flags.add("LONG_TO_KILL");
        if (staticRow.complexFeatureCount() >= 4) flags.add("HIGH_COMPLEXITY");
        if (damagePotential >= 0.75) flags.add("HIGH_DAMAGE_POTENTIAL");
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

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party) {
        if (creature == null) {
            return new CreatureRoleProfile(null, EncounterWeightClass.REGULAR, null, Set.of(),
                    0.0, 1.0, 0.0, 0, Set.of());
        }
        if (creature.Id == null) {
            PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(creature.HP, creature.AC, party);
            return new CreatureRoleProfile(
                    null,
                    EncounterWeightClass.REGULAR,
                    null,
                    Set.of(),
                    metrics.survivabilityActions(),
                    1.0,
                    0.0,
                    0,
                    Set.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return fallbackRoleProfile(creature, party, conn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "EncounterPartyAnalysisService.fallbackRoleProfile(): DB access failed", e);
            PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(creature.HP, creature.AC, party);
            return new CreatureRoleProfile(
                    creature.Id,
                    EncounterWeightClass.REGULAR,
                    null,
                    Set.of(),
                    metrics.survivabilityActions(),
                    1.0,
                    0.0,
                    0,
                    Set.of());
        }
    }

    private static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party,
            Connection conn) throws SQLException {
        ensurePersistedAnalysis(conn, creature.Id);
        CreatureStaticRow staticRow = CreatureStaticAnalysisService.ensureStaticRow(conn, creature.Id);
        List<ParsedActionProfile> actionRows = new ArrayList<>(
                EncounterPartyAnalysisRepository.loadParsedActionProfilesForCreature(conn, creature.Id).values());
        if (staticRow == null) {
            return new CreatureRoleProfile(
                    creature.Id,
                    EncounterWeightClass.REGULAR,
                    null,
                    Set.of(),
                    0.0,
                    1.0,
                    0.0,
                    0,
                    Set.of());
        }
        CreatureDamagePotentialCalculator.DamagePotentialSummary damagePotential =
                CreatureDamagePotentialCalculator.summarize(
                        actionRows,
                        Math.max(0, creature.LegendaryActionCount),
                        estimateSurvivabilityActions(creature.HP, creature.AC, party),
                        party);
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(
                creature.HP,
                creature.AC,
                party);
        EncounterWeightClass weightClass = EncounterWeightClassClassifier.classify(
                metrics.survivabilityActions(),
                metrics.survivabilityRounds(),
                damagePotential.normalizedDamagePotential());
        return new CreatureRoleProfile(
                creature.Id,
                weightClass,
                staticRow.primaryFunctionRole(),
                parseCapabilityTags(staticRow.capabilityTags()),
                metrics.survivabilityActions(),
                damagePotential.actionUnitsPerRound(),
                damagePotential.normalizedDamagePotential(),
                staticRow.complexFeatureCount(),
                Set.of());
    }

    private static double estimateSurvivabilityActions(int hp, int ac, EncounterPartyBenchmarks party) {
        return EncounterCalibrationService.partyRelativeMetrics(hp, ac, party).survivabilityActions();
    }

    private static void ensurePersistedAnalysis(Connection conn, Long creatureId) throws SQLException {
        if (creatureId == null) {
            return;
        }
        CreatureStaticRow staticRow = EncounterPartyAnalysisRepository.loadStaticRow(conn, creatureId);
        Map<Long, ParsedActionProfile> actionProfiles =
                EncounterPartyAnalysisRepository.loadParsedActionProfilesForCreature(conn, creatureId);
        if (staticRow == null
                || staticRow.analysisVersion() < AnalysisModelVersion.current()
                || actionProfiles.isEmpty()
                || hasIncompleteActionProfiles(actionProfiles.values())) {
            CreatureStaticAnalysisService.refreshForCreature(conn, creatureId);
        }
    }

    private static boolean hasIncompleteActionProfiles(Iterable<ParsedActionProfile> actionProfiles) {
        for (ParsedActionProfile profile : actionProfiles) {
            if (profile == null) {
                continue;
            }
            if (profile.analysisVersion() < AnalysisModelVersion.current()
                    || profile.actionChannel() == null
                    || profile.targetingHint() == null) {
                return true;
            }
        }
        return false;
    }

    private static Set<features.creatures.model.CreatureCapabilityTag> parseCapabilityTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        EnumSet<features.creatures.model.CreatureCapabilityTag> tags =
                EnumSet.noneOf(features.creatures.model.CreatureCapabilityTag.class);
        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(value -> {
                    try {
                        tags.add(features.creatures.model.CreatureCapabilityTag.valueOf(value));
                    } catch (IllegalArgumentException ignored) {
                    }
                });
        return Set.copyOf(tags);
    }

    private static Map<Long, List<ParsedActionProfile>> groupActionRowsByCreatureId(Iterable<ParsedActionProfile> actionRows) {
        Map<Long, List<ParsedActionProfile>> grouped = new java.util.HashMap<>();
        for (ParsedActionProfile actionRow : actionRows) {
            grouped.computeIfAbsent(actionRow.creatureId(), ignored -> new ArrayList<>()).add(actionRow);
        }
        return grouped;
    }
}
