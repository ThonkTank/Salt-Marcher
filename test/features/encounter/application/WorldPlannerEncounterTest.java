package features.encounter.application;

import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.EncounterServiceAssembly;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.api.EncounterRuntimeContextSyncResult;
import features.encounter.api.EncounterRuntimeNpcRole;
import features.encounter.api.EncounterRuntimeNpcSpec;
import features.encounter.api.EncounterStateModel;
import features.encounter.api.EncounterStateSnapshot;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SynchronizeEncounterRuntimeContextsCommand;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;
import features.encounter.domain.generation.EncounterCandidateProfile;
import features.encounter.domain.generation.EncounterCreatureFacts;
import features.encounter.domain.generation.EncounterDifficultyIntent;
import features.encounter.domain.generation.EncounterDifficultyThresholds;
import features.encounter.domain.generation.EncounterDraft;
import features.encounter.domain.generation.EncounterDraftEntry;
import features.encounter.domain.generation.EncounterDraftGenerationModel;
import features.encounter.domain.generation.EncounterTuningIntent;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.plan.EncounterPlanSummary;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.PartyApi;
import features.worldplanner.WorldPlannerReferenceAssembly;
import features.worldplanner.WorldPlannerServiceAssembly;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.api.AddWorldFactionNpcCommand;
import features.worldplanner.api.AddWorldLocationEncounterTableCommand;
import features.worldplanner.api.AddWorldLocationFactionCommand;
import features.worldplanner.api.CreateWorldFactionCommand;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.SetWorldFactionInventoryLimitCommand;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.application.WorldPlannerApplicationService;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import platform.persistence.TestFeatureStores;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@TestMethodOrder(OrderAnnotation.class)
public final class WorldPlannerEncounterTest {

    private TestRuntime runtime;

    private WorldPlannerEncounterTest() {
    }

    @BeforeEach
    void createRuntime() {
        runtime = TestRuntime.create(TestFeatureStores.current());
    }

    @AfterEach
    void closeRuntime() {
        runtime.close();
    }

    @Test
    @Order(1)
    void WORLD_PLANNER_ENCOUNTER_001() {
        assertLocationLimitsTablesAndFactionStock(runtime);
    }

    @Test
    @Order(2)
    void WORLD_PLANNER_ENCOUNTER_002() {
        assertExplicitTablesAreIntersectedWithWorldSources(runtime);
    }

    @Test
    @Order(3)
    void WORLD_PLANNER_ENCOUNTER_003() {
        assertInvalidWorldSourceBlocksTableMatches(runtime);
    }

    @Test
    @Order(4)
    void WORLD_PLANNER_ENCOUNTER_004() {
        assertFiniteCapsConstrainDraftEnumeration();
    }

    @Test
    @Order(5)
    void WORLD_PLANNER_ENCOUNTER_005() {
        assertWorldNpcIdentitySurvivesCombatResults(runtime);
    }

    @Test
    @Order(6)
    void WORLD_PLANNER_ENCOUNTER_006() {
        assertMissingReferencesAreRejectedByProductionAdapter(runtime);
    }

    @Test
    @Order(7)
    void sceneContextScopesPartyBudgetAndGenerationLocation() {
        EncounterRoute route = runtime.encounterRoute();
        long assignedMemberId = runtime.components.party().activeParty().current().members().getFirst().id();
        EncounterRuntimeContextId sceneId = new EncounterRuntimeContextId("scene-1");

        EncounterRuntimeContextSyncResult synchronizedResult = route.contexts().synchronize(
                new SynchronizeEncounterRuntimeContextsCommand(
                        1L,
                        sceneId,
                        List.of(new EncounterRuntimeContextSpec(
                                sceneId,
                                List.of(assignedMemberId),
                                runtime.seedIds().locationId(),
                                0L,
                                List.of()))))
                .toCompletableFuture()
                .join();

        assertEquals(EncounterRuntimeContextSyncResult.Status.APPLIED, synchronizedResult.status(), "scene sync");
        assertEquals("Party: 1, Lv 3", route.state().current().builderPane().partySummary(), "scene party scope");
        assertEquals(75, route.state().current().builderPane().thresholds().easyThreshold(), "scene budget scope");

        route.tables().reset();
        route.generate(inputs(List.of(), List.of(), 0L));
        assertEquals(
                List.of(301L, 302L, 201L),
                route.tables().lastTableIds(),
                "synchronized scene location overrides builder location");
    }

