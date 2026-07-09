package src.domain.encounter;

import java.util.List;
import java.util.Map;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.generation.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.EncounterDraft;
import src.domain.encounter.model.generation.EncounterDraftEntry;
import src.domain.encounter.model.generation.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.generation.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.plan.usecase.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.session.AwardXpOutcome;
import src.domain.encounter.model.session.BudgetData;
import src.domain.encounter.model.session.CombatCardData;
import src.domain.encounter.model.session.CreatureDetailData;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.model.session.GenerationResultData;
import src.domain.encounter.model.session.ListPlansOutcome;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encounter.model.session.PlanOutcome;
import src.domain.encounter.model.session.ResultEnemyData;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.UpdateEncounterBuilderInputsUseCase;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class WorldPlannerEncounterHarness {

    private WorldPlannerEncounterHarness() {
    }

    public static void main(String[] args) {
        assertLocationLimitsTablesAndFactionStock();
        assertExplicitTablesAreIntersectedWithWorldSources();
        assertInvalidWorldSourceBlocksTableMatches();
        assertFiniteCapsConstrainDraftEnumeration();
        assertWorldNpcIdentitySurvivesCombatResults();
    }

    private static void assertLocationLimitsTablesAndFactionStock() {
        EncounterGenerationRequest resolved = EncounterWorldPlannerSourceServiceAssembly.resolve(
                request(List.of(), List.of(), 501L),
                sourcePort());

        assertEquals(List.of(301L, 302L, 201L), resolved.encounterTableIds(), "location table scope");
        assertEquals(Map.of(103L, 3), resolved.finiteCreatureStockCaps(), "summed finite caps");
    }

    private static void assertExplicitTablesAreIntersectedWithWorldSources() {
        EncounterGenerationRequest resolved = EncounterWorldPlannerSourceServiceAssembly.resolve(
                request(List.of(302L, 999L), List.of(2L), 0L),
                sourcePort());

        assertEquals(List.of(302L), resolved.encounterTableIds(), "explicit table intersection");
        assertEquals(Map.of(103L, 2), resolved.finiteCreatureStockCaps(), "finite cap retained beside unlimited statblock");
        assertEquals(false, resolved.finiteCreatureStockCaps().containsKey(101L), "unlimited statblock has no cap");
    }

    private static void assertInvalidWorldSourceBlocksTableMatches() {
        EncounterGenerationRequest resolved = EncounterWorldPlannerSourceServiceAssembly.resolve(
                request(List.of(999L), List.of(404L), 0L),
                sourcePort());

        assertEquals(List.of(-1L), resolved.encounterTableIds(), "invalid faction source blocks matches");
        assertEquals(Map.of(), resolved.finiteCreatureStockCaps(), "invalid source publishes no finite caps");
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

    private static void assertWorldNpcIdentitySurvivesCombatResults() {
        EncounterPublicationSink sink = new EncounterPublicationSink();
        ApplyEncounterSessionUseCase sessionUseCase = new ApplyEncounterSessionUseCase(new FixtureEncounterRepository());
        PublishEncounterSessionUseCase publishSession = new PublishEncounterSessionUseCase(sink, null);
        EncounterApplicationService service = new EncounterApplicationService(
                new ApplyEncounterStateUseCase(
                        sessionUseCase,
                        publishSession,
                        new PublishEncounterSavedPlansUseCase(new NoopPlanPublicationSink(), null)),
                new UpdateEncounterBuilderInputsUseCase(sessionUseCase, publishSession),
                new PublishEncounterPlanBudgetUseCase(new NoopPlanPublicationSink(), null));

        service.applyState(ApplyEncounterStateCommand.addWorldNpcCreature(101L, 7001L));
        assertEquals(7001L, sink.current.snapshot().builderState().roster().get(0).worldNpcId(), "builder world npc id");

        service.applyState(ApplyEncounterStateCommand.openInitiative());
        List<String> ids = sink.current.snapshot().initiativeEntries().stream()
                .map(entry -> entry.id())
                .toList();
        List<Integer> initiatives = sink.current.snapshot().initiativeEntries().stream()
                .map(entry -> 12)
                .toList();
        service.applyState(ApplyEncounterStateCommand.confirmInitiative(ids, initiatives));

        CombatCardData npcCard = sink.current.snapshot().combatProjection().cards().stream()
                .filter(card -> card.worldNpcId() == 7001L)
                .findFirst()
                .orElseThrow(() -> new AssertionError("combat card world npc id missing"));
        service.applyState(ApplyEncounterStateCommand.mutateHitPoints(npcCard.id(), 999, false));
        service.applyState(ApplyEncounterStateCommand.endCombat());

        ResultEnemyData result = sink.current.snapshot().resultState().enemies().stream()
                .filter(enemy -> enemy.worldNpcId() == 7001L)
                .findFirst()
                .orElseThrow(() -> new AssertionError("result world npc id missing"));
        assertEquals(101L, result.creatureId(), "result world npc expected statblock id");
        assertEquals(true, result.defeatedByDefault(), "world npc result defeated");
    }

    private static WorldPlannerSnapshotModel sourcePort() {
        WorldPlannerSnapshotModel model = new WorldPlannerSnapshotModel(WorldPlannerEncounterHarness::snapshot, listener -> () -> { });
        return model;
    }

    private static EncounterGenerationRequest request(List<Long> tableIds, List<Long> factionIds, long locationId) {
        return new EncounterGenerationRequest(
                new EncounterGenerationInputs(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterRequestedDifficulty.autoDifficulty(),
                        EncounterTuningIntent.autoIntent(),
                        tableIds,
                        factionIds,
                        locationId,
                        Map.of()),
                5,
                0L,
                List.of(),
                List.of());
    }

    private static WorldPlannerSnapshot snapshot() {
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(new WorldNpcSummary(1L, "Captain Vale", 101L, "", "", "", "", WorldNpcLifecycleStatus.ACTIVE)),
                List.of(
                        new WorldFactionSummary(
                                1L,
                                "Ash Guard",
                                "",
                                201L,
                                List.of(1L),
                                List.of(
                                        new WorldFactionInventoryLimitSummary(101L, true, 3),
                                        new WorldFactionInventoryLimitSummary(103L, true, 1),
                                        new WorldFactionInventoryLimitSummary(102L, false, 0))),
                        new WorldFactionSummary(
                                2L,
                                "Cinder Court",
                                "",
                                302L,
                                List.of(),
                                List.of(
                                        new WorldFactionInventoryLimitSummary(101L, false, 0),
                                        new WorldFactionInventoryLimitSummary(103L, true, 2)))),
                List.of(new WorldLocationSummary(501L, "Old Gate", "", List.of(1L, 2L), List.of(301L, 302L))),
                "");
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

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(label + " expected " + expected + " but was " + actual);
        }
    }

    private static final class EncounterPublicationSink implements EncounterSessionPublishedStateRepository {

        private EncounterSessionPublicationData current;

        @Override
        public void publishCurrentSession(EncounterSessionPublicationData publication) {
            current = publication;
        }
    }

    private static final class NoopPlanPublicationSink implements EncounterPlanPublishedStateRepository {

        @Override
        public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
        }

        @Override
        public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
        }
    }

    private static final class FixtureEncounterRepository implements EncounterSession.SessionRepository {

        @Override
        public List<PartyMemberData> loadActiveParty() {
            return List.of(new PartyMemberData("pc-1", 1L, "Asha", 3));
        }

        @Override
        public java.util.Optional<BudgetData> loadBudget() {
            return java.util.Optional.empty();
        }

        @Override
        public GenerationResultData generate(EncounterGenerationRequest request) {
            return new GenerationResultData(false, List.of(), "", java.util.Optional.empty(), false);
        }

        @Override
        public PlanOutcome savePlan(EncounterPlan plan) {
            return new PlanOutcome(java.util.Optional.empty(), "");
        }

        @Override
        public PlanOutcome loadPlan(long planId) {
            return new PlanOutcome(java.util.Optional.empty(), "");
        }

        @Override
        public ListPlansOutcome listPlans() {
            return new ListPlansOutcome(true, List.of(), "");
        }

        @Override
        public java.util.Optional<CreatureDetailData> loadCreature(long creatureId) {
            return creatureId == 101L
                    ? java.util.Optional.of(new CreatureDetailData(101L, "Ash Guard", "1/4", 50, 10, 12, 1, "humanoid"))
                    : java.util.Optional.empty();
        }

        @Override
        public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
            return new AwardXpOutcome(true);
        }
    }
}
