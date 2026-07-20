package features.encounter.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.api.EncounterRuntimeNpcRole;
import features.encounter.api.EncounterRuntimeNpcSpec;
import features.encounter.application.EncounterRuntimeContextRepository;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterGenerationRequest;
import features.encounter.domain.generation.EncounterRequestedDifficulty;
import features.encounter.domain.generation.EncounterTuningIntent;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.session.AwardXpOutcome;
import features.encounter.domain.session.BudgetData;
import features.encounter.domain.session.Combatant;
import features.encounter.domain.session.CombatantId;
import features.encounter.domain.session.CombatantKind;
import features.encounter.domain.session.CreatureDetailData;
import features.encounter.domain.session.EncounterCreatureData;
import features.encounter.domain.session.EncounterSession;
import features.encounter.domain.session.EncounterSessionCommand;
import features.encounter.domain.session.EncounterSessionMemento;
import features.encounter.domain.session.GeneratedEncounterData;
import features.encounter.domain.session.GenerationResultData;
import features.encounter.domain.session.InitiativeEntryData;
import features.encounter.domain.session.ListPlansOutcome;
import features.encounter.domain.session.PartyMemberData;
import features.encounter.domain.session.PlanOutcome;
import features.encounter.domain.session.ResultEnemyData;
import features.encounter.domain.session.ResultStateData;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import java.util.Map;
import java.util.Optional;

final class SqliteEncounterRuntimeContextRepositoryTest {

    @TempDir
    Path directory;

    @Test
    void roundTripsIndependentRuntimeStateThroughNamedRelationalTables() throws Exception {
        Path path = directory.resolve("encounter-contexts.db");
        EncounterRuntimeContextId id = new EncounterRuntimeContextId("scene-17");
        EncounterRuntimeContextSpec spec = new EncounterRuntimeContextSpec(
                id,
                List.of(11L, 12L),
                31L,
                41L,
                List.of(new EncounterRuntimeNpcSpec(51L, 61L, EncounterRuntimeNpcRole.ALLY)));
        EncounterCreatureData goblin = new EncounterCreatureData(
                "monster-61", 61L, 0L, "Goblin", "1/4", 50, 7, 15, 2,
                "Humanoid", "Manual", 2, List.of("cave"));
        EncounterCreatureData bugbear = new EncounterCreatureData(
                "monster-62", 62L, 0L, "Bugbear", "1", 200, 27, 16, 2,
                "Humanoid", "Generated", 1, List.of("cave", "boss"));
        GeneratedEncounterData firstAlternative = new GeneratedEncounterData(
                "Goblin Patrol", "Medium", 100, List.of(goblin), List.of("First advisory"));
        GeneratedEncounterData secondAlternative = new GeneratedEncounterData(
                "Bugbear Ambush", "Hard", 300, List.of(bugbear), List.of("Second advisory", "Low variety"));
        EncounterGenerationInputs inputs = new EncounterGenerationInputs(
                List.of("Humanoid"), List.of("Goblin"), List.of("Cave"),
                EncounterRequestedDifficulty.HARD, new EncounterTuningIntent(4, 2.0, 3),
                List.of(71L), List.of(81L), 31L, Map.of(61L, 4));
        ResultStateData result = new ResultStateData(
                List.of(new ResultEnemyData("Bugbear", 62L, 0L, "Besiegt", 27, 200, true, "")),
                1L, 200, 100, "Kein Loot", "", "", false, true, 2);
        EncounterSessionMemento session = new EncounterSessionMemento(
                2,
                "Kampf läuft.",
                inputs,
                List.of(firstAlternative, secondAlternative),
                secondAlternative.advisoryMessages(),
                1,
                secondAlternative.adjustedXp(),
                secondAlternative.difficultyLabel(),
                secondAlternative.title(),
                true,
                true,
                secondAlternative.roster(),
                Optional.empty(),
                3L,
                0L,
                List.of(new InitiativeEntryData("monster-62", "Bugbear", CombatantKind.MONSTER, 14)),
                List.of(new Combatant(
                        "monster-62:1", "Bugbear", CombatantKind.MONSTER, 62L, 0L,
                        17, 27, 16, 14, 1, 200, "", "", 0)),
                0,
                2,
                result);
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteEncounterRuntimeContextRepository repository =
                    new SqliteEncounterRuntimeContextRepository(
                            TestFeatureStores.store(
                                    database,
                                    features.encounter.EncounterServiceAssembly.storeDefinition()));
            repository.replace(new EncounterRuntimeContextRepository.StoredRuntimeContexts(
                    9L,
                    id,
                    List.of(new EncounterRuntimeContextRepository.StoredRuntimeContext(spec, session))));
        }

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteEncounterRuntimeContextRepository repository =
                    new SqliteEncounterRuntimeContextRepository(
                            TestFeatureStores.store(
                                    database,
                                    features.encounter.EncounterServiceAssembly.storeDefinition()));
            var loaded = repository.load();
            assertEquals(9L, loaded.sourceRevision());
            assertEquals(id, loaded.focusedContextId());
            assertEquals(spec, loaded.contexts().getFirst().specification());
            assertEquals(session, loaded.contexts().getFirst().session());

            EncounterSession restarted = new EncounterSession();
            restarted.restore(loaded.contexts().getFirst().session(), new RuntimeAccess());
            assertEquals(session, restarted.memento());

