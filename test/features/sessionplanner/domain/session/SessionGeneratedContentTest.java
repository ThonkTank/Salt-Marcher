package features.sessionplanner.domain.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;

final class SessionGeneratedContentTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void replacementKeepsSessionIdentityAndSeparatesGeneratedRewardsFromManualLoot() {
        SessionPlan original = SessionPlan.seeded(7L, List.of(11L, 12L), new EncounterDays(new BigDecimal("0.6")))
                .rename("Moon Vault")
                .addScene()
                .addManualLootNote(1L);
        List<SessionEncounter> scenes = List.of(
                new SessionEncounter(1L, 101L, new SessionEncounterAllocation(new BigDecimal("40"))),
                new SessionEncounter(2L, 102L, new SessionEncounterAllocation(new BigDecimal("60"))));
        List<SessionGeneratedRewardReference> rewards = List.of(
                new SessionGeneratedRewardReference(1L, "run-91", 1L, "Encounter treasure"),
                new SessionGeneratedRewardReference(2L, "run-91", 2L, "Quest reward"));

        SessionPlan replaced = original.replaceGeneratedContent(scenes, rewards);

        assertEquals(7L, replaced.sessionId());
        assertEquals("Moon Vault", replaced.displayName());
        assertEquals(List.of(11L, 12L), replaced.participantRefs());
        assertEquals(new BigDecimal("0.6"), replaced.encounterDays().value());
        assertTrue(replaced.manualLootNotes().isEmpty());
        assertEquals(rewards, replaced.generatedRewards());
        assertTrue(replaced.restPlacements().isEmpty());
    }

    @Test
    void generatedRewardsRoundTripThroughVersionTwoSchema() {
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("session-generation-roundtrip.db"),
                NoopDiagnostics.INSTANCE);
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(database);
        SessionPlan plan = SessionPlan.seeded(8L, List.of(21L), EncounterDays.one())
                .replaceGeneratedContent(
                        List.of(new SessionEncounter(
                                1L,
                                401L,
                                SessionEncounterAllocation.hundred())),
                        List.of(new SessionGeneratedRewardReference(
                                1L,
                                "run-77",
                                3L,
                                "Vault reward")));

        repository.insert(plan);
        SessionPlan loaded = repository.loadById(8L).orElseThrow();

        assertEquals(plan.generatedRewards(), loaded.generatedRewards());
        assertTrue(loaded.manualLootNotes().isEmpty());
        database.close();
    }

    @Test
    void attachReplaceAndDetachMutateOnlyTheSelectedSceneReference() {
        SessionPlan plan = SessionPlan.seeded(9L, List.of(31L), EncounterDays.one())
                .replaceGeneratedContent(
                        List.of(
                                new SessionEncounter(1L, 101L, new SessionEncounterAllocation(new BigDecimal("40"))),
                                new SessionEncounter(2L, 202L, new SessionEncounterAllocation(new BigDecimal("60")))),
                        List.of(
                                new SessionGeneratedRewardReference(1L, "run-9", 1L, "first reward"),
                                new SessionGeneratedRewardReference(2L, "run-9", 2L, "second reward")))
                .addManualLootNote(1L)
                .setRestPlacement(SessionRestPlacement.shortRestBetween(1L, 2L));

        SessionPlan replaced = plan.attachEncounter(1L, 303L);

        assertEquals(2, replaced.encounters().size());
        assertEquals(303L, replaced.encounters().getFirst().encounterPlanId());
        assertEquals(202L, replaced.encounters().getLast().encounterPlanId());
        assertEquals(List.of("40", "60"), replaced.encounters().stream()
                .map(scene -> scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString()).toList());
        assertEquals(plan.manualLootNotes(), replaced.manualLootNotes());
        assertEquals(plan.restPlacements(), replaced.restPlacements());
        assertEquals(List.of(2L), replaced.generatedRewards().stream()
                .map(SessionGeneratedRewardReference::sceneId).toList(),
                "generated truth for the replaced link is removed, never converted into a manual note");

        SessionPlan detached = replaced.detachEncounter(1L);

        assertEquals(2, detached.encounters().size());
        assertEquals(0L, detached.encounters().getFirst().encounterPlanId());
        assertEquals(202L, detached.encounters().getLast().encounterPlanId());
        assertEquals(replaced.manualLootNotes(), detached.manualLootNotes());
        assertEquals(replaced.restPlacements(), detached.restPlacements());
        assertEquals(replaced.generatedRewards(), detached.generatedRewards());
    }
}
