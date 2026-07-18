package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.CommittedGeneratedEncounterBatchResult;
import features.encounter.api.CommittedGeneratedEncounterMapping;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
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
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.api.ApplyGeneratedSessionCommand;
import features.sessionplanner.api.PreviewGeneratedSessionCommand;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;

final class SessionGenerationEncounterBatchCoordinatorTest {

    @Test
    void productionChainPreparesCommitsThenReplacesSession() {
        Fixture fixture = fixture();

        SessionGenerationPreviewSnapshot ready = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(ready));

        assertEquals(1, fixture.encounters.prepareCalls);
        assertEquals(1, fixture.encounters.commitCalls);
        assertEquals(1, fixture.repository.saves);
        assertEquals(901L, fixture.repository.current.encounters().getFirst().encounterPlanId());
        assertEquals(SessionGenerationPreviewStatus.APPLIED,
                fixture.planner.generationPreviewModel().current().status());
    }

    @Test
    void prepareFailureStopsBeforeCommitAndSessionSave() {
        Fixture fixture = fixture();
        fixture.encounters.prepareResult = CompletableFuture.completedFuture(
                PreparedGeneratedEncounterBatchResult.failure(
                        GeneratedEncounterBatchStatus.UNRESOLVABLE, "no exact candidate"));

        SessionGenerationPreviewSnapshot ready = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(ready));

        assertEquals(1, fixture.encounters.prepareCalls);
        assertEquals(0, fixture.encounters.commitCalls);
        assertEquals(0, fixture.repository.saves);
        assertEquals(SessionGenerationPreviewStatus.ERROR,
                fixture.planner.generationPreviewModel().current().status());
    }

    @Test
    void staleAfterPrepareStartsPreventsCommitAndSessionSave() {
        Fixture fixture = fixture();
        CompletableFuture<PreparedGeneratedEncounterBatchResult> pendingPrepare = new CompletableFuture<>();
        fixture.encounters.prepareResult = pendingPrepare;

        SessionGenerationPreviewSnapshot ready = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(ready));
        fixture.repository.current = fixture.repository.current.rename("changed while preparing");
        pendingPrepare.complete(prepared());

        assertEquals(1, fixture.encounters.prepareCalls);
        assertEquals(0, fixture.encounters.commitCalls);
        assertEquals(0, fixture.repository.saves);
        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner.generationPreviewModel().current().status());
    }

    @Test
    void staleAfterCommitStartsAllowsCommitToFinishButDoesNotReplaceSession() {
        Fixture fixture = fixture();
        CompletableFuture<CommittedGeneratedEncounterBatchResult> pendingCommit = new CompletableFuture<>();
        fixture.encounters.commitResult = pendingCommit;

        SessionGenerationPreviewSnapshot ready = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(ready));
        assertEquals(1, fixture.encounters.commitCalls);
        fixture.repository.current = fixture.repository.current.rename("changed while committing");
        pendingCommit.complete(committed());

        assertEquals(0, fixture.repository.saves);
        assertEquals(SessionGenerationPreviewStatus.STALE,
                fixture.planner.generationPreviewModel().current().status());
        assertFalse(fixture.planner.generationPreviewModel().current().applyEnabled());
    }

    @Test
    void retryAfterSessionSaveFailureReusesSamePreparedEncounterIdentity() {
        Fixture fixture = fixture();
        fixture.repository.failNextSave = true;

        SessionGenerationPreviewSnapshot first = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(first));
        assertEquals(SessionGenerationPreviewStatus.ERROR,
                fixture.planner.generationPreviewModel().current().status());
        assertEquals(1, fixture.encounters.commitCalls);

        SessionGenerationPreviewSnapshot retry = fixture.preview();
        fixture.planner.application().applyGeneratedSession(apply(retry));

        assertEquals(2, fixture.encounters.prepareCalls);
        assertEquals(2, fixture.encounters.commitCalls);
        assertEquals(List.of("run", "run"), fixture.encounters.preparationIdentities);
        assertEquals(2, fixture.repository.saves);
        assertEquals(901L, fixture.repository.current.encounters().getFirst().encounterPlanId());
        assertEquals(SessionGenerationPreviewStatus.APPLIED,
                fixture.planner.generationPreviewModel().current().status());
    }

    private static Fixture fixture() {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new InMemoryPartyRepository());
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 4, 14, 16), MembershipState.ACTIVE));
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        RecordingEncounterApi encounters = new RecordingEncounterApi();
        SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                repository,
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                encounters,
                emptySavedPlans(),
                unavailableBudget(),
                null,
                new FixedGenerationApi(generationResult()),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        planner.application().initialize();
        return new Fixture(repository, encounters, planner);
    }

    private static SavedEncounterPlanListModel emptySavedPlans() {
        SavedEncounterPlanListResult empty = new SavedEncounterPlanListResult(
                SavedEncounterPlanStatus.SUCCESS, List.of(), "");
        return new SavedEncounterPlanListModel(() -> empty, ignored -> () -> { }, listener -> {
            listener.accept(empty);
            return () -> { };
        });
    }

    private static EncounterPlanBudgetModel unavailableBudget() {
        return new EncounterPlanBudgetModel(
                () -> new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.NOT_FOUND, null, ""),
                ignored -> () -> { });
    }

    private static ApplyGeneratedSessionCommand apply(SessionGenerationPreviewSnapshot ready) {
        return new ApplyGeneratedSessionCommand(
                ready.attemptToken(), ready.sessionId(), ready.generationId());
    }

    private static PreparedGeneratedEncounterBatchResult prepared() {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(101L, 1, "Wolf");
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                0L, "Generated 1", List.of(creature), 1, 100L, 100L,
                GeneratedEncounterDifficulty.MEDIUM, "1x Wolf");
        PreparedEncounterRoster roster = new PreparedEncounterRoster(
                1, "Generated 1", "intent", "roster", List.of(creature), summary);
        return PreparedGeneratedEncounterBatchResult.success(new PreparedEncounterBatch(
                new features.encounter.api.GeneratedEncounterSource("engine", "run", "run"),
                "batch", List.of(roster)));
    }

    private static CommittedGeneratedEncounterBatchResult committed() {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(101L, 1, "Wolf");
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                901L, "Generated 1", List.of(creature), 1, 100L, 100L,
                GeneratedEncounterDifficulty.MEDIUM, "1x Wolf");
        return CommittedGeneratedEncounterBatchResult.success(List.of(
                new CommittedGeneratedEncounterMapping(1, 901L, summary)));
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
                                "block", GenerationResult.EncounterRole.STANDARD, 1, "1/2", 100L, 1)))),
                List.of(), List.of(), List.of(),
                new GenerationResult.RewardSummary(100L, 0L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output", GenerationResult.AuditStatus.PASS, "ok")));
    }

    private record Fixture(
            RecordingSessionRepository repository,
            RecordingEncounterApi encounters,
            SessionPlannerServiceAssembly planner
    ) {
        SessionGenerationPreviewSnapshot preview() {
            planner.application().previewGeneratedSession(
                    new PreviewGeneratedSessionCommand(OptionalInt.of(1), 41L));
            SessionGenerationPreviewSnapshot snapshot = planner.generationPreviewModel().current();
            assertEquals(SessionGenerationPreviewStatus.READY, snapshot.status());
            assertTrue(snapshot.applyEnabled());
            return snapshot;
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

    private static final class RecordingSessionRepository implements SessionPlanRepository {
        private SessionPlan current;
        private int saves;
        private boolean failNextSave;

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
            return current == null ? List.of() : List.of(new SessionPlanSummary(
                    current.sessionId(), current.displayName()));
        }

        @Override
        public SessionPlan save(SessionPlan sessionPlan) {
            saves++;
            if (failNextSave) {
                failNextSave = false;
                throw new IllegalStateException("simulated session save failure");
            }
            current = sessionPlan;
            return current;
        }

        @Override
        public void rename(long sessionId, String displayName) {
            current = current.rename(displayName);
        }

        @Override
        public void delete(long sessionId) {
            current = null;
        }

        @Override
        public long nextSessionId() {
            return current.sessionId() + 1L;
        }

        @Override
        public void setCurrentSessionId(long sessionId) {
        }
    }

    private static final class FixedGenerationApi implements SessionGenerationApi {
        private final GenerationResponse response;

        private FixedGenerationApi(GenerationResult result) {
            response = GenerationResponse.success(result);
        }

        @Override
        public CompletionStage<GenerationResponse> generate(GenerationRequest request) {
            return CompletableFuture.completedFuture(response);
        }

        @Override
        public CompletionStage<GenerationResponse> load(GenerationRunId runId) {
            return CompletableFuture.completedFuture(response);
        }

        @Override
        public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<GenerationRunResponse> loadRun(GenerationRunId runId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class RecordingEncounterApi implements EncounterApi {
        private CompletionStage<PreparedGeneratedEncounterBatchResult> prepareResult =
                CompletableFuture.completedFuture(prepared());
        private CompletionStage<CommittedGeneratedEncounterBatchResult> commitResult =
                CompletableFuture.completedFuture(committed());
        private int prepareCalls;
        private int commitCalls;
        private final java.util.ArrayList<String> preparationIdentities = new java.util.ArrayList<>();

        @Override
        public CompletionStage<PreparedGeneratedEncounterBatchResult> prepareGeneratedBatch(
                PrepareGeneratedEncounterBatchCommand command
        ) {
            prepareCalls++;
            preparationIdentities.add(command.source().preparationIdentity());
            return prepareResult;
        }

        @Override
        public CompletionStage<CommittedGeneratedEncounterBatchResult> commitGeneratedBatch(
                CommitGeneratedEncounterBatchCommand command
        ) {
            commitCalls++;
            return commitResult;
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
}
