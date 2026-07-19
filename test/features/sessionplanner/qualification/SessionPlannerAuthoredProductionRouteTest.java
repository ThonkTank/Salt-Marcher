package features.sessionplanner.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.CreaturesServiceAssembly;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.party.PartyServiceAssembly;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.ClearSessionRestGapCommand;
import features.sessionplanner.api.DetachSessionEncounterCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerEncounterAllocationCommand;
import features.sessionplanner.api.SessionPlannerEncounterCommand;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SearchSessionEncounterPlansCommand;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessionplanner.api.SetSessionRestGapCommand;
import features.sessionplanner.api.UpdateSessionEncounterSceneCommand;
import features.sessionplanner.api.UpdateSessionManualLootNoteCommand;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionPlan;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

/** Real temporary-SQLite proof for guarded authored commands and atomic catalog operations. */
final class SessionPlannerAuthoredProductionRouteTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void authoredNotesRewardsAndDirtySwitchSurviveReopenWithoutStaleOverwrite() throws Exception {
        Path path = temporaryDirectory.resolve("session-authored-editing.sqlite");
        try (ProductionRoute route = ProductionRoute.open(path)) {
            route.sessions.insert(firstSession());
            route.sessions.insert(secondSession());
            route.sessions.setCurrentSessionId(1L);
            route.planner.application().initialize();
            route.awaitIdle();

            route.planner.application().addManualLootNote(new AddSessionManualLootNoteCommand(
                    target(1L, 1L), 1L, "Moon key beneath the altar"));
            route.awaitIdle();
            SessionPlan added = route.sessions.loadById(1L).orElseThrow();
            long noteId = added.manualLootNotes().getFirst().noteId();
            assertEquals("Moon key beneath the altar", added.manualLootNotes().getFirst().authoredText());

            route.planner.application().updateManualLootNote(new UpdateSessionManualLootNoteCommand(
                    target(1L, 2L), 1L, noteId, "Moon key in the reliquary"));
            route.awaitIdle();
            assertEquals("Moon key in the reliquary", route.sessions.loadById(1L).orElseThrow()
                    .manualLootNotes().getFirst().authoredText());
            route.planner.application().removeManualLootNote(new RemoveSessionManualLootNoteCommand(
                    target(1L, 3L), 1L, noteId));
            route.awaitIdle();
            assertTrue(route.sessions.loadById(1L).orElseThrow().manualLootNotes().isEmpty());
            route.planner.application().addManualLootNote(new AddSessionManualLootNoteCommand(
                    target(1L, 4L), 1L, "Durable cache"));
            route.awaitIdle();

            route.planner.application().attachEncounter(new AttachSessionEncounterCommand(target(1L, 5L), 1L, 77L));
            route.awaitIdle();
            route.planner.application().detachEncounter(new DetachSessionEncounterCommand(target(1L, 6L), 1L));
            route.awaitIdle();
            SessionPlan beforeSwitch = route.sessions.loadById(1L).orElseThrow();
            assertEquals(1, beforeSwitch.generatedRewards().size(),
                    "attach and detach preserve generated reward references");

            route.planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                    2L, Optional.of(new UpdateSessionEncounterSceneCommand(
                            target(1L, beforeSwitch.revision().value()), 1L,
                            "Autosaved before switch", "source only", 0L))));
            route.awaitIdle();
            assertEquals(2L, route.planner.workspaceModel().current().sourceSessionId());
            assertEquals("Target scene", route.sessions.loadById(2L).orElseThrow()
                    .encounters().getFirst().sceneTitle());

            SessionPlan delayedSource = route.sessions.loadById(1L).orElseThrow();
            route.planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    target(1L, delayedSource.revision().value()), 1L,
                    "Delayed source edit", "still source only", 0L));
            route.awaitIdle();
            assertEquals(2L, route.planner.workspaceModel().current().sourceSessionId(),
                    "a delayed old-session command cannot replace the active session");
            assertEquals("Target scene", route.sessions.loadById(2L).orElseThrow()
                    .encounters().getFirst().sceneTitle());
        }

        try (ProductionRoute reopened = ProductionRoute.open(path)) {
            SessionPlan source = reopened.sessions.loadById(1L).orElseThrow();
            SessionPlan target = reopened.sessions.loadById(2L).orElseThrow();
            assertEquals("Delayed source edit", source.encounters().getFirst().sceneTitle());
            assertEquals("still source only", source.encounters().getFirst().sceneNotes());
            assertEquals("Durable cache", source.manualLootNotes().getFirst().authoredText());
            assertEquals(1, source.generatedRewards().size());
            assertEquals("Target scene", target.encounters().getFirst().sceneTitle(),
                    "source edit was never copied into the target session");
            reopened.planner.application().initialize();
            reopened.awaitIdle();

            long stableRevision = source.revision().value();
            reopened.planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    target(1L, stableRevision - 1L), 1L, "STALE OVERWRITE", "must not persist", 0L));
            reopened.awaitIdle();
            assertEquals(source, reopened.sessions.loadById(1L).orElseThrow(),
                    "stale guarded scene edit writes nothing");

            SessionPlan externallyRemoved = source.removeEncounter(1L);
            reopened.sessions.save(externallyRemoved);
            SessionPlan removed = reopened.sessions.loadById(1L).orElseThrow();
            reopened.planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    target(1L, removed.revision().value()), 1L,
                    "REMOVED SCENE OVERWRITE", "must not persist", 0L));
            reopened.awaitIdle();
            assertEquals(removed, reopened.sessions.loadById(1L).orElseThrow(),
                    "a fresh guard cannot recreate an externally removed scene");
        }
    }

    @Test
    void guardedDeleteIsAtomicAndKeepsOrReplacesTheCurrentPointer() throws Exception {
        Path path = temporaryDirectory.resolve("session-authored-delete.sqlite");
        long replacementId;
        try (ProductionRoute route = ProductionRoute.open(path)) {
            route.sessions.insert(firstSession());
            route.sessions.insert(secondSession());
            route.sessions.setCurrentSessionId(2L);
            route.planner.application().initialize();
            route.awaitIdle();

            route.planner.application().deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(
                    target(1L, 2L)));
            route.awaitIdle();
            assertTrue(route.sessions.loadById(1L).isPresent(), "stale delete writes nothing");
            assertEquals(2L, route.sessions.loadCurrent().orElseThrow().sessionId());

            route.planner.application().deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(
                    target(99L, 1L)));
            route.awaitIdle();
            assertEquals(2, route.sessions.listSessions().size(), "missing delete writes nothing");
            assertEquals(2L, route.sessions.loadCurrent().orElseThrow().sessionId());

            route.planner.application().deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(
                    target(1L, 1L)));
            route.awaitIdle();
            assertTrue(route.sessions.loadById(1L).isEmpty());
            assertEquals(2L, route.sessions.loadCurrent().orElseThrow().sessionId(),
                    "deleting a non-current row preserves the current pointer");

            route.planner.application().deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(
                    target(2L, 1L)));
            route.awaitIdle();
            SessionPlan replacement = route.sessions.loadCurrent().orElseThrow();
            replacementId = replacement.sessionId();
            assertTrue(replacementId != 2L, "deleting the last current session seeds a replacement");
            assertEquals(1L, replacement.revision().value());
        }

        try (ProductionRoute reopened = ProductionRoute.open(path)) {
            assertEquals(replacementId, reopened.sessions.loadCurrent().orElseThrow().sessionId(),
                    "the replacement current pointer survives reopen");
        }
    }

    @Test
    void everyAuthoredCommandFamilyMutatesOnlyItsExplicitNonCurrentTarget() throws Exception {
        Path path = temporaryDirectory.resolve("session-authored-command-matrix.sqlite");
        try (ProductionRoute route = ProductionRoute.open(path)) {
            route.sessions.insert(firstSession());
            route.sessions.insert(secondSession());
            route.sessions.setCurrentSessionId(2L);
            route.planner.application().initialize();
            route.awaitIdle();
            route.planner.application().searchEncounterPlans(
                    new SearchSessionEncounterPlansCommand(1L, "missing encounter"));
            route.awaitIdle();
            var activeSearch = route.planner.workspaceModel().current().selectedScene().encounterPlanSearch();
            assertTrue(activeSearch.status()
                    != features.sessionplanner.api.SessionEncounterPlanSearchSnapshot.Status.IDLE);

            route.planner.application().renameSession(new SessionPlannerCatalogCommand.RenameSessionCommand(
                    target(1L, 1L), "Renamed source"));
            route.awaitIdle();
            route.planner.application().addParticipant(SessionPlannerParticipantCommand.add(target(1L, 2L), 42L));
            route.awaitIdle();
            route.planner.application().removeParticipant(
                    SessionPlannerParticipantCommand.remove(target(1L, 3L), 42L));
            route.awaitIdle();
            route.planner.application().setEncounterDays(
                    new SetSessionEncounterDaysCommand(target(1L, 4L), new BigDecimal("1.5")));
            route.awaitIdle();
            route.planner.application().addScene(new AddSessionSceneCommand(target(1L, 5L)));
            route.awaitIdle();
            route.planner.application().selectEncounter(SessionPlannerEncounterCommand.select(target(1L, 6L), 2L));
            route.awaitIdle();
            route.planner.application().setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                    target(1L, 7L), 1L, new BigDecimal("75")));
            route.awaitIdle();
            assertEquals(new BigDecimal("75.0000"), route.sessions.loadById(1L).orElseThrow()
                    .encounters().getFirst().allocation().budgetPercentage());
            route.planner.application().moveEncounterUp(
                    SessionPlannerEncounterCommand.moveUp(target(1L, 8L), 2L));
            route.awaitIdle();
            route.planner.application().moveEncounterDown(
                    SessionPlannerEncounterCommand.moveDown(target(1L, 9L), 2L));
            route.awaitIdle();
            route.planner.application().setRestGap(new SetSessionRestGapCommand(
                    target(1L, 10L), 1L, 2L, SessionPlannerRestKind.SHORT_REST));
            route.awaitIdle();
            route.planner.application().clearRestGap(new ClearSessionRestGapCommand(
                    target(1L, 11L), 1L, 2L));
            route.awaitIdle();
            route.planner.application().removeEncounter(
                    SessionPlannerEncounterCommand.remove(target(1L, 12L), 2L));
            route.awaitIdle();

            SessionPlan source = route.sessions.loadById(1L).orElseThrow();
            assertEquals(13L, source.revision().value(), "each effective command advances exactly once");
            assertEquals("Renamed source", source.displayName());
            assertEquals(new BigDecimal("1.5"), source.encounterDays().value());
            assertEquals(List.of(1L), source.encounters().stream().map(SessionEncounter::encounterId).toList());
            assertTrue(source.participantRefs().isEmpty());
            assertTrue(source.restPlacements().isEmpty());
            assertEquals(2L, route.sessions.loadCurrent().orElseThrow().sessionId());
            assertEquals(2L, route.planner.workspaceModel().current().sourceSessionId(),
                    "non-current writes never replace active workspace identity");
            assertEquals(activeSearch,
                    route.planner.workspaceModel().current().selectedScene().encounterPlanSearch(),
                    "non-current writes preserve the active Session search publication");
            assertEquals("Target scene", route.sessions.loadById(2L).orElseThrow()
                    .encounters().getFirst().sceneTitle());
        }
    }

    private static SessionPlannerAuthoredTarget target(long sessionId, long revision) {
        return new SessionPlannerAuthoredTarget(sessionId, revision);
    }

    private static SessionPlan firstSession() {
        return new SessionPlan(
                1L, null, "Source", List.of(), EncounterDays.one(),
                List.of(new SessionEncounter(1L, 0L, SessionEncounterAllocation.hundred(),
                        "Source scene", "", 0L)),
                List.of(), List.of(),
                List.of(new SessionGeneratedRewardReference(1L, "run-authored", 1L, "Reward")),
                1L, "", 2L, 1L);
    }

    private static SessionPlan secondSession() {
        return new SessionPlan(
                2L, null, "Target", List.of(), new EncounterDays(BigDecimal.ONE),
                List.of(new SessionEncounter(1L, 0L, SessionEncounterAllocation.hundred(),
                        "Target scene", "", 0L)),
                List.of(), List.of(), List.of(), 1L, "", 2L, 1L);
    }

    private static final class ProductionRoute implements AutoCloseable {
        private final SqliteDatabase database;
        private final SqliteSessionPlanRepository sessions;
        private final SessionPlannerServiceAssembly planner;
        private final ExecutionLane authored;

        private ProductionRoute(
                SqliteDatabase database,
                SqliteSessionPlanRepository sessions,
                SessionPlannerServiceAssembly planner,
                ExecutionLane authored
        ) {
            this.database = database;
            this.sessions = sessions;
            this.planner = planner;
            this.authored = authored;
        }

        private static ProductionRoute open(Path path) {
            SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
            ExecutionLane authored = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
            var creatures = CreaturesServiceAssembly.create(
                    database, authored, DirectExecutionLane.INSTANCE,
                    DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
            var tables = EncounterTableServiceAssembly.create(
                    database, authored, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            var party = PartyServiceAssembly.create(
                    database, authored, DirectExecutionLane.INSTANCE,
                    DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
            var encounters = EncounterServiceAssembly.create(
                    database,
                    creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                    tables.application(), tables.candidates(), null,
                    party.application(), party.activeParty(), party.activeComposition(),
                    party.adventuringDaySummary(), party.mutation(),
                    authored, DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            SqliteSessionPlanRepository sessions = new SqliteSessionPlanRepository(database);
            SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                    sessions, sessions, sessions, party.application(), encounters.application(),
                    encounters.savedPlans(), null,
                    SessionGenerationServiceAssembly.create(
                            database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                            NoopDiagnostics.INSTANCE),
                    authored, DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            database.prepareRegisteredStores();
            PartyServiceAssembly.start(party);
            encounters.start();
            ProductionRoute route = new ProductionRoute(database, sessions, planner, authored);
            try {
                route.awaitIdle();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                route.close();
                throw new IllegalStateException("authored lane setup was interrupted", exception);
            }
            return route;
        }

        private void awaitIdle() throws InterruptedException {
            CountDownLatch idle = new CountDownLatch(1);
            authored.execute(idle::countDown);
            assertTrue(idle.await(10L, TimeUnit.SECONDS), "authored lane did not become idle");
        }

        @Override
        public void close() {
            authored.close();
            database.close();
        }
    }
}
