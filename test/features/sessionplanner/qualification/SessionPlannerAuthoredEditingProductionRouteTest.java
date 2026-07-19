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
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.DetachSessionEncounterCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

/** Real temporary-SQLite proof for guarded authored editing and atomic catalog switching. */
final class SessionPlannerAuthoredEditingProductionRouteTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void authoredNotesRewardsAndDirtySwitchSurviveReopenWithoutStaleOverwrite() {
        Path path = temporaryDirectory.resolve("session-authored-editing.sqlite");
        try (ProductionRoute route = ProductionRoute.open(path)) {
            route.sessions.insert(firstSession());
            route.sessions.insert(secondSession());
            route.sessions.setCurrentSessionId(1L);
            route.planner.application().initialize();

            route.planner.application().addManualLootNote(new AddSessionManualLootNoteCommand(
                    target(1L, 1L), 1L, "Moon key beneath the altar"));
            SessionPlan added = route.sessions.loadById(1L).orElseThrow();
            long noteId = added.manualLootNotes().getFirst().noteId();
            assertEquals("Moon key beneath the altar", added.manualLootNotes().getFirst().authoredText());

            route.planner.application().updateManualLootNote(new UpdateSessionManualLootNoteCommand(
                    target(1L, 2L), 1L, noteId, "Moon key in the reliquary"));
            assertEquals("Moon key in the reliquary", route.sessions.loadById(1L).orElseThrow()
                    .manualLootNotes().getFirst().authoredText());
            route.planner.application().removeManualLootNote(new RemoveSessionManualLootNoteCommand(
                    target(1L, 3L), 1L, noteId));
            assertTrue(route.sessions.loadById(1L).orElseThrow().manualLootNotes().isEmpty());
            route.planner.application().addManualLootNote(new AddSessionManualLootNoteCommand(
                    target(1L, 4L), 1L, "Durable cache"));

            route.planner.application().attachEncounter(new AttachSessionEncounterCommand(1L, 77L));
            route.planner.application().detachEncounter(new DetachSessionEncounterCommand(1L));
            SessionPlan beforeSwitch = route.sessions.loadById(1L).orElseThrow();
            assertEquals(1, beforeSwitch.generatedRewards().size(),
                    "attach and detach preserve generated reward references");

            route.planner.application().selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                    2L, Optional.of(new UpdateSessionEncounterSceneCommand(
                            target(1L, beforeSwitch.revision().value()), 1L,
                            "Autosaved before switch", "source only", 0L))));
            assertEquals(2L, route.planner.workspaceModel().current().sourceSessionId());
            assertEquals("Target scene", route.sessions.loadById(2L).orElseThrow()
                    .encounters().getFirst().sceneTitle());
        }

        try (ProductionRoute reopened = ProductionRoute.open(path)) {
            SessionPlan source = reopened.sessions.loadById(1L).orElseThrow();
            SessionPlan target = reopened.sessions.loadById(2L).orElseThrow();
            assertEquals("Autosaved before switch", source.encounters().getFirst().sceneTitle());
            assertEquals("source only", source.encounters().getFirst().sceneNotes());
            assertEquals("Durable cache", source.manualLootNotes().getFirst().authoredText());
            assertEquals(1, source.generatedRewards().size());
            assertEquals("Target scene", target.encounters().getFirst().sceneTitle(),
                    "source edit was never copied into the target session");
            reopened.planner.application().initialize();

            long stableRevision = source.revision().value();
            reopened.planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    target(1L, stableRevision - 1L), 1L, "STALE OVERWRITE", "must not persist", 0L));
            assertEquals(source, reopened.sessions.loadById(1L).orElseThrow(),
                    "stale guarded scene edit writes nothing");

            SessionPlan externallyRemoved = source.removeEncounter(1L);
            reopened.sessions.save(externallyRemoved);
            SessionPlan removed = reopened.sessions.loadById(1L).orElseThrow();
            reopened.planner.application().updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    target(1L, removed.revision().value()), 1L,
                    "REMOVED SCENE OVERWRITE", "must not persist", 0L));
            assertEquals(removed, reopened.sessions.loadById(1L).orElseThrow(),
                    "a fresh guard cannot recreate an externally removed scene");
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

        private ProductionRoute(
                SqliteDatabase database,
                SqliteSessionPlanRepository sessions,
                SessionPlannerServiceAssembly planner
        ) {
            this.database = database;
            this.sessions = sessions;
            this.planner = planner;
        }

        private static ProductionRoute open(Path path) {
            SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
            var creatures = CreaturesServiceAssembly.create(
                    database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                    DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
            var tables = EncounterTableServiceAssembly.create(
                    database, DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            var party = PartyServiceAssembly.create(
                    database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                    DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
            var encounters = EncounterServiceAssembly.create(
                    database,
                    creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                    tables.application(), tables.candidates(), null,
                    party.application(), party.activeParty(), party.activeComposition(),
                    party.adventuringDaySummary(), party.mutation(),
                    DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            SqliteSessionPlanRepository sessions = new SqliteSessionPlanRepository(database);
            SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                    sessions, sessions, sessions, party.application(), encounters.application(),
                    encounters.savedPlans(), null,
                    SessionGenerationServiceAssembly.create(
                            database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                            NoopDiagnostics.INSTANCE),
                    DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            database.prepareRegisteredStores();
            PartyServiceAssembly.start(party);
            encounters.start();
            return new ProductionRoute(database, sessions, planner);
        }

        @Override
        public void close() {
            database.close();
        }
    }
}
