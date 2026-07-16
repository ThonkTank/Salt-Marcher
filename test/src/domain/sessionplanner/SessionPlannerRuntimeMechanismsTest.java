package src.domain.sessionplanner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import src.domain.encounter.EncounterApplicationServiceFakes;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.party.PartyServiceAssembly;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;

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
        assertEquals(0L, planner.currentSessionModel().current().session().sessionId());
        assertTrue(planner.catalogModel().current().sessions().isEmpty());
        assertEquals(0, repository.reads, "all lazy current suppliers are I/O-free");

        List<Long> observedSessions = new ArrayList<>();
        planner.currentSessionModel().subscribe(snapshot -> observedSessions.add(snapshot.session().sessionId()));
        planner.application().initialize();
        assertEquals(0, repository.reads);
        assertEquals(1, lane.pending());
        lane.runAll();

        assertEquals(2, repository.reads, "initialization loads current session and catalog on the lane");
        assertEquals(1L, planner.currentSessionModel().current().session().sessionId());
        assertTrue(planner.currentSessionModel().current().xpBudget().available(),
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
        assertFalse(planner.currentSessionModel().current().xpBudget().available());
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
        var stable = planner.currentSessionModel().current();
        repository.failCurrentLoads = true;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(0, repository.saves);
        assertEquals(stable, planner.currentSessionModel().current());
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
        var stable = planner.currentSessionModel().current();
        repository.failNextId = true;

        planner.application().createSession(new SessionPlannerCatalogCommand.CreateSessionCommand("Next"));
        lane.runAll();

        assertEquals(0, repository.saves);
        assertEquals(stable, planner.currentSessionModel().current());
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
                planner.currentSessionModel().current().session().encounterDays());
        assertEquals("Session konnte nicht gespeichert werden.",
                planner.currentSessionModel().current().status());
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
        var stableCatalog = planner.catalogModel().current();
        repository.failSaves = true;
        repository.failLists = true;

        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(new BigDecimal("2")));
        lane.runAll();

        assertEquals(BigDecimal.ONE,
                planner.currentSessionModel().current().session().encounterDays());
        assertEquals("Session konnte nicht gespeichert werden.",
                planner.currentSessionModel().current().status());
        assertEquals(stableCatalog, planner.catalogModel().current());
        assertEquals(List.of("sessionplanner.storage-failure"), diagnostics.ids);
    }

    private static PartyServiceAssembly.Component createParty(
            ReentrantRecordingLane lane,
            RecordingDispatcher dispatcher
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(), lane, dispatcher, (id, type) -> { });
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
                listener -> () -> { });
        EncounterPlanBudgetModel planBudget = new EncounterPlanBudgetModel(
                () -> new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, ""),
                listener -> () -> { });
        return new SessionPlannerServiceAssembly(
                repository,
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                EncounterApplicationServiceFakes.noOp(),
                savedPlans,
                planBudget,
                null,
                lane,
                dispatcher,
                diagnostics);
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
        private int reads;
        private int saves;
        private boolean failReads;
        private boolean failCurrentLoads;
        private boolean failNextId;
        private boolean failSaves;
        private boolean failLists;

        private RecordingSessionRepository(SessionPlan current) {
            this.current = current;
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
        public Optional<SessionPlan> loadById(long sessionId) {
            reads++;
            failIfRequested();
            return current != null && current.sessionId() == sessionId ? Optional.of(current) : Optional.empty();
        }

        @Override
        public List<SessionPlanSummary> listSessions() {
            reads++;
            if (failLists) {
                throw storageFailure();
            }
            failIfRequested();
            return current == null
                    ? List.of()
                    : List.of(new SessionPlanSummary(current.sessionId(), current.displayName()));
        }

        @Override
        public SessionPlan save(SessionPlan sessionPlan) {
            saves++;
            if (failSaves) {
                throw storageFailure();
            }
            current = sessionPlan;
            return current;
        }

        @Override
        public void rename(long sessionId, String displayName) {
            if (current != null && current.sessionId() == sessionId) {
                current = current.rename(displayName);
            }
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
            return current == null ? 1L : current.sessionId() + 1L;
        }

        @Override
        public void setCurrentSessionId(long sessionId) {
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
