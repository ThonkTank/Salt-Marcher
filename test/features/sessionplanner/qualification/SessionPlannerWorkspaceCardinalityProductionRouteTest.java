package features.sessionplanner.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.creatures.CreaturesServiceAssembly;
import features.encounter.EncounterServiceAssembly;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encountertable.EncounterTableServiceAssembly;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.api.SearchSessionEncounterPlansCommand;
import features.sessionplanner.api.SessionEncounterPlanSearchSnapshot;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionPlan;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.execution.DirectExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

/** Production SQLite qualification for every variable-cardinality workspace owner. */
final class SessionPlannerWorkspaceCardinalityProductionRouteTest {

    private static final int WORKSPACE_STATEMENT_FAMILIES = 7;
    private static final int ENCOUNTER_SUMMARY_STATEMENTS = 6;
    private static final int REWARD_STATEMENTS = 5;

    @TempDir
    Path temporaryDirectory;

    @Test
    void productionOwnersStayConstantWhileEachWorkspaceDimensionGrowsIndependently() throws Exception {
        qualifyWorkspaceDimension("scenes", List.of(
                workspacePlan(1L, 1, 1, 1), workspacePlan(2L, 64, 1, 1)));
        qualifyWorkspaceDimension("participants", List.of(
                workspacePlan(1L, 1, 1, 1), workspacePlan(2L, 1, 64, 1)));
        qualifyWorkspaceDimension("reward-references", List.of(
                workspacePlan(1L, 1, 1, 1), workspacePlan(2L, 1, 1, 401),
                workspacePlan(3L, 1, 1, 800)));
        qualifySavedPlansAndRosterMembers();
        qualifyGenerationRewards();
    }

    private void qualifyWorkspaceDimension(String dimension, List<SessionPlan> variants) {
        for (SessionPlan variant : variants) {
            Path path = temporaryDirectory.resolve(
                    "workspace-" + dimension + "-" + variant.sessionId() + ".sqlite");
            RecordingDiagnostics diagnostics = new RecordingDiagnostics();
            int partyCount = dimension.equals("participants") ? variant.participantRefs().size() : 1;
            try (ProductionRoute route = ProductionRoute.open(path, diagnostics, 1, partyCount)) {
                diagnostics.clear();
                route.sessions.insert(variant);
                route.sessions.setCurrentSessionId(variant.sessionId());
                initializeDirect(route);
                Measurement assembly = diagnostics.last("sessionplanner.workspace.assembly");
                assertEquals(WORKSPACE_STATEMENT_FAMILIES, assembly.queryCount(), dimension);
                assertEquals(variant.sessionId(), route.planner.workspaceModel().current().sourceSessionId(), dimension);
                assertWorkspaceOwnerFamilies(diagnostics, variant.generatedRewards().size());
                if (dimension.equals("participants")) {
                    Measurement rosterRead = diagnostics.last("party.sqlite.roster-read");
                    assertEquals(partyCount, rosterRead.cardinality(), dimension);
                    assertEquals(2, rosterRead.queryCount(), dimension);
                    assertEquals(partyCount,
                            route.planner.workspaceModel().current().participants().participants().size());
                } else if (dimension.equals("scenes")) {
                    assertEquals(variant.encounters().size(), route.planner.workspaceModel().current()
                            .sceneTimeline().sceneHeaders().size());
                }
            }
        }
    }

    private void qualifySavedPlansAndRosterMembers() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-cardinality.sqlite");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        try (ProductionRoute route = ProductionRoute.open(path, diagnostics, 64, 1)) {
            SqliteEncounterPlanRepository repository = route.encounterPlans;
            for (int index = 1; index <= 256; index++) {
                repository.save(new EncounterPlan(index, "Bounded plan " + index, "Medium",
                        List.of(new EncounterPlanCreature(1L, 1, "Creature 1"))));
            }
            repository.save(new EncounterPlan(257L, "Wide roster", "Hard", roster(64)));
            diagnostics.clear();

            SessionPlan searchSession = workspacePlan(1L, 1, 1, 1);
            route.sessions.insert(searchSession);
            route.sessions.setCurrentSessionId(1L);
            initializeDirect(route);
            assertEquals(0, diagnostics.byId("encounter.saved-plan-search.read").size(),
                    "256 global plans do not cause an implicit search");
            assertEquals(0, diagnostics.byId("encounter.saved-plan-summary.read").size(),
                    "256 global plans with no linked IDs cause no summary hydration");
            route.planner.application().searchEncounterPlans(new SearchSessionEncounterPlansCommand(1L, "x"));
            assertEquals(0, diagnostics.byId("encounter.saved-plan-search.read").size(),
                    "underlength search performs no provider read");

