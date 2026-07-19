package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.CommittedGeneratedEncounterBatchResult;
import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterPlanSummaryEntry;
import features.encounter.api.PrepareGeneratedEncounterBatchCommand;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedGeneratedEncounterBatchResult;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encounter.api.UpdateEncounterTuningCommand;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdjustPartyXpCommand;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDayPlanningSummary;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.AwardPartyXpCommand;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.CreateCharacterCommand;
import features.party.api.DeleteCharacterCommand;
import features.party.api.PartyApi;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyMutationModel;
import features.party.api.PartyPlanningFactsQuery;
import features.party.api.PartyPlanningFactsResponse;
import features.party.api.PartySnapshotModel;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PerformPartyRestCommand;
import features.party.api.ReadStatus;
import features.party.api.SetPartyMembershipCommand;
import features.party.api.UpdateCharacterCommand;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationResult;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.execution.ExecutionLane;
import platform.diagnostics.NoopDiagnostics;
import platform.ui.DirectUiDispatcher;

final class SessionPlannerWorkspaceAssemblerTest {

    @Test
    void oneCaptureAndOneOwnerBatchHydrateManyScenesAndAllPreparedSessions() {
        SessionPlan current = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one())
                .attachEncounter(11L)
                .attachEncounter(12L);
        SessionPlan other = SessionPlan.seeded(8L, List.of(1L), EncounterDays.one()).addScene();
        CountingSource source = new CountingSource(new SessionPlannerReadCapture(7L, List.of(current, other), 0));
        CountingParty party = new CountingParty();
        CountingEncounter encounters = new CountingEncounter(false);
        int[] savedPlanReads = {0};
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                () -> {
                    savedPlanReads[0]++;
                    return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), "");
                }, listener -> () -> { }, listener -> () -> { });
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                source, party, encounters, savedPlans, unavailableGeneration(), null, directLane(),
                NoopDiagnostics.INSTANCE);

        SessionPlannerWorkspaceAssembly result = assembler.assemble(SessionPreparationSnapshot.idle())
                .toCompletableFuture().join();

        assertEquals(1, source.reads);
        assertEquals(1, party.reads);
        assertEquals(1, encounters.reads);
        assertEquals(List.of(11L, 12L), encounters.requestedPlanIds);
        assertEquals(1, savedPlanReads[0]);
        assertEquals(2, result.workspace().sceneTimeline().sessionScenes().size());
        assertTrue(result.workspace().sceneTimeline().sessionScenes().stream()
                .allMatch(SessionPlannerSceneTimelineProjection.SessionScene::linkedEncounterPlan));
        assertEquals(3, result.preparedScenes().scenes().size(),
                "prepared scenes are derived from the same all-session planner capture");
        assertEquals(current.revision().value(), result.workspace().sourceSessionRevision());
    }

    @Test
    void outOfOrderEncounterBatchFailsClosedWithoutPartialOwnerFacts() {
        SessionPlan current = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one())
                .attachEncounter(11L)
                .attachEncounter(12L);
        CountingEncounter encounters = new CountingEncounter(true);
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                new CountingSource(new SessionPlannerReadCapture(7L, List.of(current), 0)),
                new CountingParty(), encounters, emptySavedPlans(), unavailableGeneration(), null, directLane(),
                NoopDiagnostics.INSTANCE);

        SessionPlannerWorkspaceSnapshot workspace = assembler.assemble(SessionPreparationSnapshot.idle())
                .toCompletableFuture().join().workspace();

        assertEquals(1, encounters.reads);
        assertTrue(workspace.issues().stream().anyMatch(issue ->
                issue.owner() == SessionPlannerWorkspaceSnapshot.Owner.ENCOUNTER
                        && issue.kind() == SessionPlannerWorkspaceSnapshot.Kind.MALFORMED_RESPONSE));
        assertTrue(workspace.sceneTimeline().sessionScenes().stream()
                .allMatch(scene -> scene.linkedEncounterName().isBlank()
                        && scene.linkedEncounterAdjustedXp() == 0));
        assertFalse(workspace.currentSession().availableEncounterPlans().stream()
                .anyMatch(features.sessionplanner.api.SessionPlannerSessionSnapshot.AvailableEncounterPlan::importEnabled));
    }

    @Test
    void oneRewardBatchProjectsCanonicalTypedContentInsteadOfTheFallbackLabel() {
        SessionPlan current = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one())
                .replaceGeneratedContent(
                        List.of(new SessionEncounter(1L, 11L, SessionEncounterAllocation.hundred())),
                        List.of(new SessionGeneratedRewardReference(
                                1L, "run-7", 3L, "STALE FALLBACK LABEL")));
        RewardGeneration generation = new RewardGeneration();
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                new CountingSource(new SessionPlannerReadCapture(7L, List.of(current), 0)),
                new CountingParty(), new CountingEncounter(false), emptySavedPlans(), generation, null,
                directLane(), NoopDiagnostics.INSTANCE);

        SessionPlannerSceneTimelineProjection.GeneratedReward reward = assembler
                .assemble(SessionPreparationSnapshot.idle()).toCompletableFuture().join()
                .workspace().sceneTimeline().sessionScenes().getFirst().generatedRewards().getFirst();

        assertEquals(1, generation.reads);
        assertEquals(SessionPlannerSceneTimelineProjection.Availability.AVAILABLE, reward.availability());
        assertEquals("", reward.fallbackLabel());
        assertEquals("ENCOUNTER · Sunken vault · 1 Positionen", reward.displayLabel());
        assertEquals("gem-3", reward.itemLines().getFirst().itemId());
        assertEquals(new BigDecimal("2.5"), reward.itemLines().getFirst().totalCapacity());
        assertEquals("chest", reward.packing().getFirst().containerType());
    }

    @Test
    void staleAssemblyAndRepeatedRefreshesCoalesceIntoOneLatestRevisionPublication() {
        SessionPlan initial = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()).attachEncounter(11L);
        SessionPlan newer = withRevision(initial.setEncounterDays(new EncounterDays(new BigDecimal("2"))),
                initial.revision().next());
        CountingSource source = new CountingSource(new SessionPlannerReadCapture(7L, List.of(initial), 0));
        CountingEncounter encounters = new CountingEncounter(false, true);
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                source, new CountingParty(), encounters, emptySavedPlans(), unavailableGeneration(), null,
                directLane(), NoopDiagnostics.INSTANCE);
        SessionPlannerWorkspacePublicationCoordinator publications =
                new SessionPlannerWorkspacePublicationCoordinator(
                        assembler, DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
        List<Long> publishedSourceRevisions = new ArrayList<>();
        publications.model().subscribe(snapshot -> publishedSourceRevisions.add(snapshot.sourceSessionRevision()));

        publications.initialize();
        source.capture = new SessionPlannerReadCapture(7L, List.of(newer), 0);
        publications.providerRefresh();
        publications.providerRefresh();
        publications.authoredMutation(newer);
        encounters.completeNext();

        assertEquals(2, source.reads, "all dirty requests while running coalesce into one follow-up assembly");
        assertEquals(2, encounters.reads);
        assertTrue(publishedSourceRevisions.isEmpty(), "the stale first capture is never published");

        encounters.completeNext();

        assertEquals(List.of(newer.revision().value()), publishedSourceRevisions);
        assertEquals(newer.revision().value(), publications.current().sourceSessionRevision());
    }

    @Test
    void missingFailedAndMalformedRewardsEachFailClosedWithTypedIssues() {
        for (RewardMode mode : List.of(RewardMode.MISSING, RewardMode.FAILURE, RewardMode.MALFORMED)) {
            SessionPlan current = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one())
                    .replaceGeneratedContent(
                            List.of(new SessionEncounter(1L, 11L, SessionEncounterAllocation.hundred())),
                            List.of(new SessionGeneratedRewardReference(
                                    1L, "run-7", 3L, "Last known reward")));
            SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                    new CountingSource(new SessionPlannerReadCapture(7L, List.of(current), 0)),
                    new CountingParty(), new CountingEncounter(false), emptySavedPlans(),
                    new RewardGeneration(mode), null, directLane(), NoopDiagnostics.INSTANCE);

            SessionPlannerWorkspaceSnapshot workspace = assembler.assemble(SessionPreparationSnapshot.idle())
                    .toCompletableFuture().join().workspace();
            SessionPlannerSceneTimelineProjection.GeneratedReward reward =
                    workspace.sceneTimeline().sessionScenes().getFirst().generatedRewards().getFirst();

            assertEquals(SessionPlannerSceneTimelineProjection.Availability.UNAVAILABLE, reward.availability());
            assertEquals("Last known reward", reward.fallbackLabel());
            SessionPlannerWorkspaceSnapshot.Kind expected = switch (mode) {
                case MISSING -> SessionPlannerWorkspaceSnapshot.Kind.UNAVAILABLE;
                case FAILURE -> SessionPlannerWorkspaceSnapshot.Kind.OWNER_FAILURE;
                case MALFORMED -> SessionPlannerWorkspaceSnapshot.Kind.MALFORMED_RESPONSE;
                case SUCCESS -> throw new AssertionError("unexpected success mode");
            };
            assertTrue(workspace.issues().stream().anyMatch(issue ->
                    issue.owner() == SessionPlannerWorkspaceSnapshot.Owner.SESSION_GENERATION
                            && issue.kind() == expected));
        }
    }

    private static SessionPlan withRevision(SessionPlan source, SessionRevision revision) {
        return new SessionPlan(
                source.sessionId(), revision, source.displayName(), source.participantRefs(), source.encounterDays(),
                source.encounters(), source.restPlacements(), source.manualLootNotes(), source.generatedRewards(),
                source.selectedEncounterId(), source.statusText(), source.nextEncounterId(), source.nextLootId());
    }

    private static SavedEncounterPlanListModel emptySavedPlans() {
        return new SavedEncounterPlanListModel(
                () -> new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), ""),
                listener -> () -> { }, listener -> () -> { });
    }

    private static ExecutionLane directLane() {
        return new ExecutionLane() {
            @Override
            public void execute(Runnable work) {
                work.run();
            }

            @Override
            public void close() {
            }
        };
    }

    private static SessionGenerationApi unavailableGeneration() {
        return new SessionGenerationApi() {
            @Override
            public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
                return CompletableFuture.completedFuture(GenerationDraftResponse.failure(
                        GenerationStatus.GENERATION_FAILURE, "unused"));
            }

            @Override
            public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
                return CompletableFuture.completedFuture(GenerationRunResponse.failure(
                        GenerationStatus.STORAGE_FAILURE, "unused"));
            }

            @Override
            public CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
                return CompletableFuture.completedFuture(GenerationRunResponse.failure(
                        GenerationStatus.NOT_FOUND, "unused"));
            }

            @Override
            public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
                return CompletableFuture.completedFuture(GenerationRewardBatchResponse.failure(
                        GenerationStatus.NOT_FOUND, "unused"));
            }
        };
    }

    private static final class CountingSource implements SessionPlannerWorkspaceSource {
        private SessionPlannerReadCapture capture;
        private int reads;

        private CountingSource(SessionPlannerReadCapture capture) {
            this.capture = capture;
        }

        @Override
        public SessionPlannerReadCapture readWorkspace() {
            reads++;
            return capture;
        }
    }

    private static final class CountingEncounter implements EncounterApi {
        private final boolean reverse;
        private final boolean delayed;
        private final List<CompletableFuture<GeneratedEncounterPlanSummaryBatchResult>> pending = new ArrayList<>();
        private int reads;
        private List<Long> requestedPlanIds = List.of();

        private CountingEncounter(boolean reverse) {
            this(reverse, false);
        }

        private CountingEncounter(boolean reverse, boolean delayed) {
            this.reverse = reverse;
            this.delayed = delayed;
        }

        @Override
        public CompletionStage<GeneratedEncounterPlanSummaryBatchResult> loadGeneratedPlanSummaries(
                GeneratedEncounterPlanSummaryBatchQuery query
        ) {
            reads++;
            requestedPlanIds = query.planIds();
            List<Long> responseIds = new ArrayList<>(query.planIds());
            if (reverse) {
                Collections.reverse(responseIds);
            }
            List<GeneratedEncounterPlanSummaryEntry> entries = responseIds.stream().map(id ->
                    new GeneratedEncounterPlanSummaryEntry(
                            id, GeneratedEncounterPlanSummaryEntry.Status.FOUND, Optional.of(summary(id)))).toList();
            GeneratedEncounterPlanSummaryBatchResult result =
                    GeneratedEncounterPlanSummaryBatchResult.success(entries);
            if (!delayed) {
                return CompletableFuture.completedFuture(result);
            }
            CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> future = new CompletableFuture<>();
            pending.add(future);
            future.whenComplete((ignored, failure) -> pending.remove(future));
            return future;
        }

        private void completeNext() {
            CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> future = pending.getFirst();
            List<Long> ids = requestedPlanIds;
            List<GeneratedEncounterPlanSummaryEntry> entries = ids.stream().map(id ->
                    new GeneratedEncounterPlanSummaryEntry(
                            id, GeneratedEncounterPlanSummaryEntry.Status.FOUND, Optional.of(summary(id)))).toList();
            future.complete(GeneratedEncounterPlanSummaryBatchResult.success(entries));
        }

        private static GeneratedEncounterPlanSummary summary(long id) {
            return new GeneratedEncounterPlanSummary(
                    id, "Plan " + id, List.of(new PreparedEncounterCreature(id, 1, "Creature " + id)),
                    1, 100L, 150L, GeneratedEncounterDifficulty.MEDIUM, "150 XP");
        }

        @Override public CompletionStage<PreparedGeneratedEncounterBatchResult> prepareGeneratedBatch(
                PrepareGeneratedEncounterBatchCommand command) { throw new UnsupportedOperationException(); }
        @Override public CompletionStage<CommittedGeneratedEncounterBatchResult> commitGeneratedBatch(
                CommitGeneratedEncounterBatchCommand command) { throw new UnsupportedOperationException(); }
        @Override public void applyState(ApplyEncounterStateCommand command) { throw new UnsupportedOperationException(); }
        @Override public void updatePoolFilters(UpdateEncounterPoolFiltersCommand command) { throw new UnsupportedOperationException(); }
        @Override public void updateTuning(UpdateEncounterTuningCommand command) { throw new UnsupportedOperationException(); }
        @Override public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) { throw new UnsupportedOperationException(); }
        @Override public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { throw new UnsupportedOperationException(); }
    }

    private static final class CountingParty implements PartyApi {
        private int reads;

        @Override
        public CompletionStage<PartyPlanningFactsResponse> loadPlanningFacts(PartyPlanningFactsQuery query) {
            reads++;
            PartyMemberSummary member = new PartyMemberSummary(1L, "Aria", 3);
            return CompletableFuture.completedFuture(new PartyPlanningFactsResponse(
                    ReadStatus.SUCCESS, List.of(member),
                    query.participantIds().stream().map(id ->
                            new PartyPlanningFactsResponse.ResolvedParticipant(id, member)).toList(),
                    new AdventuringDayPlanningSummary(1_000, 300, 700, 2, 1), ""));
        }

        @Override public PartySnapshotModel snapshot() { throw new UnsupportedOperationException(); }
        @Override public ActivePartyModel activeParty() { throw new UnsupportedOperationException(); }
        @Override public ActivePartyCompositionModel activeComposition() { throw new UnsupportedOperationException(); }
        @Override public AdventuringDaySummaryModel adventuringDaySummary() { throw new UnsupportedOperationException(); }
        @Override public PartyTravelPositionsModel travelPositions() { throw new UnsupportedOperationException(); }
        @Override public PartyMutationModel mutation() { throw new UnsupportedOperationException(); }
        @Override public AdventuringDayCalculationModel adventuringDayCalculation() { throw new UnsupportedOperationException(); }
        @Override public void createCharacter(CreateCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void updateCharacter(UpdateCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void deleteCharacter(DeleteCharacterCommand command) { throw new UnsupportedOperationException(); }
        @Override public void setMembership(SetPartyMembershipCommand command) { throw new UnsupportedOperationException(); }
        @Override public void awardXp(AwardPartyXpCommand command) { throw new UnsupportedOperationException(); }
        @Override public void adjustXp(AdjustPartyXpCommand command) { throw new UnsupportedOperationException(); }
        @Override public void performRest(PerformPartyRestCommand command) { throw new UnsupportedOperationException(); }
        @Override public CompletionStage<MutationResult> moveCharacters(MovePartyCharactersCommand command) { throw new UnsupportedOperationException(); }
        @Override public void calculateAdventuringDay(CalculateAdventuringDayCommand command) { throw new UnsupportedOperationException(); }
    }

    private static final class RewardGeneration implements SessionGenerationApi {
        private final RewardMode mode;
        private int reads;

        private RewardGeneration() {
            this(RewardMode.SUCCESS);
        }

        private RewardGeneration(RewardMode mode) {
            this.mode = mode;
        }

        @Override
        public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
            reads++;
            var reference = query.references().getFirst();
            if (mode == RewardMode.MISSING) {
                return CompletableFuture.completedFuture(
                        GenerationRewardBatchResponse.success(List.of(), List.of(reference)));
            }
            if (mode == RewardMode.FAILURE) {
                return CompletableFuture.completedFuture(
                        GenerationRewardBatchResponse.failure(GenerationStatus.STORAGE_FAILURE, "failed"));
            }
            var responseReference = mode == RewardMode.MALFORMED
                    ? new features.sessiongeneration.api.GenerationRewardReference(
                            new GenerationRunId("foreign-run"), reference.treasureId())
                    : reference;
            var treasure = new GenerationResult.Treasure(
                    responseReference.treasureId(), GenerationResult.StockClass.NORMAL,
                    GenerationResult.RewardChannel.ENCOUNTER, 1, "Sunken vault", "NONE", 900L, 1, 0);
            var line = new GenerationResult.LootItem(
                    1, responseReference.treasureId(), GenerationResult.LootRole.USEFUL, "gem-3", "Azure gem",
                    2L, 300L, 600L, new BigDecimal("2.5"), "chest", "", false);
            var packing = new GenerationResult.Packing(
                    1, responseReference.treasureId(), "chest", 1, "chest-small", true);
            return CompletableFuture.completedFuture(GenerationRewardBatchResponse.success(
                    List.of(new GenerationRewardBatchResponse.ResolvedReward(
                            responseReference, treasure, List.of(line), List.of(packing))), List.of()));
        }

        @Override public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
            throw new UnsupportedOperationException();
        }
        @Override public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
            throw new UnsupportedOperationException();
        }
        @Override public CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
            throw new UnsupportedOperationException();
        }
    }

    private enum RewardMode { SUCCESS, MISSING, FAILURE, MALFORMED }
}