    @Test
    @Order(8)
    void combatReinforcementRequiresDiscardConfirmationBeforeOpeningSavedPlan() {
        EncounterRoute route = runtime.encounterRoute();
        long planId = route.plans().save(new EncounterPlan(
                0L,
                "Guard Post",
                "",
                List.of(new EncounterPlanCreature(101L, 1))))
                .id();
        assertEquals(
                OpenSavedEncounterPlanResult.Status.OPENED,
                route.service().openSavedPlan(new OpenSavedEncounterPlanCommand(planId, true))
                        .toCompletableFuture()
                        .join()
                        .status(),
                "initial saved plan open");
        route.service().applyState(ApplyEncounterStateCommand.openInitiative());
        List<String> initiativeIds = route.state().current().initiativePane().rows().stream()
                .map(EncounterStateSnapshot.InitiativeRow::combatantId)
                .toList();
        route.service().applyState(ApplyEncounterStateCommand.confirmInitiative(
                initiativeIds,
                initiativeIds.stream().map(ignored -> 12).toList()));
        route.service().applyState(ApplyEncounterStateCommand.addCreature(102L));

        OpenSavedEncounterPlanResult guarded = route.service()
                .openSavedPlan(new OpenSavedEncounterPlanCommand(planId, false))
                .toCompletableFuture()
                .join();

        assertEquals(
                OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED,
                guarded.status(),
                "combat reinforcement discard guard");
    }

    @Test
    @Order(9)
    void sceneAlliesEnterInitiativeExactlyOnceWithTheirAllyRole() {
        EncounterRoute route = runtime.encounterRoute();
        long assignedMemberId = runtime.components.party().activeParty().current().members().getFirst().id();
        EncounterRuntimeContextId sceneId = new EncounterRuntimeContextId("scene-allies");
        route.contexts().synchronize(new SynchronizeEncounterRuntimeContextsCommand(
                2L,
                sceneId,
                List.of(new EncounterRuntimeContextSpec(
                        sceneId,
                        List.of(assignedMemberId),
                        runtime.seedIds().locationId(),
                        0L,
                        List.of(
                                new EncounterRuntimeNpcSpec(9901L, 101L, EncounterRuntimeNpcRole.ALLY),
                                new EncounterRuntimeNpcSpec(9902L, 102L, EncounterRuntimeNpcRole.ENEMY))))))
                .toCompletableFuture()
                .join();

        route.service().applyState(ApplyEncounterStateCommand.openInitiative());
        List<EncounterStateSnapshot.InitiativeRow> rows = route.state().current().initiativePane().rows();

        assertEquals(1L, rows.stream().filter(row -> "Verbündeter".equals(row.kindLabel())).count(),
                "one ally initiative row");
        assertEquals(1L, rows.stream().filter(row -> "Monster".equals(row.kindLabel())).count(),
                "one enemy initiative row");
        assertEquals((long) rows.size(),
                rows.stream().map(EncounterStateSnapshot.InitiativeRow::combatantId).distinct().count(),
                "initiative ids stay unique");

        route.service().applyState(ApplyEncounterStateCommand.confirmInitiative(
                rows.stream().map(EncounterStateSnapshot.InitiativeRow::combatantId).toList(),
                rows.stream().map(ignored -> 12).toList()));
        assertEquals(
                1L,
                route.state().current().combatPane().combatCards().stream()
                        .filter(card -> card.worldNpcId() == 9901L)
                        .count(),
                "friendly NPC enters combat exactly once");
    }

    private static void assertLocationLimitsTablesAndFactionStock(TestRuntime runtime) {
        EncounterRoute route = runtime.encounterRoute();
        route.tables().reset();

        EncounterStateSnapshot snapshot = route.generate(inputs(
                List.of(),
                List.of(),
                runtime.seedIds().locationId()));

        assertEquals(List.of(301L, 302L, 201L), route.tables().lastTableIds(), "location table scope");
        assertRosterAtMost(snapshot.builderPane().rosterCards(), 103L, 3, "summed finite caps");
    }

