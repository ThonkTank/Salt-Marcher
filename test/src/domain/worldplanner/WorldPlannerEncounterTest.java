package src.domain.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import shell.api.ServiceRegistry;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.generation.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.EncounterDraft;
import src.domain.encounter.model.generation.EncounterDraftEntry;
import src.domain.encounter.model.generation.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.AddWorldFactionNpcCommand;
import src.domain.worldplanner.published.AddWorldLocationEncounterTableCommand;
import src.domain.worldplanner.published.AddWorldLocationFactionCommand;
import src.domain.worldplanner.published.CreateWorldFactionCommand;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.domain.worldplanner.published.SetWorldFactionInventoryLimitCommand;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

@TestMethodOrder(OrderAnnotation.class)
public final class WorldPlannerEncounterTest {

    private static TestRuntime runtime;

    private WorldPlannerEncounterTest() {
    }

    @BeforeAll
    static void createRuntime() {
        runtime = TestRuntime.create();
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
        EncounterApplicationService service = route.service();
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
            EncounterApplicationService service,
            EncounterStateModel state,
            RecordingEncounterTableCatalogPort tables
    ) {

        EncounterStateSnapshot generate(EncounterBuilderInputs inputs) {
            service.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(inputs));
            service.applyState(ApplyEncounterStateCommand.generate());
            return state.current();
        }
    }

    private record SeedIds(long cinderCourtId, long locationId) {
    }

    private static final class TestRuntime {

        private final FixtureCreatureCatalogPort creatures = new FixtureCreatureCatalogPort();
        private final RecordingEncounterTableCatalogPort encounterTables = new RecordingEncounterTableCatalogPort();
        private final SeedIds seedIds;

        private TestRuntime(SeedIds seedIds) {
            this.seedIds = Objects.requireNonNull(seedIds, "seedIds");
        }

        static TestRuntime create() {
            return new TestRuntime(seedProductionState());
        }

        SeedIds seedIds() {
            return seedIds;
        }

        EncounterRoute encounterRoute() {
            ServiceRegistry registry = registry();
            return new EncounterRoute(
                    registry.require(EncounterApplicationService.class),
                    registry.require(EncounterStateModel.class),
                    encounterTables);
        }

        private ServiceRegistry registry() {
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(CreatureCatalogPort.class, creatures);
            builder.register(EncounterTableCatalogPort.class, encounterTables);
            new src.data.worldplanner.WorldPlannerServiceContribution().register(builder);
            new src.data.party.PartyServiceContribution().register(builder);
            new src.data.encounter.EncounterServiceContribution().register(builder);
            new src.domain.creatures.CreaturesServiceContribution().register(builder);
            new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new src.domain.worldplanner.WorldPlannerServiceContribution().register(builder);
            new src.domain.encounter.EncounterServiceContribution().register(builder);
            return builder.build();
        }

        private static SeedIds seedProductionState() {
            TestRuntime runtime = new TestRuntime(new SeedIds(0L, 0L));
            ServiceRegistry registry = runtime.registry();
            seedParty(registry.require(PartyApplicationService.class));
            WorldPlannerApplicationService worlds = registry.require(WorldPlannerApplicationService.class);
            WorldPlannerSnapshotModel snapshots = registry.require(WorldPlannerSnapshotModel.class);

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

        private static void seedParty(PartyApplicationService party) {
            party.createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Asha", "Mira", 3, 12, 16),
                    MembershipState.ACTIVE));
            party.calculateAdventuringDay(new CalculateAdventuringDayCommand(List.of(3), 0));
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