            route.planner.application().searchEncounterPlans(
                    new SearchSessionEncounterPlansCommand(1L, "bounded"));
            SessionEncounterPlanSearchSnapshot result = route.planner.workspaceModel().current()
                    .selectedScene().encounterPlanSearch();
            assertEquals(SessionEncounterPlanSearchSnapshot.Status.READY, result.status());
            assertEquals(8, result.results().size());
            assertTrue(result.hasMore());
            assertEquals(1, diagnostics.only("encounter.saved-plan-search.read").queryCount());
            Measurement searchHydration = diagnostics.last("encounter.saved-plan-summary.read");
            assertEquals(8, searchHydration.cardinality(), "only published hits are hydrated");
            assertEquals(ENCOUNTER_SUMMARY_STATEMENTS, searchHydration.queryCount());

            long priorRevision = route.planner.workspaceModel().current().publicationRevision();
            route.planner.application().attachEncounter(new AttachSessionEncounterCommand(
                    new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                            route.planner.workspaceModel().current().sourceSessionId(),
                            route.planner.workspaceModel().current().sourceSessionRevision()), 1L, 257L));
            assertTrue(route.planner.workspaceModel().current().publicationRevision() > priorRevision,
                    "direct production lanes publish attach before returning");
            Measurement linkedHydration = diagnostics.last("encounter.saved-plan-summary.read");
            assertEquals(1, linkedHydration.cardinality());
            assertEquals(ENCOUNTER_SUMMARY_STATEMENTS, linkedHydration.queryCount());
            assertEquals(64, route.planner.workspaceModel().current()
                    .selectedScene().linkedEncounterRoster().size());
            Measurement creatureFacts = diagnostics.last("creatures.sqlite.facts-read");
            assertEquals(64, creatureFacts.cardinality());
            assertEquals(2, creatureFacts.queryCount());
        }
    }

    private void qualifyGenerationRewards() {
        for (int cardinality : List.of(1, 401, 800)) {
            Path variantPath = temporaryDirectory.resolve("reward-cardinality-" + cardinality + ".sqlite");
            RecordingDiagnostics variantDiagnostics = new RecordingDiagnostics();
            try (ProductionRoute route = ProductionRoute.open(variantPath, variantDiagnostics, 1, 1)) {
                variantDiagnostics.clear();
                SessionPlan variant = workspacePlan(cardinality, 1, 1, cardinality);
                route.sessions.insert(variant);
                route.sessions.setCurrentSessionId(cardinality);
                initializeDirect(route);
                Measurement measurement = variantDiagnostics.last("sessiongeneration.reward.read");
                assertEquals(cardinality, measurement.cardinality());
                assertEquals(REWARD_STATEMENTS, measurement.queryCount(), "reward cardinality=" + cardinality);
                assertWorkspaceOwnerFamilies(variantDiagnostics, cardinality);
            }
        }
    }

    private static void assertWorkspaceOwnerFamilies(RecordingDiagnostics diagnostics, int rewardCardinality) {
        assertEquals(WORKSPACE_STATEMENT_FAMILIES,
                diagnostics.last("sessionplanner.workspace.assembly").queryCount());
        assertEquals(2, diagnostics.last("party.sqlite.roster-read").queryCount());
        assertEquals(0, diagnostics.last("party.planning-facts.read").queryCount());
        Measurement rewardRead = diagnostics.last("sessiongeneration.reward.read");
        assertEquals(rewardCardinality, rewardRead.cardinality());
        assertEquals(REWARD_STATEMENTS, rewardRead.queryCount());
        assertEquals(0, diagnostics.byId("encounter.saved-plan-search.read").size());
        assertEquals(0, diagnostics.byId("encounter.saved-plan-summary.read").size());
        assertEquals(0, diagnostics.byId("creatures.sqlite.facts-read").size());
    }

    private static void initializeDirect(ProductionRoute route) {
        long priorRevision = route.planner.workspaceModel().current().publicationRevision();
        route.planner.application().initialize();
        assertTrue(route.planner.workspaceModel().current().publicationRevision() > priorRevision,
                "DirectExecutionLane plus DirectUiDispatcher must publish before initialize returns");
    }

    private static SessionPlan workspacePlan(long id, int sceneCount, int participantCount, int rewardCount) {
        List<Long> participants = new ArrayList<>(participantCount);
        for (long participant = 1L; participant <= participantCount; participant++) {
            participants.add(Long.valueOf(participant));
        }
        List<SessionEncounter> scenes = new ArrayList<>(sceneCount);
        for (long scene = 1L; scene <= sceneCount; scene++) {
            scenes.add(new SessionEncounter(scene, 0L, new SessionEncounterAllocation(BigDecimal.ZERO),
                    "Scene " + scene, "", 0L));
        }
        List<SessionGeneratedRewardReference> rewards = new ArrayList<>(rewardCount);
        for (long reward = 1L; reward <= rewardCount; reward++) {
            rewards.add(new SessionGeneratedRewardReference(1L, "run", reward, "Reward " + reward));
        }
        return new SessionPlan(id, null, "Session " + id, participants, EncounterDays.one(), scenes,
                List.of(), List.of(), rewards, 1L, "", sceneCount + 1L, 1L);
    }

    private static List<EncounterPlanCreature> roster(int cardinality) {
        List<EncounterPlanCreature> roster = new ArrayList<>(cardinality);
        for (long creature = 1L; creature <= cardinality; creature++) {
            roster.add(new EncounterPlanCreature(creature, 1, "Creature " + creature));
        }
        return List.copyOf(roster);
    }

    private static SqliteDatabase databaseWithCreatures(
            Path path,
            Diagnostics diagnostics,
            int cardinality
    ) throws Exception {
        SqliteDatabase database = new SqliteDatabase(path, diagnostics);
        new SqliteCreatureCatalogQueryAdapter(database).loadFilterValues();
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.prepareStatement(
                        "INSERT INTO creatures (id,name,size,creature_type,alignment,cr,xp,hp,ac) "
                                + "VALUES (?,?,?,?,?,?,?,?,?)")) {
            for (int id = 1; id <= cardinality; id++) {
                statement.setLong(1, id);
                statement.setString(2, "Creature " + id);
                statement.setString(3, "Medium");
                statement.setString(4, "humanoid");
                statement.setString(5, "neutral");
                statement.setString(6, "1/2");
                statement.setInt(7, 100);
                statement.setInt(8, 20);
                statement.setInt(9, 14);
                statement.addBatch();
            }
            statement.executeBatch();
        }
        return database;
    }

    private static final class ProductionRoute implements AutoCloseable {
        private final SqliteDatabase database;
        private final SqliteSessionPlanRepository sessions;
        private final SqliteEncounterPlanRepository encounterPlans;
        private final SessionPlannerServiceAssembly planner;

        private ProductionRoute(
                SqliteDatabase database,
                SqliteSessionPlanRepository sessions,
                SqliteEncounterPlanRepository encounterPlans,
                SessionPlannerServiceAssembly planner
        ) {
            this.database = database;
            this.sessions = sessions;
            this.encounterPlans = encounterPlans;
            this.planner = planner;
        }

        private static ProductionRoute open(
                Path path,
                RecordingDiagnostics diagnostics,
                int creatureCount,
                int partyCount
        ) {
            try {
                SqliteDatabase database = databaseWithCreatures(path, diagnostics, creatureCount);
                var creatures = CreaturesServiceAssembly.create(
                        database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                        DirectUiDispatcher.INSTANCE, diagnostics);
                var tables = EncounterTableServiceAssembly.create(
                        database, DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE, diagnostics);
                var party = PartyServiceAssembly.create(
                        database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                        DirectUiDispatcher.INSTANCE, diagnostics);
                var encounters = EncounterServiceAssembly.create(
                        database,
                        creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                        tables.application(), tables.candidates(), null,
                        party.application(), party.activeParty(), party.activeComposition(),
                        party.adventuringDaySummary(), party.mutation(),
                        DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                        DirectUiDispatcher.INSTANCE, diagnostics);
                SqliteSessionPlanRepository sessions = new SqliteSessionPlanRepository(database);
                SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                        sessions, sessions, sessions, party.application(), encounters.application(),
                        encounters.savedPlans(), null,
                        SessionGenerationServiceAssembly.create(
                                database, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE, diagnostics),
                        DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                        DirectUiDispatcher.INSTANCE, diagnostics);
                database.prepareRegisteredStores();
                PartyServiceAssembly.start(party);
                encounters.start();
                for (int character = 1; character <= partyCount; character++) {
                    party.application().createCharacter(new CreateCharacterCommand(
                            new CharacterDraft("Qualification " + character, "Route", 4, 12, 14),
                            MembershipState.ACTIVE));
                }
                return new ProductionRoute(database, sessions,
                        new SqliteEncounterPlanRepository(database), planner);
            } catch (Exception failure) {
                throw new IllegalStateException("Failed to open production cardinality route", failure);
            }
        }

        @Override
        public void close() {
            database.close();
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {
        private final List<Measurement> measurements = new CopyOnWriteArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            throw new AssertionError(id.value() + ":" + failureType.getName());
        }

        @Override
        public void measurement(Measurement measurement) {
            measurements.add(measurement);
        }

        private List<Measurement> byId(String id) {
            return measurements.stream().filter(item -> item.id().value().equals(id)).toList();
        }

        private Measurement only(String id) {
            List<Measurement> matches = byId(id);
            assertEquals(1, matches.size(), id);
            return matches.getFirst();
        }

        private Measurement last(String id) {
            List<Measurement> matches = byId(id);
            assertTrue(!matches.isEmpty(), id);
            return matches.getLast();
        }

        private void clear() {
            measurements.clear();
        }
    }
}