    private static void assertExplicitTablesAreIntersectedWithWorldSources(TestRuntime runtime) {
        EncounterRoute route = runtime.encounterRoute();
        route.tables().reset();

        EncounterStateSnapshot snapshot = route.generate(inputs(
                List.of(302L, 999L),
                List.of(runtime.seedIds().cinderCourtId()),
                0L));

        assertEquals(List.of(302L), route.tables().lastTableIds(), "explicit table intersection");
        assertRosterAtMost(
                snapshot.builderPane().rosterCards(),
                103L,
                2,
                "finite cap retained beside unlimited statblock");
        assertAny(snapshot.builderPane().rosterCards(), 101L, "unlimited statblock has no cap");
    }

    private static void assertInvalidWorldSourceBlocksTableMatches(TestRuntime runtime) {
        EncounterRoute route = runtime.encounterRoute();
        route.tables().reset();

        EncounterStateSnapshot snapshot = route.generate(inputs(List.of(999L), List.of(404L), 0L));

        assertEquals(List.of(), route.tables().lastTableIds(), "invalid faction source blocks matches");
        assertEquals(List.of(), snapshot.builderPane().rosterCards(), "invalid source publishes no finite caps");
    }

    private static void assertFiniteCapsConstrainDraftEnumeration() {
        EncounterCandidateProfile guard = EncounterCandidateProfile.fromFacts(creature(101L, "Ash Guard", 50));
        EncounterCandidateProfile brute = EncounterCandidateProfile.fromFacts(creature(102L, "Ash Brute", 75));
        List<EncounterCandidateProfile> pool = List.of(guard, brute);
        EncounterDifficultyThresholds thresholds = new EncounterDifficultyThresholds(50, 100, 150, 200);

        List<EncounterDraft> capped = new EncounterDraftGenerationModel(
                EncounterDifficultyIntent.MEDIUM,
                thresholds,
                4,
                EncounterTuningIntent.defaultIntent(),
                List.of(),
                Map.of(),
                pool,
                Map.of(101L, 1)).createDrafts();
        assertAtMost(capped, 101L, 1, "finite cap limits guard copies");

        List<EncounterDraft> blocked = new EncounterDraftGenerationModel(
                EncounterDifficultyIntent.MEDIUM,
                thresholds,
                4,
                EncounterTuningIntent.defaultIntent(),
                List.of(),
                Map.of(),
                List.of(guard),
                Map.of(101L, 0)).createDrafts();
        assertEquals(0, blocked.size(), "zero finite cap blocks only available creature");
    }

    private static void assertWorldNpcIdentitySurvivesCombatResults(TestRuntime runtime) {
        EncounterRoute route = runtime.encounterRoute();
        EncounterApi service = route.service();
        EncounterStateModel state = route.state();

        service.applyState(ApplyEncounterStateCommand.addWorldNpcCreature(101L, 7001L));
        assertEquals(7001L, state.current().builderPane().rosterCards().getFirst().worldNpcId(), "builder world npc id");

        service.applyState(ApplyEncounterStateCommand.openInitiative());
        List<String> ids = state.current().initiativePane().rows().stream()
                .map(EncounterStateSnapshot.InitiativeRow::combatantId)
                .toList();
        List<Integer> initiatives = state.current().initiativePane().rows().stream()
                .map(entry -> 12)
                .toList();
        service.applyState(ApplyEncounterStateCommand.confirmInitiative(ids, initiatives));

        EncounterStateSnapshot.CombatCard npcCard = state.current().combatPane().combatCards().stream()
                .filter(card -> card.worldNpcId() == 7001L)
                .findFirst()
                .orElseThrow(() -> new AssertionError("combat card world npc id missing"));
        service.applyState(ApplyEncounterStateCommand.mutateHitPoints(npcCard.combatantId(), 999, false));
        service.applyState(ApplyEncounterStateCommand.endCombat());

        EncounterStateSnapshot.ResultEnemy result = state.current().resolutionPane().enemyResults().stream()
                .filter(enemy -> enemy.worldNpcId() == 7001L)
                .findFirst()
                .orElseThrow(() -> new AssertionError("result world npc id missing"));
        assertEquals(101L, result.creatureId(), "result world npc expected statblock id");
        assertEquals(true, result.defeatedByDefault(), "world npc result defeated");
    }

