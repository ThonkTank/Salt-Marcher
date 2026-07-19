package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessionplanner.SessionPlannerServiceAssembly;
import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import features.encounter.application.EncounterApplicationServiceFakes;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.domain.session.repository.SessionPlanSaveResult;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.api.UpdateSessionEncounterSceneCommand;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.UpdateSessionManualLootNoteCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;

final class SessionPlannerRuntimeMechanismsTest {

    @Test
    void currentIsIoFreeAndExplicitInitializationPublishesAfterSubscription() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(1L, List.of(1L), EncounterDays.one()));
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);

        assertEquals(0, repository.reads);
        assertEquals(0L, planner.workspaceModel().current().currentSession().session().sessionId());
        assertTrue(planner.workspaceModel().current().catalog().sessions().isEmpty());
        assertEquals(0, repository.reads, "all lazy current suppliers are I/O-free");

        List<Long> observedSessions = new ArrayList<>();
        planner.workspaceModel().subscribe(snapshot ->
                observedSessions.add(snapshot.currentSession().session().sessionId()));
        planner.application().initialize();
        assertEquals(0, repository.reads);
        assertEquals(1, lane.pending());
        lane.runAll();

        assertEquals(1, repository.reads, "initialization performs one set-based workspace read on the lane");
        assertEquals(1L, planner.workspaceModel().current().currentSession().session().sessionId());
        assertTrue(planner.workspaceModel().current().currentSession().xpBudget().available(),
                "nested Party command-to-current read completes inline on the shared lane");
        assertTrue(observedSessions.isEmpty(), "published callback waits for the supplied UI dispatcher");
        dispatcher.runAll();
        assertEquals(List.of(1L), observedSessions);
        assertTrue(diagnostics.ids.isEmpty());
    }

    @Test
    void initializationReportsOnePayloadFreeStorageDiagnostic() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(null);
        repository.failReads = true;
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);

        planner.application().initialize();
        lane.runAll();

        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
        assertEquals(List.of(IllegalStateException.class), diagnostics.failureTypes);
        assertFalse(planner.workspaceModel().current().currentSession().xpBudget().available());
    }

    @Test
    void mutationLoadFailureAbortsWithoutSavingOrReplacingStableState() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);
        planner.application().initialize();
        lane.runAll();
        var stable = planner.workspaceModel().current().currentSession();
        repository.failCurrentLoads = true;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(0, repository.saves);
        assertEquals(stable, planner.workspaceModel().current().currentSession());
        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
    }

    @Test
    void nextIdFailureAbortsCreateWithoutSavingFallbackIdentity() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);
        planner.application().initialize();
        lane.runAll();
        var stable = planner.workspaceModel().current().currentSession();
        repository.failNextId = true;

        planner.application().createSession(new SessionPlannerCatalogCommand.CreateSessionCommand("Next"));
        lane.runAll();

        assertEquals(0, repository.saves);
        assertEquals(stable, planner.workspaceModel().current().currentSession());
        assertEquals(7L, repository.current.sessionId());
        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
    }

    @Test
    void failedSavePublishesFailureStatusOverLastStableSessionContent() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);
        planner.application().initialize();
        lane.runAll();
        repository.failSaves = true;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(1, repository.saves);
        assertEquals(BigDecimal.ONE, repository.current.encounterDays().value());
        assertEquals(BigDecimal.ONE,
                planner.workspaceModel().current().currentSession().session().encounterDays());
        assertEquals("Session konnte nicht gespeichert werden.",
                planner.workspaceModel().current().preparation().message());
        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
    }

    @Test
    void failedSavePublishesStableFailureWithoutFollowUpStorageRead() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, diagnostics);
        planner.application().initialize();
        lane.runAll();
        var stableCatalog = planner.workspaceModel().current().catalog();
        repository.failSaves = true;
        repository.failLists = true;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(BigDecimal.ONE,
                planner.workspaceModel().current().currentSession().session().encounterDays());
        assertEquals("Session konnte nicht gespeichert werden.",
                planner.workspaceModel().current().preparation().message());
        assertEquals(stableCatalog, planner.workspaceModel().current().catalog());
        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
    }

    @Test
    void publishesPreparedSceneCopiesForAllPersistedSessionScenesWithoutModelReads() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        SessionPlan prepared = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one())
                .addScene()
                .updateEncounterScene(1L, "Torwache", "Alarm bei Dämmerung", 31L);
        RecordingSessionRepository repository = new RecordingSessionRepository(prepared);
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });

        planner.application().initialize();
        lane.runAll();
        dispatcher.runAll();
        int readsAfterPublication = repository.reads;

        var snapshot = planner.preparedScenes().current();

        assertEquals(1, snapshot.scenes().size());
        assertEquals("Torwache", snapshot.scenes().getFirst().title());
        assertEquals("Alarm bei Dämmerung", snapshot.scenes().getFirst().notes());
        assertEquals(31L, snapshot.scenes().getFirst().locationId());
        assertEquals(List.of(1L), snapshot.scenes().getFirst().participantIds());
        assertEquals(readsAfterPublication, repository.reads);
    }

    @Test
    void transientMutationStatusIsPublishedOnceOverTheAcceptedWorkspaceThenCleared() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        repository.stripPersistedStatus = true;
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals("Session-Tage aktualisiert.",
                planner.workspaceModel().current().currentSession().status(),
                "the committed status overlays the first accepted re-read even when it is transient");
        assertEquals("", repository.current.statusText());

        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Borin", "Stein", 2, 12, 14), MembershipState.ACTIVE));
        lane.runAll();
        dispatcher.runAll();
        lane.runAll();

        assertEquals("", planner.workspaceModel().current().currentSession().status(),
                "an unrelated provider refresh must not keep replaying an accepted transient status");
    }

    @Test
    void sourceMismatchRetriesOnlyOnceThenPublishesStableFailure() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()));
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();
        repository.lagWorkspaceReadsAfterSave = 2;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(3, repository.workspaceReads,
                "initial read plus exactly one source-mismatch retry");
        assertEquals(0, lane.pending(), "a persistent mismatch must not schedule an unbounded retry loop");
        assertEquals(features.sessionplanner.api.SessionPreparationStatus.FAILED,
                planner.workspaceModel().current().preparation().status());
        assertEquals(BigDecimal.ONE,
                planner.workspaceModel().current().currentSession().session().encounterDays(),
                "the last coherent workspace remains visible on mismatch failure");
    }

    @Test
    void guardedAuthoredCommandsExecuteOnceInLaneAndRejectStaleOrMissingReferences() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()).addScene());
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();

        planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                new SessionPlannerAuthoredTarget(7L, 1L), 1L, "Guarded", "draft", 0L));
        assertEquals(1, lane.pending(), "one authored command enters the serial lane once");
        assertEquals(0, repository.saves);
        lane.runAll();

        assertEquals(1, repository.saves);
        assertEquals("Guarded", repository.current.encounters().getFirst().sceneTitle());
        planner.application().addManualLootNote(new AddSessionManualLootNoteCommand(
                new SessionPlannerAuthoredTarget(7L, 2L), 1L, "Hidden cache"));
        lane.runAll();
        assertEquals(2, repository.saves);
        long noteId = repository.current.manualLootNotes().getFirst().noteId();

        planner.application().updateManualLootNote(new UpdateSessionManualLootNoteCommand(
                new SessionPlannerAuthoredTarget(7L, 2L), 1L, noteId, "stale overwrite"));
        planner.application().removeManualLootNote(new RemoveSessionManualLootNoteCommand(
                new SessionPlannerAuthoredTarget(7L, 3L), 99L, noteId));
        lane.runAll();

        assertEquals(2, repository.saves, "stale and missing-scene note commands never reach save");
        assertEquals("Hidden cache", repository.current.manualLootNotes().getFirst().authoredText());
    }

    @Test
    void dirtyCatalogSwitchSavesSourceThenSwitchesWithoutIntermediateSourcePublication() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        SessionPlan first = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()).addScene();
        SessionPlan second = SessionPlan.seeded(8L, List.of(1L), EncounterDays.one()).addScene()
                .updateEncounterScene(1L, "Target", "untouched", 0L);
        RecordingSessionRepository repository = new RecordingSessionRepository(first, second);
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();
        dispatcher.runAll();
        List<Long> applied = new ArrayList<>();
        planner.workspaceModel().subscribe(snapshot -> applied.add(snapshot.sourceSessionId()));

        planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                8L, Optional.of(new UpdateSessionEncounterSceneCommand(
                        new SessionPlannerAuthoredTarget(7L, 1L), 1L,
                        "Durable before switch", "saved once", 0L))));
        assertEquals(1, lane.pending());
        lane.runAll();
        dispatcher.runAll();

        assertEquals(1, repository.saves);
        assertEquals(1, repository.pointerSwitches);
        assertEquals(8L, repository.current.sessionId());
        assertEquals("Durable before switch", repository.other.encounters().getFirst().sceneTitle());
        assertEquals(List.of(8L), applied,
                "the authored lane publishes only the coherent target workspace after the guarded save");
    }

    @Test
    void failedPointerSwitchKeepsDurableSourceEditAndOldSessionVisible() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()).addScene(),
                SessionPlan.seeded(8L, List.of(1L), EncounterDays.one()).addScene());
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();
        repository.failPointerSwitch = true;

        planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                8L, Optional.of(new UpdateSessionEncounterSceneCommand(
                        new SessionPlannerAuthoredTarget(7L, 1L), 1L,
                        "Saved despite pointer failure", "durable", 0L))));
        lane.runAll();

        assertEquals(7L, repository.current.sessionId());
        assertEquals("Saved despite pointer failure", repository.current.encounters().getFirst().sceneTitle());
        assertEquals("Szenenänderung gespeichert; Ziel-Session konnte nicht geöffnet werden.",
                planner.workspaceModel().current().currentSession().status());
    }

    @Test
    void staleOrMissingPendingSceneAbortsCatalogSwitchBeforeSaveAndPointerChange() {
        ReentrantRecordingLane lane = new ReentrantRecordingLane();
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        PartyServiceAssembly.Component party = createParty(lane, dispatcher);
        RecordingSessionRepository repository = new RecordingSessionRepository(
                SessionPlan.seeded(7L, List.of(1L), EncounterDays.one()).addScene(),
                SessionPlan.seeded(8L, List.of(1L), EncounterDays.one()).addScene());
        SessionPlannerServiceAssembly planner = createPlanner(
                repository, party, lane, dispatcher, (id, type) -> { });
        planner.application().initialize();
        lane.runAll();

        planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                8L, Optional.of(new UpdateSessionEncounterSceneCommand(
                        new SessionPlannerAuthoredTarget(7L, 2L), 1L,
                        "STALE", "must not persist", 0L))));
        lane.runAll();
        assertEquals(0, repository.saves);
        assertEquals(0, repository.pointerSwitches);
        assertEquals(7L, repository.current.sessionId());
        assertEquals(7L, planner.workspaceModel().current().sourceSessionId());

        planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                8L, Optional.of(new UpdateSessionEncounterSceneCommand(
                        new SessionPlannerAuthoredTarget(7L, 1L), 99L,
                        "MISSING", "must not persist", 0L))));
        lane.runAll();
        assertEquals(0, repository.saves);
        assertEquals(0, repository.pointerSwitches);
        assertEquals(7L, repository.current.sessionId());
        assertEquals(7L, planner.workspaceModel().current().sourceSessionId());
    }

    private static PartyServiceAssembly.Component createParty(
            ReentrantRecordingLane lane,
            RecordingDispatcher dispatcher
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(), lane, lane, dispatcher, (id, type) -> { });
        lane.runAll();
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Aria", "Mira", 3, 14, 16), MembershipState.ACTIVE));
        lane.runAll();
        return party;
    }

    private static SessionPlannerServiceAssembly createPlanner(
            SessionPlanRepository repository,
            PartyServiceAssembly.Component party,
            ExecutionLane lane,
            UiDispatcher dispatcher,
            Diagnostics diagnostics
    ) {
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                () -> new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), ""),
                listener -> () -> { },
                listener -> {
                    listener.accept(new SavedEncounterPlanListResult(
                            SavedEncounterPlanStatus.SUCCESS, List.of(), ""));
                    return () -> { };
                });
        return new SessionPlannerServiceAssembly(
                repository,
                (SessionPlannerWorkspaceSource) repository,
                (SessionPreparedSessionStore) repository,
                party.application(),
                EncounterApplicationServiceFakes.noOp(),
                savedPlans,
                null,
                unavailableGeneration(),
                lane,
                lane,
                lane,
                dispatcher,
                diagnostics);
    }

    private static SessionGenerationApi unavailableGeneration() {
        return new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
                return CompletableFuture.completedFuture(GenerationDraftResponse.failure(
                        GenerationStatus.GENERATION_FAILURE, "not used"));
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRunResponse> commit(
                    CommitGenerationRunCommand command
            ) {
                return CompletableFuture.completedFuture(GenerationRunResponse.failure(
                        GenerationStatus.STORAGE_FAILURE, "not used"));
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
                return CompletableFuture.completedFuture(GenerationRunResponse.failure(
                        GenerationStatus.NOT_FOUND, "not used"));
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRewardBatchResponse> loadRewards(
                    GenerationRewardBatchQuery query
            ) {
                return CompletableFuture.completedFuture(GenerationRewardBatchResponse.failure(
                        GenerationStatus.NOT_FOUND, "not used"));
            }
        };
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

    private static final class RecordingSessionRepository
            implements SessionPlanRepository, SessionPreparedSessionStore, SessionPlannerWorkspaceSource {

        private SessionPlan current;
        private SessionPlan other;
        private SessionPlan previous;
        private int reads;
        private int workspaceReads;
        private int saves;
        private boolean failReads;
        private boolean failCurrentLoads;
        private boolean failNextId;
        private boolean failSaves;
        private boolean failLists;
        private boolean stripPersistedStatus;
        private int lagWorkspaceReadsAfterSave;
        private int staleWorkspaceReads;
        private int pointerSwitches;
        private boolean failPointerSwitch;

        private RecordingSessionRepository(SessionPlan current) {
            this.current = current;
        }

        private RecordingSessionRepository(SessionPlan current, SessionPlan other) {
            this.current = current;
            this.other = other;
        }

        @Override
        public Optional<SessionPlan> loadCurrent() {
            reads++;
            if (failCurrentLoads) {
                throw storageFailure();
            }
            failIfRequested();
            return Optional.ofNullable(current);
        }

        @Override
        public SessionPlannerReadCapture readWorkspace() {
            reads++;
            workspaceReads++;
            if (failLists) {
                throw storageFailure();
            }
            failIfRequested();
            SessionPlan captured = staleWorkspaceReads > 0 ? previous : current;
            staleWorkspaceReads = Math.max(0, staleWorkspaceReads - 1);
            return captured == null
                    ? new SessionPlannerReadCapture(0L, List.of(), 0)
                    : new SessionPlannerReadCapture(captured.sessionId(),
                            other == null ? List.of(captured) : List.of(captured, other), 0);
        }

        @Override
        public Optional<SessionPlan> loadById(long sessionId) {
            reads++;
            failIfRequested();
            if (current != null && current.sessionId() == sessionId) {
                return Optional.of(current);
            }
            return other != null && other.sessionId() == sessionId ? Optional.of(other) : Optional.empty();
        }

        @Override
        public List<SessionPlanSummary> listSessions() {
            reads++;
            if (failLists) {
                throw storageFailure();
            }
            failIfRequested();
            if (current == null) {
                return List.of();
            }
            List<SessionPlanSummary> summaries = new ArrayList<>();
            summaries.add(new SessionPlanSummary(current.sessionId(), current.displayName()));
            if (other != null) {
                summaries.add(new SessionPlanSummary(other.sessionId(), other.displayName()));
            }
            return summaries;
        }

        @Override
        public SessionPlanSaveResult insert(SessionPlan sessionPlan) {
            return store(sessionPlan);
        }

        @Override
        public SessionPlanSaveResult save(SessionPlan sessionPlan) {
            return store(sessionPlan);
        }

        private SessionPlanSaveResult store(SessionPlan sessionPlan) {
            saves++;
            if (failSaves) {
                throw storageFailure();
            }
            SessionPlan committed = new SessionPlan(
                    sessionPlan.sessionId(), sessionPlan.revision().next(), sessionPlan.displayName(),
                    sessionPlan.participantRefs(), sessionPlan.encounterDays(), sessionPlan.encounters(),
                    sessionPlan.restPlacements(), sessionPlan.manualLootNotes(), sessionPlan.generatedRewards(),
                    sessionPlan.selectedEncounterId(), sessionPlan.statusText(), sessionPlan.nextEncounterId(),
                    sessionPlan.nextLootId());
            if (current != null && current.sessionId() == committed.sessionId()) {
                previous = current;
                current = stripPersistedStatus ? committed.clearStatus() : committed;
                staleWorkspaceReads = lagWorkspaceReadsAfterSave;
            } else if (other != null && other.sessionId() == committed.sessionId()) {
                other = stripPersistedStatus ? committed.clearStatus() : committed;
            }
            return new SessionPlanSaveResult(
                    SessionPlanSaveResult.Status.SUCCESS,
                    sessionPlan.revision(),
                    Optional.of(committed.revision()),
                    Optional.of(committed));
        }

        @Override
        public void delete(long sessionId) {
            if (current != null && current.sessionId() == sessionId) {
                current = null;
            }
        }

        @Override
        public long nextSessionId() {
            if (failNextId) {
                throw storageFailure();
            }
            return current == null ? 1L : Math.max(current.sessionId(), other == null ? 0L : other.sessionId()) + 1L;
        }

        @Override
        public void setCurrentSessionId(long sessionId) {
            pointerSwitches++;
            if (failPointerSwitch) {
                throw storageFailure();
            }
            if (other != null && other.sessionId() == sessionId) {
                SessionPlan previousCurrent = current;
                current = other;
                other = previousCurrent;
            }
        }

        @Override
        public CommitPreparedSessionResult commitPreparedSession(CommitPreparedSessionCommand command) {
            return new CommitPreparedSessionResult.StorageFailure("not used");
        }

        private void failIfRequested() {
            if (failReads) {
                throw storageFailure();
            }
        }

        private static IllegalStateException storageFailure() {
            return new IllegalStateException("user-authored session payload must not enter diagnostics");
        }
    }

    private static final class ReentrantRecordingLane implements ExecutionLane {

        private final ArrayDeque<Runnable> work = new ArrayDeque<>();
        private boolean running;

        @Override
        public void execute(Runnable task) {
            if (running) {
                task.run();
            } else {
                work.addLast(task);
            }
        }

        int pending() {
            return work.size();
        }

        void runAll() {
            while (!work.isEmpty()) {
                running = true;
                try {
                    work.removeFirst().run();
                } finally {
                    running = false;
                }
            }
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class RecordingDispatcher implements UiDispatcher {

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

    private static final class RecordingDiagnostics implements Diagnostics {

        private final List<String> ids = new ArrayList<>();
        private final List<Class<? extends Throwable>> failureTypes = new ArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            ids.add(id.value());
            failureTypes.add(failureType);
        }
    }
}
