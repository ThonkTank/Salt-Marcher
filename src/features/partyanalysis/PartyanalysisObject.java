package features.partyanalysis;

import database.DatabaseManager;
import features.creatures.model.Creature;
import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.encounter.calibration.service.EncounterCalibrationService.PartyRelativeMetrics;
import features.party.PartyObject;
import features.party.input.LoadActivePartyLevelsInput;
import features.partyanalysis.input.ClassifyRoleProfileForActivePartyInput;
import features.partyanalysis.input.EnsureCacheReadyInput;
import features.partyanalysis.input.FallbackRoleProfileInput;
import features.partyanalysis.input.InvalidateCurrentPartyCacheInput;
import features.partyanalysis.input.LoadGenerationSnapshotInput;
import features.partyanalysis.input.LoadRoleProfilesForActivePartyInput;
import features.partyanalysis.input.LoadStaticRoleHintsInput;
import features.partyanalysis.input.RebuildCurrentPartyCacheAsyncBestEffortInput;
import features.partyanalysis.input.RebuildCurrentPartyCacheInput;
import features.partyanalysis.input.RebuildForAnalysisInputChangeInput;
import features.partyanalysis.input.RefreshCacheForCreatureDataChangeInput;
import features.partyanalysis.input.RefreshCurrentPartyCacheAsyncBestEffortInput;
import features.partyanalysis.input.RefreshForAnalysisInputChangeInput;
import features.partyanalysis.input.RefreshForCreatureInput;
import features.partyanalysis.model.AnalysisModelVersion;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.EncounterWeightClass;
import features.partyanalysis.model.StaticCreatureRoleHint;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureBaseRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureDynamicRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.partyanalysis.repository.EncounterPartyAnalysisRepository.ParsedActionProfile;
import features.partyanalysis.repository.EncounterPartyCacheRepository;
import features.partyanalysis.repository.EncounterPartyCacheRepository.CacheState;
import features.partyanalysis.repository.EncounterPartyCacheRepository.CacheStatus;
import features.partyanalysis.service.CreatureDamagePotentialCalculator;
import features.partyanalysis.service.CreatureStaticAnalysisService;
import features.partyanalysis.service.EncounterWeightClassClassifier;

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

/**
 * Canonical root seam for party-analysis reads, cache workflows, and
 * maintenance refresh flows consumed by encounter, importer, and party-owned
 * features.
 */
@SuppressWarnings("unused")
public final class PartyanalysisObject {
    private static final Logger LOGGER = Logger.getLogger(PartyanalysisObject.class.getName());
    private static final PartyObject PARTY_OBJECT = new PartyObject();

