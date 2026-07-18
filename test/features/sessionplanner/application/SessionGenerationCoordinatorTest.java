package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import features.encounter.application.EncounterApplicationServiceFakes;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.api.GeneratedEncounterPlanImportApi;
import features.encounter.api.GeneratedEncounterPlanImportCommand;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.UpdateCharacterCommand;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.api.ApplyGeneratedSessionCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.PreviewGeneratedSessionCommand;
import features.sessionplanner.api.SessionGenerationDraftChangedCommand;
import features.sessionplanner.api.SessionGenerationPreviewStatus;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;

final class SessionGenerationCoordinatorTest {

    @Test
    void previewAndApplyReplaceSessionThroughTypedProviderBoundaries() {
        Fixture fixture = fixture();

        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));

        assertEquals(SessionGenerationPreviewStatus.READY,
                fixture.planner().generationPreviewModel().current().status());
        assertTrue(fixture.planner().generationPreviewModel().current().applyEnabled());
        assertEquals(List.of(
                        new GenerationRequest.PartyLevel(3, 1),
                        new GenerationRequest.PartyLevel(4, 1)),
                fixture.generation().request.party());

        fixture.planner().application().applyGeneratedSession(applyCommand(fixture));

        SessionPlan applied = fixture.sessions().current;
        assertEquals(3, applied.encounters().size(),
                "encounter reward plus quest/environment reward scenes are authored");
        assertEquals(501L, applied.encounters().getFirst().encounterPlanId());
        assertEquals(0L, applied.encounters().get(1).encounterPlanId());
        assertEquals(0L, applied.encounters().get(2).encounterPlanId());
        assertEquals(3, applied.generatedRewards().size());
        assertTrue(applied.lootPlaceholders().isEmpty());
        assertEquals("run-179974", applied.generatedRewards().getFirst().generationId());
        assertEquals(SessionGenerationPreviewStatus.APPLIED,
                fixture.planner().generationPreviewModel().current().status());
        assertEquals(1, fixture.encounterImport().calls);
    }

    @Test
    void anySessionMutationMakesPreviewStaleAndBlocksApply() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));

        fixture.planner().application().setEncounterDays(
                new SetSessionEncounterDaysCommand(new BigDecimal("0.7")));

        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
        assertFalse(fixture.planner().generationPreviewModel().current().applyEnabled());
        fixture.planner().application().applyGeneratedSession(applyCommand(fixture));
        assertEquals(0, fixture.encounterImport().calls);
    }

    @Test
    void externalPartyLevelChangeImmediatelyMakesPreviewStale() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));

        fixture.party().application().updateCharacter(new UpdateCharacterCommand(
                1L,
                new CharacterDraft("Aria", "Stone", 5, 10, 10)));

        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
        assertFalse(fixture.planner().generationPreviewModel().current().applyEnabled());
    }

    @Test
    void latePreviewCompletionCannotOverwriteNewerAttempt() {
        Fixture fixture = fixture();
        fixture.generation().delayGenerate = true;

        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 101L));
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 202L));

        fixture.generation().generated.get(1).complete(GenerationResponse.success(generationResult(202L)));
        assertEquals("run-202", fixture.planner().generationPreviewModel().current().generationId());

        fixture.generation().generated.get(0).complete(GenerationResponse.success(generationResult(101L)));
        assertEquals("run-202", fixture.planner().generationPreviewModel().current().generationId());
        assertEquals(SessionGenerationPreviewStatus.READY,
                fixture.planner().generationPreviewModel().current().status());
    }

    @Test
    void draftEditInvalidatesReadyAndPendingAttempts() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));

        fixture.planner().application().generatedSessionDraftChanged(
                new SessionGenerationDraftChangedCommand());

        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
        assertFalse(fixture.planner().generationPreviewModel().current().applyEnabled());

        fixture.generation().delayGenerate = true;
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 303L));
        assertEquals(SessionGenerationPreviewStatus.GENERATING,
                fixture.planner().generationPreviewModel().current().status());

        fixture.planner().application().generatedSessionDraftChanged(
                new SessionGenerationDraftChangedCommand());
        fixture.generation().generated.getFirst().complete(GenerationResponse.success(generationResult(303L)));

        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
        assertEquals("run-179974", fixture.planner().generationPreviewModel().current().generationId());
    }

    @Test
    void pendingAndFailedAttemptRetainLastStablePreview() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        int encounterCards = fixture.planner().generationPreviewModel().current().encounters().size();

        fixture.generation().delayGenerate = true;
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 404L));

        assertEquals(SessionGenerationPreviewStatus.GENERATING,
                fixture.planner().generationPreviewModel().current().status());
        assertEquals("run-179974", fixture.planner().generationPreviewModel().current().generationId());
        assertEquals(encounterCards, fixture.planner().generationPreviewModel().current().encounters().size());
        assertFalse(fixture.planner().generationPreviewModel().current().applyEnabled());

        fixture.generation().generated.getFirst().complete(GenerationResponse.failure(
                features.sessiongeneration.api.GenerationStatus.GENERATION_FAILURE,
                "internal provider failure"));

        assertEquals(SessionGenerationPreviewStatus.ERROR,
                fixture.planner().generationPreviewModel().current().status());
        assertEquals("run-179974", fixture.planner().generationPreviewModel().current().generationId());
        assertEquals(encounterCards, fixture.planner().generationPreviewModel().current().encounters().size());
        assertFalse(fixture.planner().generationPreviewModel().current().message().contains("internal"));
    }

    @Test
    void sessionMutationDuringApplyAbortsBeforeSave() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        fixture.generation().delayLoad = true;
        fixture.encounterImport().delayImport = true;

        fixture.planner().application().applyGeneratedSession(applyCommand(fixture));
        fixture.generation().loaded.getFirst().complete(GenerationResponse.success(generationResult()));
        assertEquals(1, fixture.encounterImport().calls);

        fixture.planner().application().addScene(new AddSessionSceneCommand());
        fixture.encounterImport().imported.getFirst().complete(GeneratedEncounterPlanImportResult.success(
                List.of(new GeneratedEncounterPlanImportResult.ImportedPlan(1, 501L))));

        assertEquals(1, fixture.sessions().current.encounters().size());
        assertEquals(0L, fixture.sessions().current.encounters().getFirst().encounterPlanId());
        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
    }

    @Test
    void sessionMutationDuringReloadAbortsBeforeEncounterImport() {
        Fixture fixture = fixture();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        fixture.generation().delayLoad = true;

        fixture.planner().application().applyGeneratedSession(applyCommand(fixture));
        fixture.planner().application().addScene(new AddSessionSceneCommand());
        fixture.generation().loaded.getFirst().complete(GenerationResponse.success(generationResult()));

        assertEquals(0, fixture.encounterImport().calls);
        assertEquals(1, fixture.sessions().current.encounters().size());
        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner().generationPreviewModel().current().status());
    }

    @Test
    void oldConfirmationCannotApplyNewBindingWithQueuedLaneAndDispatcher() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        Fixture fixture = fixture(lane, dispatcher);
        lane.runAll();
        dispatcher.runAll();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        lane.runAll();
        dispatcher.runAll();
        ApplyGeneratedSessionCommand oldConfirmation = applyCommand(fixture);

        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        lane.runAll();
        dispatcher.runAll();
        long currentAttempt = fixture.planner().generationPreviewModel().current().attemptToken();

        fixture.planner().application().applyGeneratedSession(oldConfirmation);
        lane.runAll();
        dispatcher.runAll();

        assertTrue(currentAttempt > oldConfirmation.attemptToken());
        assertEquals(0, fixture.encounterImport().calls);
        assertEquals(SessionGenerationPreviewStatus.READY,
                fixture.planner().generationPreviewModel().current().status());
        assertTrue(fixture.planner().generationPreviewModel().current().applyEnabled());
    }

    @Test
    void draftCallbackDuringSynchronousCommitCannotInvalidateAppliedState() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        Fixture fixture = fixture(lane, DirectUiDispatcher.INSTANCE);
        lane.runAll();
        fixture.planner().application().previewGeneratedSession(
                new PreviewGeneratedSessionCommand(OptionalInt.of(1), 179_974L));
        lane.runAll();
        fixture.sessions().duringSave = () -> fixture.planner().application().generatedSessionDraftChanged(
                new SessionGenerationDraftChangedCommand());

        fixture.planner().application().applyGeneratedSession(applyCommand(fixture));
        lane.runAll();

        assertEquals(SessionGenerationPreviewStatus.APPLIED,
                fixture.planner().generationPreviewModel().current().status());
        assertEquals(3, fixture.sessions().current.encounters().size());
        assertEquals(1, fixture.encounterImport().calls);
    }

    private static Fixture fixture() {
        return fixture(DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE);
    }

    private static Fixture fixture(ExecutionLane executionLane, UiDispatcher uiDispatcher) {
        InMemoryPartyRepository partyRepository = new InMemoryPartyRepository();
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                partyRepository,
                executionLane,
                uiDispatcher,
                NoopDiagnostics.INSTANCE);
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "", 3, 10, 10), MembershipState.ACTIVE));
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Borin", "", 4, 10, 10), MembershipState.ACTIVE));
        RecordingSessionRepository sessions = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L, 2L), new EncounterDays(new BigDecimal("0.6"))));
        RecordingGeneration generation = new RecordingGeneration(generationResult());
        RecordingEncounterImport encounterImport = new RecordingEncounterImport();
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                () -> new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), ""),
                listener -> () -> { },
                listener -> {
                    listener.accept(new SavedEncounterPlanListResult(
                            SavedEncounterPlanStatus.SUCCESS, List.of(), ""));
                    return () -> { };
                });
        EncounterPlanBudgetModel planBudget = new EncounterPlanBudgetModel(
                () -> new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, ""),
                listener -> () -> { });
        SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                sessions,
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                EncounterApplicationServiceFakes.noOp(),
                savedPlans,
                planBudget,
                null,
                generation,
                encounterImport,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        planner.application().initialize();
        return new Fixture(planner, sessions, generation, encounterImport, party);
    }

    private static ApplyGeneratedSessionCommand applyCommand(Fixture fixture) {
        var preview = fixture.planner().generationPreviewModel().current();
        return new ApplyGeneratedSessionCommand(
                preview.attemptToken(), preview.sessionId(), preview.generationId());
    }

    private static GenerationResult generationResult() {
        return generationResult(179_974L);
    }

    private static GenerationResult generationResult(long seed) {
        List<GenerationResult.Treasure> treasures = List.of(
                treasure(1, GenerationResult.RewardChannel.ENCOUNTER, 1),
                treasure(2, GenerationResult.RewardChannel.QUEST, 0),
                treasure(3, GenerationResult.RewardChannel.ENVIRONMENT, 0));
        List<GenerationResult.LootItem> loot = List.of(
                loot(1, 1, "Encounter cache"),
                loot(2, 2, "Quest payment"),
                loot(3, 3, "Hidden supplies"));
        return new GenerationResult(
                new GenerationRunId("run-" + seed),
                "saltmarcher-v1",
                "catalog-2026-07-16",
                "10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                seed,
                List.of(new GenerationResult.PartyLevel(3, 2)),
                new GenerationResult.SessionSummary(
                        2, new BigDecimal("0.6"), 1, 1000L, 100L,
                        new BigDecimal("3.5"), 1000L, 200L, 3, 0, 0, 3),
                List.of(new GenerationResult.EncounterTarget(1, 100L)),
                List.of(new GenerationResult.Encounter(
                        1,
                        100L,
                        100L,
                        GenerationResult.Difficulty.MEDIUM,
                        "candidate-1",
                        "1 × creature",
                        1,
                        BigDecimal.ONE,
                        1,
                        BigDecimal.ZERO,
                        List.of(new GenerationResult.EncounterBlock(
                                "block-1",
                                GenerationResult.EncounterRole.STANDARD,
                                1,
                                "1/2",
                                100L,
                                1)))),
                treasures,
                loot,
                List.of(),
                new GenerationResult.RewardSummary(1000L, 200L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output",
                        GenerationResult.AuditStatus.PASS,
                        "ok")));
    }

    private static GenerationResult.Treasure treasure(
            int id,
            GenerationResult.RewardChannel channel,
            int anchor
    ) {
        return new GenerationResult.Treasure(
                id,
                GenerationResult.StockClass.NORMAL,
                channel,
                anchor,
                "Vault",
                "none",
                100L,
                1,
                0);
    }

    private static GenerationResult.LootItem loot(int line, int treasure, String text) {
        return new GenerationResult.LootItem(
                line,
                treasure,
                GenerationResult.LootRole.USEFUL,
                "item-" + line,
                text,
                1L,
                100L,
                100L,
                BigDecimal.ONE,
                "chest",
                "",
                false);
    }

    private record Fixture(
            SessionPlannerServiceAssembly planner,
            RecordingSessionRepository sessions,
            RecordingGeneration generation,
            RecordingEncounterImport encounterImport,
            PartyServiceAssembly.Component party
    ) {
    }

    private static final class RecordingGeneration implements SessionGenerationApi {

        private final GenerationResult result;
        private final List<CompletableFuture<GenerationResponse>> generated = new ArrayList<>();
        private final List<CompletableFuture<GenerationResponse>> loaded = new ArrayList<>();
        private boolean delayGenerate;
        private boolean delayLoad;
        private GenerationRequest request;

        private RecordingGeneration(GenerationResult result) {
            this.result = result;
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationDraftResponse> draft(
                GenerationRequest request
        ) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                features.sessiongeneration.api.CommitGenerationRunCommand command
        ) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> loadRun(GenerationRunId runId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRewardBatchResponse> loadRewards(
                features.sessiongeneration.api.GenerationRewardBatchQuery query
        ) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<GenerationResponse> generate(GenerationRequest request) {
            this.request = request;
            if (delayGenerate) {
                CompletableFuture<GenerationResponse> future = new CompletableFuture<>();
                generated.add(future);
                return future;
            }
            return CompletableFuture.completedFuture(GenerationResponse.success(result));
        }

        @Override
        public CompletionStage<GenerationResponse> load(GenerationRunId runId) {
            if (delayLoad) {
                CompletableFuture<GenerationResponse> future = new CompletableFuture<>();
                loaded.add(future);
                return future;
            }
            return CompletableFuture.completedFuture(GenerationResponse.success(result));
        }
    }

    private static final class RecordingEncounterImport implements GeneratedEncounterPlanImportApi {

        private int calls;
        private boolean delayImport;
        private final List<CompletableFuture<GeneratedEncounterPlanImportResult>> imported = new ArrayList<>();

        @Override
        public CompletionStage<GeneratedEncounterPlanImportResult> importGeneratedPlans(
                GeneratedEncounterPlanImportCommand command
        ) {
            calls++;
            if (delayImport) {
                CompletableFuture<GeneratedEncounterPlanImportResult> future = new CompletableFuture<>();
                imported.add(future);
                return future;
            }
            return CompletableFuture.completedFuture(GeneratedEncounterPlanImportResult.success(
                    List.of(new GeneratedEncounterPlanImportResult.ImportedPlan(1, 501L))));
        }
    }

    private static final class RecordingSessionRepository implements SessionPlanRepository {

        private SessionPlan current;
        private Runnable duringSave = () -> { };

        private RecordingSessionRepository(SessionPlan current) {
            this.current = current;
        }

        @Override
        public Optional<SessionPlan> loadCurrent() {
            return Optional.ofNullable(current);
        }

        @Override
        public Optional<SessionPlan> loadById(long sessionId) {
            return current != null && current.sessionId() == sessionId ? Optional.of(current) : Optional.empty();
        }

        @Override
        public List<SessionPlanSummary> listSessions() {
            return current == null
                    ? List.of()
                    : List.of(new SessionPlanSummary(current.sessionId(), current.displayName()));
        }

        @Override
        public SessionPlan save(SessionPlan sessionPlan) {
            current = sessionPlan;
            Runnable callback = duringSave;
            duringSave = () -> { };
            callback.run();
            return current;
        }

        @Override
        public void rename(long sessionId, String displayName) {
        }

        @Override
        public void delete(long sessionId) {
            current = null;
        }

        @Override
        public long nextSessionId() {
            return current == null ? 1L : current.sessionId() + 1L;
        }

        @Override
        public void setCurrentSessionId(long sessionId) {
        }
    }

    private static final class QueuedExecutionLane implements ExecutionLane {

        private final ArrayDeque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable next) {
            work.addLast(next);
        }

        void runAll() {
            while (!work.isEmpty()) {
                work.removeFirst().run();
            }
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class QueuedUiDispatcher implements UiDispatcher {

        private final ArrayDeque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
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
}
