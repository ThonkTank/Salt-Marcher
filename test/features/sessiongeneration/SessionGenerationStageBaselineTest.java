package features.sessiongeneration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.adapter.sqlite.persistence.SqliteGenerationRunRepository;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;
import features.sessiongeneration.domain.generation.GenerationInput;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.math.BigDecimal;
import java.util.List;
import java.util.OptionalInt;

final class SessionGenerationStageBaselineTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void baselineCatalogLoadProductionResourceScenario() {
        var snapshot = new TsvGenerationCatalog().load();

        assertEquals("catalog-2026-07-16", snapshot.version());
        assertEquals("10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                snapshot.contentHash());
    }

    @Test
    void baselinePureEngineGoldenScenario() {
        GeneratedRun generated = generate();

        assertEquals(List.of(680L, 1000L, 1800L), generated.encounterTargets().stream()
                .map(GeneratedRun.EncounterTarget::targetXp).toList());
    }

    @Test
    void baselinePersistenceCommitAndCanonicalLoadScenario() {
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate());
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("commit-load.sqlite"), NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));

            repository.commit(draft);

            assertEquals(draft, repository.load(draft.run().runId()).orElseThrow());
        }
    }

    @Test
    void baselineStructuredRewardBatchReadScenario() {
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate());
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("reward-read.sqlite"), NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
            repository.commit(draft);

            var batch = repository.loadRewards(List.of(
                    new GenerationRewardReference(draft.run().runId(), draft.run().treasures().getFirst().treasureId())));

            assertEquals(1, batch.resolved().size());
            assertFalse(batch.resolved().getFirst().loot().isEmpty());
            assertEquals(List.of(), batch.missing());
        }
    }

    private static GeneratedRun generate() {
        return new SessionGenerationEngine().generate(
                new GenerationInput(
                        List.of(new GeneratedRun.PartyLevel(3, 2), new GeneratedRun.PartyLevel(4, 2)),
                        new BigDecimal("0.6"), OptionalInt.of(3), 179974L),
                new TsvGenerationCatalog().load());
    }
}