    private static void assertMissingReferencesAreRejectedByProductionAdapter(TestRuntime runtime) {
        WorldPlannerApplicationService worlds = runtime.components.worldApplication();
        WorldPlannerSnapshot before = runtime.components.worldSnapshot().current();

        worlds.createNpc(new CreateWorldNpcCommand("Missing Creature", 999L, "", "", "", ""));
        worlds.createFaction(new CreateWorldFactionCommand("Missing Table", "", 999L));

        WorldPlannerSnapshot after = runtime.components.worldSnapshot().current();
        assertEquals(before.npcs().size(), after.npcs().size(), "missing creature reference rejected");
        assertEquals(before.factions().size(), after.factions().size(), "missing table reference rejected");
    }

    private static EncounterBuilderInputs inputs(List<Long> tableIds, List<Long> factionIds, long locationId) {
        return new EncounterBuilderInputs(
                List.of(),
                List.of(),
                List.of(),
                false,
                4,
                false,
                3,
                false,
                5.0,
                false,
                2,
                tableIds,
                factionIds,
                locationId);
    }

    private static EncounterCreatureFacts creature(long id, String name, int xp) {
        return new EncounterCreatureFacts(
                id,
                name,
                "humanoid",
                "1/4",
                xp,
                10,
                null,
                null,
                null,
                12,
                1,
                0,
                0,
                0,
                0,
                0,
                "",
                "",
                "",
                10,
                List.of());
    }

    private static void assertAtMost(List<EncounterDraft> drafts, long creatureId, int expectedMax, String label) {
        int actualMax = 0;
        for (EncounterDraft draft : drafts) {
            for (EncounterDraftEntry entry : draft.entries()) {
                if (entry.creatureId() == creatureId) {
                    actualMax = Math.max(actualMax, entry.quantity());
                }
            }
        }
        if (actualMax > expectedMax) {
            throw new AssertionError(label + " expected at most " + expectedMax + " but was " + actualMax);
        }
    }

    private static void assertRosterAtMost(
            List<EncounterStateSnapshot.RosterCard> roster,
            long creatureId,
            int expectedMax,
            String label
    ) {
        int actualMax = 0;
        for (EncounterStateSnapshot.RosterCard card : roster) {
            if (card.creatureId() == creatureId) {
                actualMax = Math.max(actualMax, card.count());
            }
        }
        if (actualMax > expectedMax) {
            throw new AssertionError(label + " expected at most " + expectedMax + " but was " + actualMax);
        }
    }