    public EnsureCacheReadyInput.EnsuredCacheReadyInput ensureCacheReady(EnsureCacheReadyInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (hasCurrentValidCache(conn)) {
                return new EnsureCacheReadyInput.EnsuredCacheReadyInput(EnsureCacheReadyInput.CacheReadiness.READY);
            }
            return new EnsureCacheReadyInput.EnsuredCacheReadyInput(EnsureCacheReadyInput.CacheReadiness.NOT_READY);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyanalysisObject.ensureCacheReady(): DB access failed", e);
            return new EnsureCacheReadyInput.EnsuredCacheReadyInput(EnsureCacheReadyInput.CacheReadiness.STORAGE_ERROR);
        }
    }

    public InvalidateCurrentPartyCacheInput.InvalidatedCurrentPartyCacheInput invalidateCurrentPartyCache(
            InvalidateCurrentPartyCacheInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterPartyCacheRepository.invalidateForCurrentParty(conn);
            return new InvalidateCurrentPartyCacheInput.InvalidatedCurrentPartyCacheInput(
                    InvalidateCurrentPartyCacheInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyanalysisObject.invalidateCurrentPartyCache(): DB access failed", e);
            return new InvalidateCurrentPartyCacheInput.InvalidatedCurrentPartyCacheInput(
                    InvalidateCurrentPartyCacheInput.Status.STORAGE_ERROR);
        }
    }

    public RebuildCurrentPartyCacheInput.RebuiltCurrentPartyCacheInput rebuildCurrentPartyCache(
            RebuildCurrentPartyCacheInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            rebuildCurrentPartyCache(conn);
            return new RebuildCurrentPartyCacheInput.RebuiltCurrentPartyCacheInput(
                    RebuildCurrentPartyCacheInput.Status.SUCCESS);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyanalysisObject.rebuildCurrentPartyCache(): DB rebuild failed", e);
            return new RebuildCurrentPartyCacheInput.RebuiltCurrentPartyCacheInput(
                    RebuildCurrentPartyCacheInput.Status.STORAGE_ERROR);
        }
    }

    public RebuildCurrentPartyCacheAsyncBestEffortInput.RebuiltCurrentPartyCacheAsyncBestEffortInput rebuildCurrentPartyCacheAsyncBestEffort(
            RebuildCurrentPartyCacheAsyncBestEffortInput input) {
        CompletableFuture.runAsync(() -> {
            RebuildCurrentPartyCacheInput.RebuiltCurrentPartyCacheInput rebuilt =
                    rebuildCurrentPartyCache(new RebuildCurrentPartyCacheInput());
            if (rebuilt.status() != RebuildCurrentPartyCacheInput.Status.SUCCESS) {
                LOGGER.warning("PartyanalysisObject.rebuildCurrentPartyCacheAsyncBestEffort(): rebuild failed");
            }
        });
        return new RebuildCurrentPartyCacheAsyncBestEffortInput.RebuiltCurrentPartyCacheAsyncBestEffortInput(true);
    }

    public RefreshCurrentPartyCacheAsyncBestEffortInput.RefreshedCurrentPartyCacheAsyncBestEffortInput refreshCurrentPartyCacheAsyncBestEffort(
            RefreshCurrentPartyCacheAsyncBestEffortInput input) {
        CompletableFuture.runAsync(() -> {
            InvalidateCurrentPartyCacheInput.InvalidatedCurrentPartyCacheInput invalidated =
                    invalidateCurrentPartyCache(new InvalidateCurrentPartyCacheInput());
            if (invalidated.status() != InvalidateCurrentPartyCacheInput.Status.SUCCESS) {
                LOGGER.warning("PartyanalysisObject.refreshCurrentPartyCacheAsyncBestEffort(): invalidation failed");
                return;
            }
            RebuildCurrentPartyCacheInput.RebuiltCurrentPartyCacheInput rebuilt =
                    rebuildCurrentPartyCache(new RebuildCurrentPartyCacheInput());
            if (rebuilt.status() != RebuildCurrentPartyCacheInput.Status.SUCCESS) {
                LOGGER.warning("PartyanalysisObject.refreshCurrentPartyCacheAsyncBestEffort(): rebuild failed");
            }
        });
        return new RefreshCurrentPartyCacheAsyncBestEffortInput.RefreshedCurrentPartyCacheAsyncBestEffortInput(true);
    }

    public RefreshCacheForCreatureDataChangeInput.RefreshedCacheForCreatureDataChangeInput refreshCacheForCreatureDataChange(
            RefreshCacheForCreatureDataChangeInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (hasActiveParty(conn)) {
                rebuildCurrentPartyCache(conn);
                return new RefreshCacheForCreatureDataChangeInput.RefreshedCacheForCreatureDataChangeInput(
                        RefreshCacheForCreatureDataChangeInput.Outcome.REBUILT);
            }
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return new RefreshCacheForCreatureDataChangeInput.RefreshedCacheForCreatureDataChangeInput(
                    RefreshCacheForCreatureDataChangeInput.Outcome.INVALIDATED_NO_ACTIVE_PARTY);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.refreshCacheForCreatureDataChange(): DB refresh failed", e);
            return new RefreshCacheForCreatureDataChangeInput.RefreshedCacheForCreatureDataChangeInput(
                    RefreshCacheForCreatureDataChangeInput.Outcome.STORAGE_ERROR);
        }
    }

    public RefreshForAnalysisInputChangeInput.RefreshedForAnalysisInputChangeInput refreshForAnalysisInputChange(
            RefreshForAnalysisInputChangeInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return new RefreshForAnalysisInputChangeInput.RefreshedForAnalysisInputChangeInput(
                    RefreshForAnalysisInputChangeInput.Outcome.INVALIDATED);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.refreshForAnalysisInputChange(): refresh failed", e);
            return new RefreshForAnalysisInputChangeInput.RefreshedForAnalysisInputChangeInput(
                    RefreshForAnalysisInputChangeInput.Outcome.STORAGE_ERROR);
        }
    }

    public RebuildForAnalysisInputChangeInput.RebuiltForAnalysisInputChangeInput rebuildForAnalysisInputChange(
            RebuildForAnalysisInputChangeInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            rebuildAllPersistedAnalysis(conn);
            if (hasActiveParty(conn)) {
                rebuildCurrentPartyCache(conn);
                return new RebuildForAnalysisInputChangeInput.RebuiltForAnalysisInputChangeInput(
                        RebuildForAnalysisInputChangeInput.Outcome.REBUILT);
            }
            EncounterPartyCacheRepository.invalidateForCreatureDataChange(conn);
            return new RebuildForAnalysisInputChangeInput.RebuiltForAnalysisInputChangeInput(
                    RebuildForAnalysisInputChangeInput.Outcome.INVALIDATED_NO_ACTIVE_PARTY);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.rebuildForAnalysisInputChange(): refresh failed", e);
            return new RebuildForAnalysisInputChangeInput.RebuiltForAnalysisInputChangeInput(
                    RebuildForAnalysisInputChangeInput.Outcome.STORAGE_ERROR);
        }
    }

    public RefreshForCreatureInput.RefreshedForCreatureInput refreshForCreature(RefreshForCreatureInput input) throws SQLException {
        if (input.connection() == null) {
            throw new IllegalArgumentException("PartyanalysisObject.refreshForCreature(): connection is required");
        }
        CreatureStaticAnalysisService.refreshForCreature(input.connection(), input.creatureId());
        return new RefreshForCreatureInput.RefreshedForCreatureInput();
    }

    public ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput classifyRoleProfileForActiveParty(
            ClassifyRoleProfileForActivePartyInput input) {
        Creature creature = input == null ? null : input.creature();
        if (creature == null) {
            return new ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput(
                    emptyRoleProfile());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            if (creature.Id != null && hasCurrentValidCache(conn)) {
                CreatureRoleProfile cachedProfile =
                        EncounterPartyAnalysisRepository.loadRoleProfileForCreature(conn, creature.Id);
                if (cachedProfile != null) {
                    return new ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput(cachedProfile);
                }
            }
            List<Integer> partyLevels = loadActivePartyLevels(conn);
            if (partyLevels.isEmpty()) {
                return new ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput(
                        fallbackRoleProfile(new FallbackRoleProfileInput(
                                creature,
                                EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1),
                                null)).roleProfile());
            }
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort(new RebuildCurrentPartyCacheAsyncBestEffortInput());
            }
            return new ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput(
                    fallbackRoleProfile(creature, EncounterCalibrationService.partyBenchmarksForLevels(partyLevels), conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.classifyRoleProfileForActiveParty(): DB access failed", e);
            return new ClassifyRoleProfileForActivePartyInput.ClassifiedRoleProfileForActivePartyInput(
                    fallbackRoleProfile(new FallbackRoleProfileInput(
                            creature,
                            EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1),
                            null)).roleProfile());
        }
    }

    public LoadRoleProfilesForActivePartyInput.LoadedRoleProfilesForActivePartyInput loadRoleProfilesForActiveParty(
            LoadRoleProfilesForActivePartyInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (!hasCurrentValidCache(conn)) {
                rebuildCurrentPartyCacheAsyncBestEffort(new RebuildCurrentPartyCacheAsyncBestEffortInput());
                return new LoadRoleProfilesForActivePartyInput.LoadedRoleProfilesForActivePartyInput(Map.of());
            }
            return new LoadRoleProfilesForActivePartyInput.LoadedRoleProfilesForActivePartyInput(
                    EncounterPartyAnalysisRepository.loadRoleProfilesForActiveRun(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.loadRoleProfilesForActiveParty(): DB access failed", e);
            return new LoadRoleProfilesForActivePartyInput.LoadedRoleProfilesForActivePartyInput(Map.of());
        }
    }

    public LoadGenerationSnapshotInput.LoadedGenerationSnapshotInput loadGenerationSnapshot(LoadGenerationSnapshotInput input) {
        Set<Long> creatureIds = input == null || input.creatureIds() == null ? Set.of() : input.creatureIds();
        try (Connection conn = DatabaseManager.getConnection()) {
            CacheState state = EncounterPartyCacheRepository.ensureState(conn);
            String currentHash = EncounterPartyCacheRepository.computeCurrentPartyHash(conn);
            if (!isCurrentValidState(state, currentHash)) {
                rebuildCurrentPartyCacheAsyncBestEffort(new RebuildCurrentPartyCacheAsyncBestEffortInput());
                return new LoadGenerationSnapshotInput.LoadedGenerationSnapshotInput(
                        LoadGenerationSnapshotInput.CacheReadiness.NOT_READY,
                        null,
                        state.partyCompVersion(),
                        currentHash,
                        Map.of());
            }
            long runId = state.activeRunId();
            return new LoadGenerationSnapshotInput.LoadedGenerationSnapshotInput(
                    LoadGenerationSnapshotInput.CacheReadiness.READY,
                    runId,
                    state.partyCompVersion(),
                    state.partyCompHash(),
                    EncounterPartyAnalysisRepository.loadRoleProfilesForRun(conn, runId, creatureIds));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.loadGenerationSnapshot(): DB access failed", e);
            return new LoadGenerationSnapshotInput.LoadedGenerationSnapshotInput(
                    LoadGenerationSnapshotInput.CacheReadiness.STORAGE_ERROR,
                    null,
                    0,
                    null,
                    Map.of());
        }
    }

    public LoadStaticRoleHintsInput.LoadedStaticRoleHintsInput loadStaticRoleHints(LoadStaticRoleHintsInput input) {
        Set<Long> creatureIds = input == null || input.creatureIds() == null ? Set.of() : input.creatureIds();
        if (creatureIds.isEmpty()) {
            return new LoadStaticRoleHintsInput.LoadedStaticRoleHintsInput(Map.of());
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            Map<Long, CreatureStaticRow> rows = EncounterPartyAnalysisRepository.loadStaticRows(conn, creatureIds);
            if (rows.isEmpty()) {
                return new LoadStaticRoleHintsInput.LoadedStaticRoleHintsInput(Map.of());
            }
            Map<Long, StaticCreatureRoleHint> hints = new java.util.HashMap<>(rows.size());
            for (Map.Entry<Long, CreatureStaticRow> entry : rows.entrySet()) {
                CreatureStaticRow row = entry.getValue();
                if (row == null || row.analysisVersion() < AnalysisModelVersion.current()) {
                    continue;
                }
                hints.put(entry.getKey(), toStaticRoleHint(row));
            }
            return new LoadStaticRoleHintsInput.LoadedStaticRoleHintsInput(
                    hints.isEmpty() ? Map.of() : Map.copyOf(hints));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.loadStaticRoleHints(): DB access failed", e);
            return new LoadStaticRoleHintsInput.LoadedStaticRoleHintsInput(Map.of());
        }
    }

    public FallbackRoleProfileInput.FallbackRoleProfileResolvedInput fallbackRoleProfile(FallbackRoleProfileInput input) {
        Creature creature = input == null ? null : input.creature();
        EncounterPartyBenchmarks partyBenchmarks =
                input != null && input.partyBenchmarks() != null
                        ? input.partyBenchmarks()
                        : EncounterCalibrationService.partyBenchmarksForAverageLevel(1, 1);
        if (creature == null) {
            return new FallbackRoleProfileInput.FallbackRoleProfileResolvedInput(emptyRoleProfile());
        }
        if (input != null && input.staticRoleHint() != null) {
            return new FallbackRoleProfileInput.FallbackRoleProfileResolvedInput(
                    fallbackRoleProfile(creature, partyBenchmarks, input.staticRoleHint()));
        }
        if (creature.Id == null) {
            return new FallbackRoleProfileInput.FallbackRoleProfileResolvedInput(
                    defaultFallbackRoleProfile(null, creature, partyBenchmarks));
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return new FallbackRoleProfileInput.FallbackRoleProfileResolvedInput(
                    fallbackRoleProfile(creature, partyBenchmarks, conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING,
                    "PartyanalysisObject.fallbackRoleProfile(): DB access failed", e);
            return new FallbackRoleProfileInput.FallbackRoleProfileResolvedInput(
                    defaultFallbackRoleProfile(creature.Id, creature, partyBenchmarks));
        }
    }

    private static void rebuildCurrentPartyCache(Connection conn) throws SQLException {
        boolean wasAutoCommit = conn.getAutoCommit();
        Long[] runIdHolder = new Long[1];
        boolean[] lockAcquiredHolder = new boolean[1];

        try {
            conn.setAutoCommit(false);
            CacheState invalidated = EncounterPartyCacheRepository.invalidateForCurrentParty(conn);
            runIdHolder[0] = EncounterPartyAnalysisRepository.createRun(
                    conn,
                    invalidated.partyCompVersion(),
                    invalidated.partyCompHash());
            lockAcquiredHolder[0] = EncounterPartyCacheRepository.markRebuilding(
                    conn,
                    runIdHolder[0],
                    invalidated.partyCompVersion(),
                    invalidated.partyCompHash());
            if (!lockAcquiredHolder[0]) {
                EncounterPartyAnalysisRepository.markRunFailed(conn, runIdHolder[0], "rebuild already in progress");
                EncounterPartyAnalysisRepository.cleanupRuns(conn);
                conn.commit();
                LOGGER.log(Level.FINE,
                        "PartyanalysisObject.rebuildCurrentPartyCache(): skipped concurrent rebuild for run {0}",
                        runIdHolder[0]);
                return;
            }
            conn.commit();

            conn.setAutoCommit(false);
            List<Integer> partyLevels = loadActivePartyLevels(conn);
            if (partyLevels.isEmpty()) {
                EncounterPartyAnalysisRepository.markRunFailed(conn, runIdHolder[0], "active party is empty");
                EncounterPartyCacheRepository.markError(conn, runIdHolder[0], "active party is empty");
                conn.commit();
                return;
            }
            RebuildPayload payload = buildPayload(conn, partyLevels);
            EncounterPartyAnalysisRepository.insertPartyDynamicRows(conn, runIdHolder[0], payload.dynamicRows());
            EncounterPartyAnalysisRepository.markRunReady(conn, runIdHolder[0]);
            if (!EncounterPartyCacheRepository.markValid(conn, runIdHolder[0])) {
                throw new SQLException("party cache rebuild lock lost before finalization");
            }
            EncounterPartyAnalysisRepository.cleanupRuns(conn);
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            if (runIdHolder[0] != null && lockAcquiredHolder[0]) {
                try {
                    conn.setAutoCommit(false);
                    EncounterPartyAnalysisRepository.markRunFailed(conn, runIdHolder[0], sanitizeError(e.getMessage()));
                    EncounterPartyCacheRepository.markError(conn, runIdHolder[0], sanitizeError(e.getMessage()));
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
                continue;
            }
            List<ParsedActionProfile> actionProfiles = actionRowsByCreatureId.get(creature.creatureId());
            if (actionProfiles == null || hasIncompleteActionProfiles(actionProfiles)) {
                continue;
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
        return new ArrayList<>(PARTY_OBJECT.loadActivePartyLevels(new LoadActivePartyLevelsInput(conn)).levels());
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

    private static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party,
            Connection conn) throws SQLException {
        CreatureStaticRow staticRow = EncounterPartyAnalysisRepository.loadStaticRow(conn, creature.Id);
        if (staticRow == null || staticRow.analysisVersion() < AnalysisModelVersion.current()) {
            return defaultFallbackRoleProfile(creature.Id, creature, party);
        }
        return fallbackRoleProfile(creature, party, toStaticRoleHint(staticRow));
    }

    private static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party,
            StaticCreatureRoleHint staticRoleHint) {
        if (creature == null) {
            return emptyRoleProfile();
        }
        if (staticRoleHint == null) {
            return defaultFallbackRoleProfile(creature.Id, creature, party);
        }
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(creature.HP, creature.AC, party);
        double actionUnits = Math.max(
                0.5,
                staticRoleHint.baseActionUnitsPerRound() + staticRoleHint.legendaryActionUnits());
        return new CreatureRoleProfile(
                creature.Id,
                EncounterWeightClass.REGULAR,
                staticRoleHint.primaryFunctionRole(),
                staticRoleHint.capabilityTags(),
                metrics.survivabilityActions(),
                actionUnits,
                0.0,
                staticRoleHint.complexFeatureCount(),
                Set.of());
    }

    private static double estimateSurvivabilityActions(int hp, int ac, EncounterPartyBenchmarks party) {
        return EncounterCalibrationService.partyRelativeMetrics(hp, ac, party).survivabilityActions();
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

    private static CreatureRoleProfile defaultFallbackRoleProfile(
            Long creatureId,
            Creature creature,
            EncounterPartyBenchmarks party) {
        PartyRelativeMetrics metrics = EncounterCalibrationService.partyRelativeMetrics(creature.HP, creature.AC, party);
        return new CreatureRoleProfile(
                creatureId,
                EncounterWeightClass.REGULAR,
                null,
                Set.of(),
                metrics.survivabilityActions(),
                1.0,
                0.0,
                0,
                Set.of());
    }

    private static StaticCreatureRoleHint toStaticRoleHint(CreatureStaticRow staticRow) {
        return new StaticCreatureRoleHint(
                staticRow.primaryFunctionRole(),
                parseCapabilityTags(staticRow.capabilityTags()),
                staticRow.complexFeatureCount(),
                staticRow.baseActionUnitsPerRound(),
                staticRow.legendaryActionUnits());
    }

    private static Map<Long, List<ParsedActionProfile>> groupActionRowsByCreatureId(Iterable<ParsedActionProfile> actionRows) {
        Map<Long, List<ParsedActionProfile>> grouped = new java.util.HashMap<>();
        for (ParsedActionProfile actionRow : actionRows) {
            grouped.computeIfAbsent(actionRow.creatureId(), ignored -> new ArrayList<>()).add(actionRow);
        }
        return grouped;
    }

    private static CreatureRoleProfile emptyRoleProfile() {
        return new CreatureRoleProfile(null, EncounterWeightClass.REGULAR, null, Set.of(),
                0.0, 1.0, 0.0, 0, Set.of());
    }
}