            restarted.apply(shiftAlternative(1), new RuntimeAccess());
            assertEquals(0, restarted.memento().selectedAlternativeIndex());
            assertEquals(firstAlternative.roster(), restarted.memento().roster());
            assertEquals(firstAlternative.advisoryMessages(), restarted.memento().generatedAdvisories());
            assertEquals(firstAlternative.title(), restarted.memento().generatedTitle());
            assertEquals(firstAlternative.adjustedXp(), restarted.memento().generatedAdjustedXp());
            assertEquals(firstAlternative.difficultyLabel(), restarted.memento().generatedDifficulty());
            assertTrue(restarted.memento().generationHistoryPresent());
            assertTrue(restarted.memento().dirty());
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var tables = connection.createStatement().executeQuery(
                                        "SELECT sql FROM sqlite_master WHERE type='table' AND name"
                                            + " LIKE 'encounter_runtime_%'")) {
            while (tables.next()) {
                String definition = tables.getString(1).toLowerCase(java.util.Locale.ROOT);
                assertFalse(definition.contains("payload") || definition.contains("codec"));
            }
        }
    }

    @Test
    void tracksDirtyStateAcrossBuilderRosterLifecycle() {
        RuntimeAccess access = new RuntimeAccess();
        EncounterSession session = new EncounterSession();
        session.apply(EncounterSessionCommand.refresh(), access);
        assertFalse(session.memento().dirty());

        session.apply(command(EncounterSessionCommand.Action.ADD_CREATURE, 61L, 0L, 0), access);
        assertTrue(session.memento().dirty());

        session.apply(command(EncounterSessionCommand.Action.SAVE_CURRENT_PLAN, 0L, 0L, 0), access);
        assertFalse(session.memento().dirty());

        session.apply(command(EncounterSessionCommand.Action.REMOVE_CREATURE, 61L, 0L, 0), access);
        assertTrue(session.memento().roster().isEmpty());
        assertTrue(session.memento().dirty());

        session.apply(command(EncounterSessionCommand.Action.OPEN_SAVED_PLAN, 0L, 99L, 0), access);
        assertFalse(session.memento().dirty());

        session.apply(command(EncounterSessionCommand.Action.GENERATE, 0L, 0L, 0), access);
        assertTrue(session.memento().dirty());
    }

    private static EncounterSessionCommand shiftAlternative(int delta) {
        return command(EncounterSessionCommand.Action.SHIFT_ALTERNATIVE, 0L, 0L, delta);
    }

    private static EncounterSessionCommand command(
            EncounterSessionCommand.Action action,
            long creatureId,
            long planId,
            int delta
    ) {
        return new EncounterSessionCommand(
                action,
                Optional.empty(),
                EncounterGenerationInputs.empty(),
                creatureId,
                planId,
                0L,
                delta,
                0L,
                List.of(),
                CombatantId.empty(),
                0,
                0L,
                0,
                false);
    }

    private static final class RuntimeAccess implements EncounterSession.SessionRepository {

        @Override
        public List<PartyMemberData> loadActiveParty() {
            return List.of(new PartyMemberData("pc-11", 11L, "Mira", 3));
        }

        @Override
        public Optional<BudgetData> loadBudget() {
            return Optional.of(new BudgetData(List.of(3), 3, 75, 150, 225, 400));
        }

        @Override
        public GenerationResultData generate(EncounterGenerationRequest request) {
            EncounterCreatureData creature = creature();
            return new GenerationResultData(
                    true,
                    List.of(new GeneratedEncounterData(
                            "Generated Patrol", "Medium", 100, List.of(creature), List.of("Generated advisory"))),
                    "Generated.",
                    Optional.empty(),
                    false);
        }

        @Override
        public PlanOutcome savePlan(EncounterPlan plan) {
            return new PlanOutcome(Optional.of(new EncounterPlan(
                    99L,
                    plan.name(),
                    plan.generatedLabel(),
                    plan.creatures())), "");
        }

        @Override
        public PlanOutcome loadPlan(long planId) {
            return new PlanOutcome(Optional.of(new EncounterPlan(
                    planId,
                    "Saved Patrol",
                    "",
                    List.of(new features.encounter.domain.plan.EncounterPlanCreature(61L, 1)))), "");
        }

        @Override
        public ListPlansOutcome listPlans() {
            return new ListPlansOutcome(true, List.of(), "");
        }

        @Override
        public Optional<CreatureDetailData> loadCreature(long creatureId) {
            return creatureId == 61L ? Optional.of(creatureDetail()) : Optional.empty();
        }

        @Override
        public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
            return new AwardXpOutcome(false);
        }

        private static EncounterCreatureData creature() {
            CreatureDetailData detail = creatureDetail();
            return new EncounterCreatureData(
                    "monster-61",
                    detail.id(),
                    0L,
                    detail.name(),
                    detail.challengeRating(),
                    detail.xp(),
                    detail.hitPoints(),
                    detail.armorClass(),
                    detail.initiativeBonus(),
                    detail.creatureType(),
                    "Generated",
                    1,
                    List.of("cave"));
        }

        private static CreatureDetailData creatureDetail() {
            return new CreatureDetailData(61L, "Goblin", "1/4", 50, 7, 15, 2, "Humanoid");
        }
    }
}
