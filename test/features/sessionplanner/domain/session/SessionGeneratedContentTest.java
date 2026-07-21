package features.sessionplanner.domain.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;

final class SessionGeneratedContentTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void replacementKeepsSessionIdentityAndSeparatesGeneratedRewardsFromManualLoot() {
        SessionPlan original = SessionPlan.seeded(7L, List.of(11L, 12L), new EncounterDays(new BigDecimal("0.6")))
                .rename("Moon Vault")
                .addScene()
                .addManualLootNote(1L, "Moon key");
        List<SessionEncounter> scenes = List.of(
                new SessionEncounter(1L, 101L, new SessionEncounterAllocation(new BigDecimal("40"))),
                new SessionEncounter(2L, 102L, new SessionEncounterAllocation(new BigDecimal("60"))));
        List<SessionTreasure> rewards = List.of(
                treasure(1L, 1L, "Encounter treasure"),
                treasure(2L, 2L, "Quest reward"));

        SessionPlan replaced = original.replaceGeneratedContent(scenes, rewards);

        assertEquals(7L, replaced.sessionId());
        assertEquals("Moon Vault", replaced.displayName());
        assertEquals(List.of(11L, 12L), replaced.participantRefs());
        assertEquals(new BigDecimal("0.6"), replaced.encounterDays().value());
        assertTrue(replaced.manualLootNotes().isEmpty());
        assertEquals(List.of("Encounter treasure", "Quest reward"), replaced.treasures().stream()
                .map(SessionTreasure::title).toList());
        assertTrue(replaced.restPlacements().isEmpty());
    }

    @Test
    void editableTreasureSnapshotRoundTripsWithoutGenerationProvenance() {
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("session-generation-roundtrip.db"),
                NoopDiagnostics.INSTANCE);
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(
                        TestFeatureStores.store(
                                database, SqliteSessionPlanRepository.storeDefinition()));
        SessionPlan plan = SessionPlan.seeded(8L, List.of(21L), EncounterDays.one())
                .replaceGeneratedContent(
                        List.of(new SessionEncounter(
                                1L,
                                401L,
                                SessionEncounterAllocation.hundred())),
                        List.of(new SessionTreasure(
                                3L, 1L, "Vault reward", "Behind the altar", "OVERSTOCK", "ENCOUNTER",
                                "Sunken vault", "WONDROUS", 1234L, 2, 1,
                                List.of(new SessionTreasure.Item(
                                        7L, "MAGIC", "item:ring", "Ring", 2L, 500L, 1000L,
                                        new BigDecimal("3.5"), "chest,sack", "RARE", true)),
                                List.of(new SessionTreasure.Packing(8L, "chest", 1, "iron-chest", true)))));

        repository.insert(plan);
        SessionPlan loaded = repository.loadById(8L).orElseThrow();

        assertEquals(plan.treasures(), loaded.treasures());
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
                                treasure(1L, 1L, "first reward"),
                                treasure(2L, 2L, "second reward")))
                .addManualLootNote(1L, "First cache")
                .setRestPlacement(SessionRestPlacement.shortRestBetween(1L, 2L));

        SessionPlan replaced = plan.attachEncounter(1L, 303L);

        assertEquals(2, replaced.encounters().size());
        assertEquals(303L, replaced.encounters().getFirst().encounterPlanId());
        assertEquals(202L, replaced.encounters().getLast().encounterPlanId());
        assertEquals(List.of("40", "60"), replaced.encounters().stream()
                .map(scene -> scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString()).toList());
        assertEquals(plan.manualLootNotes(), replaced.manualLootNotes());
        assertEquals(plan.restPlacements(), replaced.restPlacements());
        assertEquals(List.of(1L, 2L), replaced.treasures().stream()
                .map(SessionTreasure::sceneId).toList(),
                "replacing an encounter link preserves generated reward references");

        SessionPlan detached = replaced.detachEncounter(1L);

        assertEquals(2, detached.encounters().size());
        assertEquals(0L, detached.encounters().getFirst().encounterPlanId());
        assertEquals(202L, detached.encounters().getLast().encounterPlanId());
        assertEquals(replaced.manualLootNotes(), detached.manualLootNotes());
        assertEquals(replaced.restPlacements(), detached.restPlacements());
        assertEquals(replaced.treasures(), detached.treasures());

        SessionPlan deleted = detached.removeEncounter(1L);
        assertEquals(List.of(2L), deleted.treasures().stream()
                .map(SessionTreasure::sceneId).toList(),
                "only deleting the owning scene prunes its generated reward references");
    }

    @Test
    void addsAnIndependentTreasureAfterMaterializedGenerationContent() {
        SessionPlan plan = SessionPlan.seeded(12L, List.of(31L), EncounterDays.one())
                .replaceGeneratedContent(
                        List.of(new SessionEncounter(1L, 101L, SessionEncounterAllocation.hundred())),
                        List.of(treasure(1L, 4L, "Generated cache")));

        SessionPlan updated = plan.addTreasure(1L);

        assertEquals(List.of(4L, 5L), updated.treasures().stream()
                .map(SessionTreasure::treasureId).toList());
        assertEquals("Neuer Schatz", updated.treasures().getLast().title());
        assertEquals(6L, updated.nextLootId());
    }

    private static SessionTreasure treasure(long sceneId, long treasureId, String title) {
        return new SessionTreasure(treasureId, sceneId, title, "", "", "", "", "",
                0L, 0, 0, List.of(), List.of());
    }
}
