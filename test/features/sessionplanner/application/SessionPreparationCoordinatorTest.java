package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.CommittedGeneratedEncounterBatchResult;
import features.encounter.api.CommittedGeneratedEncounterMapping;
import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterSource;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.api.PreparedGeneratedEncounterBatchResult;
import features.encounter.api.PrepareGeneratedEncounterBatchCommand;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encounter.api.UpdateEncounterTuningCommand;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.UpdateCharacterCommand;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.OptionalInt;
import java.util.ArrayDeque;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

final class SessionPreparationCoordinatorTest {

    private static final String DRAFT_FINGERPRINT = "v1:" + "1".repeat(64);

    @TempDir
    Path temporaryDirectory;

    @Test
    void productionChainDraftsAndCommitsForeignArtifactsBeforeOnePlannerCas() {
        try (Fixture fixture = fixture("production-chain.db")) {
            fixture.prepare();

            SessionPlan committed = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(1, fixture.generation.draftCalls);
            assertEquals(1, fixture.generation.commitCalls);
            assertEquals(1, fixture.encounters.prepareCalls);
            assertEquals(1, fixture.encounters.commitCalls);
            assertEquals(1, fixture.preparedSessions.commitCalls);
            assertEquals(2L, committed.revision().value());
            assertEquals(901L, committed.encounters().getFirst().encounterPlanId());
            assertEquals(1, committed.generatedRewards().size());
            assertEquals(1L, committed.generatedRewards().getFirst().sceneId());
            assertEquals("run", committed.generatedRewards().getFirst().generationId());
            assertEquals(1L, committed.generatedRewards().getFirst().treasureId());
            assertTrue(!committed.generatedRewards().getFirst().lastKnownLabel().isBlank());
            assertEquals(SessionPreparationStatus.READY, fixture.planner.workspaceModel().current().preparation().status());
            assertInstanceOf(CommitPreparedSessionResult.Success.class, fixture.preparedSessions.lastResult);
        }
    }