    private static void assertAny(List<EncounterStateSnapshot.RosterCard> roster, long creatureId, String label) {
        for (EncounterStateSnapshot.RosterCard card : roster) {
            if (card.creatureId() == creatureId && card.count() > 0) {
                return;
            }
        }
        throw new AssertionError(label + " expected creature " + creatureId + " in generated roster");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(label + " expected " + expected + " but was " + actual);
        }
    }

    private record EncounterRoute(
            EncounterApi service,
            EncounterStateModel state,
            RecordingEncounterTableCatalogPort tables,
            EncounterRuntimeContextApi contexts,
            EncounterPlanRepository plans
    ) {

        EncounterStateSnapshot generate(EncounterBuilderInputs inputs) {
            service.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(inputs));
            service.applyState(ApplyEncounterStateCommand.generate());
            return state.current();
        }
    }

    private record SeedIds(long cinderCourtId, long locationId) {
    }

    private static final class TestRuntime implements AutoCloseable {

        private final TestFeatureStores.TestResource stores;
        private final RecordingEncounterTableCatalogPort encounterTables;
        private final Components components;
        private final SeedIds seedIds;

        private TestRuntime(
                TestFeatureStores.TestResource stores,
                RecordingEncounterTableCatalogPort encounterTables,
                Components components,
                SeedIds seedIds
        ) {
            this.stores = Objects.requireNonNull(stores, "stores");
            this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
            this.components = Objects.requireNonNull(components, "components");
            this.seedIds = Objects.requireNonNull(seedIds, "seedIds");
        }

        static TestRuntime create(TestFeatureStores.TestResource stores) {
            FixtureCreatureCatalogPort creatures = new FixtureCreatureCatalogPort();
            RecordingEncounterTableCatalogPort encounterTables = new RecordingEncounterTableCatalogPort();
            Components components = components(stores, creatures, encounterTables);
            return new TestRuntime(stores, encounterTables, components, seedProductionState(components));
        }

        SeedIds seedIds() {
            return seedIds;
        }

        EncounterRoute encounterRoute() {
            CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(components.creaturePort());
            EncounterTableServiceAssembly.Component tables =
                    EncounterTableServiceAssembly.create(components.tablePort());
            InMemoryPlanRepository plans = new InMemoryPlanRepository();
            EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                    creatures.application(),
                    creatures.detail(),
                    creatures.encounterCandidates(),
                    tables.application(),
                    tables.candidates(),
                    components.worldSnapshot(),
                    components.party().application(),
                    components.party().activeParty(),
                    components.party().activeComposition(),
                    components.party().adventuringDaySummary(),
                    components.party().mutation(),
                    plans);
            return new EncounterRoute(
                    encounter.application(),
                    encounter.state(),
                    encounterTables,
                    encounter.runtimeContexts(),
                    plans);
        }

        private static Components components(
                TestFeatureStores.TestResource stores,
                CreatureCatalogPort creaturePort,
                EncounterTableCatalogPort tablePort
        ) {
            PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                                    stores.store(
                                            SqlitePartyRosterRepository.storeDefinition())));
            CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(creaturePort);
            EncounterTableServiceAssembly.Component tables = EncounterTableServiceAssembly.create(tablePort);
            WorldPlannerServiceAssembly worldAssembly = new WorldPlannerServiceAssembly(
                    new SqliteWorldPlannerRepository(
                                    stores.store(
                                            SqliteWorldPlannerRepository.storeDefinition())),
                    WorldPlannerReferenceAssembly.catalogReferences(creatures.references(), tables.references()));
            WorldPlannerApplicationService worldApplication = worldAssembly.createApplicationService();
            WorldPlannerSnapshotModel worldSnapshot = worldAssembly.snapshotModel();
            return new Components(creaturePort, tablePort, party, worldApplication, worldSnapshot);
        }

        @Override
        public void close() {
            stores.close();
        }

        private static SeedIds seedProductionState(Components components) {
            seedParty(components.party().application());
            WorldPlannerApplicationService worlds = components.worldApplication();
            WorldPlannerSnapshotModel snapshots = components.worldSnapshot();

            worlds.createNpc(new CreateWorldNpcCommand(
                    "Captain Vale",
                    101L,
                    "",
                    "",
                    "",
                    ""));
            long captainValeId = npcId(snapshots.current(), "Captain Vale");
            worlds.createFaction(new CreateWorldFactionCommand("Ash Guard", "", 201L));
            long ashGuardId = factionId(snapshots.current(), "Ash Guard");
            worlds.addFactionNpc(new AddWorldFactionNpcCommand(ashGuardId, captainValeId));
            worlds.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(ashGuardId, 101L, true, 3));
            worlds.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(ashGuardId, 103L, true, 1));
            worlds.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(ashGuardId, 102L, false, 0));

            worlds.createFaction(new CreateWorldFactionCommand("Cinder Court", "", 302L));
            long cinderCourtId = factionId(snapshots.current(), "Cinder Court");
            worlds.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(cinderCourtId, 101L, false, 0));
            worlds.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(cinderCourtId, 103L, true, 2));

            worlds.createLocation(new CreateWorldLocationCommand("Old Gate", ""));
            long locationId = locationId(snapshots.current(), "Old Gate");
            worlds.addLocationFaction(new AddWorldLocationFactionCommand(locationId, ashGuardId));
            worlds.addLocationFaction(new AddWorldLocationFactionCommand(locationId, cinderCourtId));
            worlds.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(locationId, 301L));
            worlds.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(locationId, 302L));
            return new SeedIds(cinderCourtId, locationId);
        }

        private static void seedParty(PartyApi party) {
            party.createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Asha", "Mira", 3, 12, 16),
                    MembershipState.ACTIVE));
            party.createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Borin", "Kestrel", 10, 12, 16),
                    MembershipState.ACTIVE));
            party.calculateAdventuringDay(new CalculateAdventuringDayCommand(List.of(3, 10), 0));
        }

        private static long npcId(WorldPlannerSnapshot snapshot, String name) {
            return snapshot.npcs().stream()
                    .filter(npc -> name.equals(npc.displayName()))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(name + " seed NPC missing"))
                    .npcId();
        }

        private static long factionId(WorldPlannerSnapshot snapshot, String name) {
            return snapshot.factions().stream()
                    .filter(faction -> name.equals(faction.displayName()))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(name + " seed faction missing"))
                    .factionId();
        }

        private static long locationId(WorldPlannerSnapshot snapshot, String name) {
            return snapshot.locations().stream()
                    .filter(location -> name.equals(location.displayName()))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(name + " seed location missing"))
                    .locationId();
        }
    }

    private record Components(
            CreatureCatalogPort creaturePort,
            EncounterTableCatalogPort tablePort,
            PartyServiceAssembly.Component party,
            WorldPlannerApplicationService worldApplication,
            WorldPlannerSnapshotModel worldSnapshot
    ) {
    }

    private static final class InMemoryPlanRepository implements EncounterPlanRepository,
            GeneratedEncounterBatchRepository {

        private final Map<Long, EncounterPlan> plans = new LinkedHashMap<>();
        private long nextId = 1L;

        @Override
        public EncounterPlan save(EncounterPlan plan) {
            long id = plan.id() > 0L ? plan.id() : nextId++;
            EncounterPlan saved = new EncounterPlan(id, plan.name(), plan.generatedLabel(), plan.creatures());
            plans.put(Long.valueOf(id), saved);
            return saved;
        }

        @Override
        public Optional<EncounterPlan> load(long planId) {
            return Optional.ofNullable(plans.get(Long.valueOf(planId)));
        }

        @Override
        public List<EncounterPlanSummary> list() {
            return plans.values().stream()
                    .map(plan -> new EncounterPlanSummary(
                            plan.id(),
                            plan.name(),
                            plan.generatedLabel(),
                            plan.creatureCount()))
                    .toList();
        }

        @Override
        public CommitOutcome commit(features.encounter.api.PreparedEncounterBatch batch) {
            List<Mapping> mappings = new ArrayList<>();
            for (var roster : batch.rosters()) {
                EncounterPlan saved = save(new EncounterPlan(
                        0L,
                        roster.displayLabel(),
                        roster.displayLabel(),
                        roster.creatures().stream()
                                .map(creature -> new features.encounter.domain.plan.EncounterPlanCreature(
                                        creature.creatureId(), creature.quantity(), creature.displayName()))
                                .toList()));
                mappings.add(new Mapping(roster.encounterNumber(), saved.id()));
            }
            return new CommitOutcome(CommitOutcome.Status.COMMITTED, mappings);
        }

        @Override
        public List<EncounterPlan> loadPlansByIds(List<Long> planIds) {
            return planIds.stream().map(plans::get).filter(Objects::nonNull).toList();
        }
    }

    private static final class FixtureCreatureCatalogPort implements CreatureCatalogPort {

        private final Map<Long, CreatureCatalogData.CreatureProfile> profiles = Map.of(
                101L, profile(101L, "Ash Guard", 50),
                102L, profile(102L, "Ash Brute", 75),
                103L, profile(103L, "Cinder Scout", 10));

        @Override
        public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return CreatureCatalogData.emptyFilterValues();
        }

        @Override
        public CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec) {
            return CreatureCatalogData.emptyCatalogPage(50, 0);
        }

        @Override
        public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) {
            return profiles.get(creatureId);
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            List<CreatureCatalogData.EncounterCandidateProfile> candidates = new ArrayList<>();
            for (CreatureCatalogData.CreatureProfile profile : profiles.values()) {
                if (profile.xp() >= spec.minimumXp() && profile.xp() <= spec.maximumXp()) {
                    candidates.add(candidate(profile));
                }
            }
            return candidates.stream().limit(Math.max(0, spec.limit())).toList();
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadCreatureFacts(
                CreatureCatalogData.CreatureFactsSpec spec
        ) {
            return profiles.values().stream()
                    .filter(profile -> spec.mode() == CreatureCatalogData.CreatureFactsSpec.FactsMode.CREATURE_IDS
                            ? spec.values().contains(Long.valueOf(profile.id()))
                            : spec.values().contains(Long.valueOf(profile.xp())))
                    .map(FixtureCreatureCatalogPort::candidate)
                    .sorted(java.util.Comparator.comparingLong(CreatureCatalogData.EncounterCandidateProfile::id))
                    .toList();
        }

        private static CreatureCatalogData.CreatureProfile profile(long id, String name, int xp) {
            return new CreatureCatalogData.CreatureProfile(
                    new CreatureCatalogData.CreatureIdentity(
                            id,
                            name,
                            "Medium",
                            "humanoid",
                            List.of(),
                            List.of(),
                            "neutral",
                            "1/4",
                            xp),
                    new CreatureCatalogData.CreatureVitals(10, null, 1, 8, 0, 12, null, 30, 0, 0, 0, 0),
                    new CreatureCatalogData.CreatureAbilities(10, 12, 10, 10, 10, 10, 1, 2),
                    new CreatureCatalogData.CreatureTraits(null, null, null, null, null, null, null, 10, null, 0),
                    List.of());
        }

        private static CreatureCatalogData.EncounterCandidateProfile candidate(
                CreatureCatalogData.CreatureProfile profile
        ) {
            return new CreatureCatalogData.EncounterCandidateProfile(
                    profile.id(),
                    profile.name(),
                    profile.creatureType(),
                    profile.challengeRating(),
                    profile.xp(),
                    profile.hitPoints(),
                    profile.hitDiceCount(),
                    profile.hitDiceSides(),
                    profile.hitDiceModifier(),
                    profile.armorClass(),
                    profile.initiativeBonus(),
                    profile.legendaryActionCount());
        }
    }

    private static final class RecordingEncounterTableCatalogPort implements EncounterTableCatalogPort {

        private final Map<Long, List<EncounterTableCandidateData>> tableCandidates = new LinkedHashMap<>();
        private List<Long> lastTableIds = List.of();

        private RecordingEncounterTableCatalogPort() {
            tableCandidates.put(201L, List.of(tableCandidate(101L, "Ash Guard", 50)));
            tableCandidates.put(301L, List.of(tableCandidate(103L, "Cinder Scout", 10)));
            tableCandidates.put(302L, List.of(
                    tableCandidate(101L, "Ash Guard", 50),
                    tableCandidate(103L, "Cinder Scout", 10)));
        }

        void reset() {
            lastTableIds = List.of();
        }

        List<Long> lastTableIds() {
            return lastTableIds;
        }

        @Override
        public List<EncounterTableSummaryData> loadSummaries() {
            return tableCandidates.keySet().stream()
                    .map(id -> new EncounterTableSummaryData(id, "Table " + id, null))
                    .toList();
        }

        @Override
        public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
            lastTableIds = tableIds == null ? List.of() : List.copyOf(tableIds);
            Map<Long, EncounterTableCandidateData> unique = new LinkedHashMap<>();
            for (Long tableId : lastTableIds) {
                for (EncounterTableCandidateData candidate : tableCandidates.getOrDefault(tableId, List.of())) {
                    if (candidate.xp() <= maximumXp) {
                        unique.putIfAbsent(candidate.creatureId(), candidate);
                    }
                }
            }
            return List.copyOf(unique.values());
        }

        private static EncounterTableCandidateData tableCandidate(long creatureId, String name, int xp) {
            return new EncounterTableCandidateData(
                    creatureId,
                    name,
                    "humanoid",
                    "1/4",
                    xp,
                    10,
                    1,
                    8,
                    0,
                    12,
                    1,
                    0,
                    1);
        }
    }
}