    @Test
    void unresolvedEncounterDraftChangesNoSessionAndStartsNoForeignCommit() {
        try (Fixture fixture = fixture("prepare-failure.db")) {
            fixture.encounters.prepareOverride = CompletableFuture.completedFuture(
                    PreparedGeneratedEncounterBatchResult.failure(
                            features.encounter.api.GeneratedEncounterBatchStatus.UNRESOLVABLE,
                            "no exact candidate"));

            fixture.prepare();

            SessionPlan unchanged = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(SessionPreparationStatus.INVALID, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(1L, unchanged.revision().value());
            assertTrue(unchanged.encounters().isEmpty());
            assertEquals(0, fixture.generation.commitCalls);
            assertEquals(0, fixture.encounters.commitCalls);
            assertEquals(0, fixture.preparedSessions.commitCalls);
        }
    }

    @Test
    void staleSessionAfterForeignCommitsStartAllowsArtifactsToFinishButSkipsPlannerCas() {
        try (Fixture fixture = fixture("stale-after-foreign-start.db")) {
            CompletableFuture<CommittedGeneratedEncounterBatchResult> pendingEncounterCommit =
                    new CompletableFuture<>();
            fixture.encounters.commitOverride = pendingEncounterCommit;

            fixture.prepare();
            assertEquals(1, fixture.generation.commitCalls);
            assertEquals(1, fixture.encounters.commitCalls);
            SessionPlan current = fixture.repository.loadCurrent().orElseThrow();
            fixture.repository.save(current.rename("Changed while foreign commits were running"));
            pendingEncounterCommit.complete(committedBatch(fixture.encounters.lastPreparedBatch));

            SessionPlan unchangedByPreparation = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(SessionPreparationStatus.INVALID, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals("Changed while foreign commits were running", unchangedByPreparation.displayName());
            assertTrue(unchangedByPreparation.encounters().isEmpty());
            assertEquals(0, fixture.preparedSessions.commitCalls);
        }
    }

    @Test
    void retryAfterPlannerStorageFailureReusesForeignIdentitiesAndCommitsOneSessionRevision() {
        try (Fixture fixture = fixture("planner-retry.db")) {
            fixture.preparedSessions.failNext = true;

            fixture.prepare();
            assertEquals(SessionPreparationStatus.FAILED, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());

            fixture.prepare();

            SessionPlan committed = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(SessionPreparationStatus.READY, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(2, fixture.generation.commitCalls);
            assertEquals(2, fixture.encounters.commitCalls);
            assertEquals(2, fixture.preparedSessions.commitCalls);
            assertEquals(1, fixture.generation.preparationIdentities.stream().distinct().count());
            assertEquals(1, fixture.encounters.preparationIdentities.stream().distinct().count());
            assertEquals(2L, committed.revision().value());
            assertEquals(1, committed.encounters().size());
            assertEquals(901L, committed.encounters().getFirst().encounterPlanId());
        }
    }

    @Test
    void retryAfterForeignCommitFailureReusesArtifactsAndAdvancesPlannerExactlyOnce() {
        try (Fixture fixture = fixture("foreign-retry.db")) {
            fixture.encounters.failNextCommit = true;

            fixture.prepare();

            assertEquals(SessionPreparationStatus.FAILED, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1, fixture.generation.artifactInsertions);
            assertEquals(0, fixture.encounters.artifactInsertions);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());

            fixture.prepare();

            SessionPlan committed = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(SessionPreparationStatus.READY, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(1, fixture.generation.preparationIdentities.stream().distinct().count());
            assertEquals(1, fixture.encounters.preparationIdentities.stream().distinct().count());
            assertEquals(1, fixture.generation.artifactInsertions);
            assertEquals(1, fixture.encounters.artifactInsertions);
            assertEquals(1, fixture.preparedSessions.commitCalls);
            assertEquals(2L, committed.revision().value());
            assertEquals(1, committed.encounters().size());
            assertEquals(901L, committed.encounters().getFirst().encounterPlanId());
        }
    }

    @Test
    void destructivePreparationRequiresConfirmationBeforeDrafting() {
        try (Fixture fixture = fixture("confirmation.db")) {
            SessionPlan authored = fixture.repository.loadCurrent().orElseThrow().addScene();
            fixture.repository.save(authored);

            fixture.prepare();

            assertEquals(SessionPreparationStatus.CONFIRMING_REPLACEMENT,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.generation.draftCalls);
            assertEquals(2L, fixture.repository.loadCurrent().orElseThrow().revision().value());

            fixture.prepareConfirmed();

            assertEquals(SessionPreparationStatus.READY, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(1, fixture.generation.draftCalls);
            assertEquals(3L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void cancelledPendingDraftAndOlderLateCompletionCannotReachForeignCommits() {
        try (Fixture fixture = fixture("cancel-pending.db")) {
            CompletableFuture<GenerationDraftResponse> pending = new CompletableFuture<>();
            fixture.generation.draftStages.add(pending);

            fixture.prepare();
            fixture.planner.application().cancelPreparation();
            pending.complete(fixture.generation.successfulDraft());

            assertEquals(SessionPreparationStatus.CANCELLED,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.encounters.prepareCalls);
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void cancelBeforePlannerCommitPointOfNoReturnSkipsPlannerStore() {
        try (Fixture fixture = fixture("cancel-before-planner-commit.db")) {
            CompletableFuture<CommittedGeneratedEncounterBatchResult> pendingEncounterCommit =
                    new CompletableFuture<>();
            fixture.encounters.commitOverride = pendingEncounterCommit;

            fixture.prepare();
            assertEquals(SessionPreparationStatus.SAVING,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertTrue(fixture.planner.workspaceModel().current().preparation().cancelEnabled());

            fixture.planner.application().cancelPreparation();
            pendingEncounterCommit.complete(committedBatch(fixture.encounters.lastPreparedBatch));

            assertEquals(SessionPreparationStatus.CANCELLED,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void plannerCommitPointOfNoReturnMakesConcurrentCancelNoOpAndReachesReady() {
        try (Fixture fixture = fixture("cancel-after-planner-commit.db")) {
            fixture.preparedSessions.beforeCommit = fixture.planner.application()::cancelPreparation;

            fixture.prepare();

            assertEquals(SessionPreparationStatus.READY,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertFalse(fixture.planner.workspaceModel().current().preparation().cancelEnabled());
            assertEquals(1L, fixture.planner.workspaceModel().current().preparation().attemptId());
            assertEquals(1, fixture.preparedSessions.commitCalls);
            assertEquals(2L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void stalePlannerCasResultRemainsInvalid() {
        try (Fixture fixture = fixture("stale-planner-cas.db")) {
            fixture.preparedSessions.staleNext = true;

            fixture.prepare();

            assertEquals(SessionPreparationStatus.INVALID,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(1, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void newerAttemptWinsBeforeOlderDraftCompletes() {
        try (Fixture fixture = fixture("latest-wins.db")) {
            CompletableFuture<GenerationDraftResponse> older = new CompletableFuture<>();
            fixture.generation.draftStages.add(older);
            fixture.generation.draftStages.add(CompletableFuture.completedFuture(
                    fixture.generation.successfulDraft()));

            fixture.prepare();
            fixture.prepare();
            older.complete(fixture.generation.successfulDraft());

            assertEquals(SessionPreparationStatus.READY, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(2, fixture.generation.draftCalls);
            assertEquals(1, fixture.encounters.prepareCalls);
            assertEquals(1, fixture.preparedSessions.commitCalls);
            assertEquals(2L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void partyFactChangeWithSameSessionRevisionRejectsPendingDraftBeforeForeignCommit() {
        try (Fixture fixture = fixture("party-stale.db")) {
            CompletableFuture<GenerationDraftResponse> pending = new CompletableFuture<>();
            fixture.generation.draftStages.add(pending);

            fixture.prepare();
            fixture.party.application().updateCharacter(new UpdateCharacterCommand(
                    1L, new CharacterDraft("Aria", "Mira", 5, 14, 16)));
            pending.complete(fixture.generation.successfulDraft());

            assertEquals(SessionPreparationStatus.IDLE, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.encounters.prepareCalls);
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void eitherForeignCommitFailureChangesNoSession() {
        try (Fixture generationFailure = fixture("generation-commit-failure.db")) {
            generationFailure.generation.commitOverride = CompletableFuture.completedFuture(
                    GenerationRunResponse.failure(features.sessiongeneration.api.GenerationStatus.STORAGE_FAILURE,
                            "generation failed"));
            generationFailure.prepare();
            assertEquals(SessionPreparationStatus.FAILED,
                    generationFailure.planner.workspaceModel().current().preparation().status());
            assertEquals(0, generationFailure.preparedSessions.commitCalls);
            assertEquals(1L, generationFailure.repository.loadCurrent().orElseThrow().revision().value());
        }
        try (Fixture encounterFailure = fixture("encounter-commit-failure.db")) {
            encounterFailure.encounters.commitOverride = CompletableFuture.completedFuture(
                    CommittedGeneratedEncounterBatchResult.failure(
                            features.encounter.api.GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                            "encounter failed"));
            encounterFailure.prepare();
            assertEquals(SessionPreparationStatus.FAILED,
                    encounterFailure.planner.workspaceModel().current().preparation().status());
            assertEquals(0, encounterFailure.preparedSessions.commitCalls);
            assertEquals(1L, encounterFailure.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void wrongCommittedMappingEndsDisplaySafelyWithoutPlannerCas() {
        try (Fixture fixture = fixture("wrong-mapping.db")) {
            PreparedEncounterCreature creature = new PreparedEncounterCreature(101L, 1, "Wolf");
            GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                    902L, "Generated 1", List.of(creature), 1, 100L, 100L,
                    GeneratedEncounterDifficulty.MEDIUM, "1x Wolf");
            fixture.encounters.commitOverride = CompletableFuture.completedFuture(
                    CommittedGeneratedEncounterBatchResult.success(List.of(
                            new CommittedGeneratedEncounterMapping(2, 902L, summary))));

            fixture.prepare();

            assertEquals(SessionPreparationStatus.FAILED, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void synchronousThrowAndNullStageEndDisplaySafelyWithoutPlannerCas() {
        try (Fixture throwing = fixture("sync-throw.db")) {
            throwing.generation.throwOnDraft = true;
            throwing.prepare();
            assertEquals(SessionPreparationStatus.FAILED, throwing.planner.workspaceModel().current().preparation().status());
            assertEquals(0, throwing.preparedSessions.commitCalls);
        }
        try (Fixture nullStage = fixture("null-stage.db")) {
            nullStage.encounters.nullPrepareStage = true;
            nullStage.prepare();
            assertEquals(SessionPreparationStatus.FAILED, nullStage.planner.workspaceModel().current().preparation().status());
            assertEquals(0, nullStage.preparedSessions.commitCalls);
            assertEquals(1L, nullStage.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void callbackLaneRejectionEndsDisplaySafelyWithoutPlannerCas() {
        RejectThirdExecutionLane lane = new RejectThirdExecutionLane();
        try (Fixture fixture = fixture("callback-rejection.db", generationResult(), lane)) {
            fixture.prepare();

            assertEquals(SessionPreparationStatus.FAILED, fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(0, fixture.encounters.prepareCalls);
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    @Test
    void authoredWriterLaneRejectionBeforePointOfNoReturnFailsWithoutPlannerWrite() {
        try (Fixture fixture = fixture(
                "authored-writer-rejection.db",
                generationResult(),
                new RejectAllExecutionLane(),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE)) {
            fixture.prepare();

            assertEquals(SessionPreparationStatus.FAILED,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertFalse(fixture.planner.workspaceModel().current().preparation().cancelEnabled());
            assertEquals(1, fixture.generation.commitCalls);
            assertEquals(1, fixture.encounters.commitCalls);
            assertEquals(0, fixture.preparedSessions.commitCalls);
            assertEquals(1L, fixture.repository.loadCurrent().orElseThrow().revision().value());
        }
    }

    private Fixture fixture(String databaseName) {
        return fixture(databaseName, generationResult(), DirectExecutionLane.INSTANCE);
    }

    private Fixture fixture(
            String databaseName,
            GenerationResult result,
            ExecutionLane lane
    ) {
        return fixture(databaseName, result, lane, lane, lane);
    }

    private Fixture fixture(
            String databaseName,
            GenerationResult result,
            ExecutionLane authoredLane,
            ExecutionLane cpuLane,
            ExecutionLane ioLane
    ) {
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve(databaseName), NoopDiagnostics.INSTANCE);
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(database);
        repository.insert(SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        repository.setCurrentSessionId(7L);
        CountingPreparedSessionStore preparedSessions = new CountingPreparedSessionStore(repository);
        FixedGenerationApi generation = new FixedGenerationApi(result);
        RecordingEncounterApi encounters = new RecordingEncounterApi();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new InMemoryPartyRepository());
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 4, 14, 16), MembershipState.ACTIVE));
        SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                repository,
                repository,
                preparedSessions,
                party.application(),
                encounters,
                emptySavedPlans(),
                null,
                generation,
                authoredLane,
                cpuLane,
                ioLane,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        planner.application().initialize();
        return new Fixture(database, repository, preparedSessions, generation, encounters, party, planner);
    }

    private static SavedEncounterPlanListModel emptySavedPlans() {
        SavedEncounterPlanListResult empty = new SavedEncounterPlanListResult(
                SavedEncounterPlanStatus.SUCCESS, List.of(), "");
        return new SavedEncounterPlanListModel(() -> empty, ignored -> () -> { }, listener -> {
            listener.accept(empty);
            return () -> { };
        });
    }

    private static GenerationResult generationResult() {
        return new GenerationResult(
                new GenerationRunId("run"), "engine", "catalog", "hash", 41L,
                List.of(new GenerationResult.PartyLevel(4, 1)),
                new GenerationResult.SessionSummary(
                        1, BigDecimal.ONE, 1, 1_000L, 100L, BigDecimal.valueOf(4L),
                        100L, 20L, 1, 0, 0, 1),
                List.of(new GenerationResult.EncounterTarget(1, 100L)),
                List.of(new GenerationResult.Encounter(
                        1, 100L, 100L, GenerationResult.Difficulty.MEDIUM,
                        "candidate", "Wolf", 1, BigDecimal.ONE, 1, BigDecimal.ZERO,
                        List.of(new GenerationResult.EncounterBlock(
                                "block", GenerationResult.EncounterRole.STANDARD,
                                1, "1/2", 100L, 1)))),
                List.of(new GenerationResult.Treasure(
                        1, GenerationResult.StockClass.NORMAL, GenerationResult.RewardChannel.ENCOUNTER,
                        1, "Wolf cache", "none", 100L, 1, 0)),
                List.of(new GenerationResult.LootItem(
                        1, 1, GenerationResult.LootRole.USEFUL, "wolf-cache", "Wolf cache",
                        1L, 100L, 100L, BigDecimal.ONE, "none", "", false)),
                List.of(new GenerationResult.Packing(1, 1, "none", 0, "none", true)),
                new GenerationResult.RewardSummary(100L, 0L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output", GenerationResult.AuditStatus.PASS, "ok")));
    }

    private static PreparedEncounterBatch preparedBatch(GeneratedEncounterSource source) {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(101L, 1, "Wolf");
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                0L, "Generated 1", List.of(creature), 1, 100L, 100L,
                GeneratedEncounterDifficulty.MEDIUM, "1x Wolf");
        return new PreparedEncounterBatch(
                source,
                "batch-fingerprint",
                List.of(new PreparedEncounterRoster(
                        1, "Generated 1", "intent-fingerprint", "roster-fingerprint",
                        List.of(creature), summary)));
    }

    private static CommittedGeneratedEncounterBatchResult committedBatch(PreparedEncounterBatch batch) {
        PreparedEncounterRoster prepared = batch.rosters().getFirst();
        GeneratedEncounterPlanSummary draft = prepared.summary();
        GeneratedEncounterPlanSummary committed = new GeneratedEncounterPlanSummary(
                901L,
                draft.label(),
                draft.roster(),
                draft.creatureCount(),
                draft.baseXp(),
                draft.adjustedXp(),
                draft.difficulty(),
                draft.displaySummary());
        return CommittedGeneratedEncounterBatchResult.success(List.of(
                new CommittedGeneratedEncounterMapping(1, 901L, committed)));
    }

    private static final class CountingPreparedSessionStore implements SessionPreparedSessionStore {
        private final SessionPreparedSessionStore delegate;
        private int commitCalls;
        private CommitPreparedSessionResult lastResult;
        private boolean failNext;
        private boolean staleNext;
        private Runnable beforeCommit = () -> { };

        private CountingPreparedSessionStore(SessionPreparedSessionStore delegate) {
            this.delegate = delegate;
        }

        @Override
        public CommitPreparedSessionResult commitPreparedSession(CommitPreparedSessionCommand command) {
            commitCalls++;
            beforeCommit.run();
            if (staleNext) {
                staleNext = false;
                lastResult = new CommitPreparedSessionResult.Stale(
                        command.expectedRevision(), command.expectedRevision().next());
                return lastResult;
            }
            if (failNext) {
                failNext = false;
                lastResult = new CommitPreparedSessionResult.StorageFailure("simulated planner failure");
                return lastResult;
            }
            lastResult = delegate.commitPreparedSession(command);
            return lastResult;
        }
    }

    private static final class FixedGenerationApi implements SessionGenerationApi {
        private final GenerationResult result;
        private int draftCalls;
        private int commitCalls;
        private final java.util.ArrayList<String> preparationIdentities = new java.util.ArrayList<>();
        private final ArrayDeque<CompletionStage<GenerationDraftResponse>> draftStages = new ArrayDeque<>();
        private CompletionStage<GenerationRunResponse> commitOverride;
        private boolean throwOnDraft;
        private final java.util.HashSet<String> durableRunIds = new java.util.HashSet<>();
        private int artifactInsertions;

        private FixedGenerationApi(GenerationResult result) {
            this.result = result;
        }

        @Override
        public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
            draftCalls++;
            preparationIdentities.add(request.preparationIdentity().value());
            if (throwOnDraft) {
                throw new IllegalStateException("simulated synchronous draft failure");
            }
            return draftStages.isEmpty()
                    ? CompletableFuture.completedFuture(successfulDraft())
                    : draftStages.removeFirst();
        }

        private GenerationDraftResponse successfulDraft() {
            return GenerationDraftResponse.success(new GenerationDraft(result, DRAFT_FINGERPRINT));
        }

        @Override
        public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
            commitCalls++;
            if (commitOverride != null) {
                return commitOverride;
            }
            boolean inserted = durableRunIds.add(result.runId().value());
            if (inserted) {
                artifactInsertions++;
            }
            return CompletableFuture.completedFuture(GenerationRunResponse.committed(
                    result,
                    inserted
                            ? GenerationRunResponse.CommitOutcome.INSERTED
                            : GenerationRunResponse.CommitOutcome.ALREADY_PRESENT));
        }

        @Override
        public CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
            return CompletableFuture.completedFuture(GenerationRunResponse.success(result));
        }

        @Override
        public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
            return CompletableFuture.completedFuture(GenerationRewardBatchResponse.success(List.of(), List.of()));
        }
    }

    private static final class RecordingEncounterApi implements EncounterApi {
        private int prepareCalls;
        private int commitCalls;
        private CompletionStage<PreparedGeneratedEncounterBatchResult> prepareOverride;
        private CompletionStage<CommittedGeneratedEncounterBatchResult> commitOverride;
        private boolean nullPrepareStage;
        private boolean failNextCommit;
        private final java.util.HashSet<String> durableBatchIdentities = new java.util.HashSet<>();
        private int artifactInsertions;
        private PreparedEncounterBatch lastPreparedBatch;
        private final java.util.ArrayList<String> preparationIdentities = new java.util.ArrayList<>();

        @Override
        public CompletionStage<PreparedGeneratedEncounterBatchResult> prepareGeneratedBatch(
                PrepareGeneratedEncounterBatchCommand command
        ) {
            prepareCalls++;
            preparationIdentities.add(command.source().preparationIdentity());
            if (nullPrepareStage) {
                return null;
            }
            if (prepareOverride != null) {
                return prepareOverride;
            }
            lastPreparedBatch = preparedBatch(command.source());
            return CompletableFuture.completedFuture(
                    PreparedGeneratedEncounterBatchResult.success(lastPreparedBatch));
        }

        @Override
        public CompletionStage<CommittedGeneratedEncounterBatchResult> commitGeneratedBatch(
                CommitGeneratedEncounterBatchCommand command
        ) {
            commitCalls++;
            if (failNextCommit) {
                failNextCommit = false;
                return CompletableFuture.completedFuture(CommittedGeneratedEncounterBatchResult.failure(
                        features.encounter.api.GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                        "simulated first Encounter commit failure"));
            }
            if (commitOverride != null) {
                return commitOverride;
            }
            String identity = command.batch().source().engineVersion()
                    + ":" + command.batch().source().preparationIdentity();
            if (durableBatchIdentities.add(identity)) {
                artifactInsertions++;
            }
            return CompletableFuture.completedFuture(committedBatch(command.batch()));
        }

        @Override
        public CompletionStage<GeneratedEncounterPlanSummaryBatchResult> loadGeneratedPlanSummaries(
                GeneratedEncounterPlanSummaryBatchQuery query
        ) {
            return CompletableFuture.completedFuture(
                    GeneratedEncounterPlanSummaryBatchResult.success(List.of()));
        }

        @Override
        public void applyState(ApplyEncounterStateCommand command) {
        }

        @Override
        public void updatePoolFilters(UpdateEncounterPoolFiltersCommand command) {
        }

        @Override
        public void updateTuning(UpdateEncounterTuningCommand command) {
        }

        @Override
        public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        }

        @Override
        public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        }
    }

    private static final class InMemoryPartyRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster nextRoster) {
            roster = nextRoster;
        }
    }

    private static final class RejectThirdExecutionLane implements ExecutionLane {
        private int executions;

        @Override
        public void execute(Runnable work) {
            executions++;
            if (executions == 3) {
                throw new IllegalStateException("simulated callback scheduling rejection");
            }
            work.run();
        }

        @Override
        public void close() {
        }
    }

    private static final class RejectAllExecutionLane implements ExecutionLane {

        @Override
        public void execute(Runnable work) {
            throw new IllegalStateException("simulated authored writer scheduling rejection");
        }

        @Override
        public void close() {
        }
    }

    private record Fixture(
            SqliteDatabase database,
            SqliteSessionPlanRepository repository,
            CountingPreparedSessionStore preparedSessions,
            FixedGenerationApi generation,
            RecordingEncounterApi encounters,
            PartyServiceAssembly.Component party,
            SessionPlannerServiceAssembly planner
    ) implements AutoCloseable {

        private void prepare() {
            planner.application().prepareSession(new PrepareSessionCommand(OptionalInt.of(1), 41L, false));
        }

        private void prepareConfirmed() {
            planner.application().prepareSession(new PrepareSessionCommand(OptionalInt.of(1), 41L, true));
        }

        @Override
        public void close() {
            database.close();
        }
    }
}
