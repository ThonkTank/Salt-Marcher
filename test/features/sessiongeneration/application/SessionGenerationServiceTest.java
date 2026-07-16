package features.sessiongeneration.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.domain.catalog.GenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;
import platform.execution.ExecutionLane;

final class SessionGenerationServiceTest {

    @Test
    void generateDoesNoCatalogOrPersistenceWorkOnCallerThread() {
        QueuedLane lane = new QueuedLane();
        RecordingCatalog catalog = new RecordingCatalog();
        RecordingRepository repository = new RecordingRepository();
        SessionGenerationService service = new SessionGenerationService(
                catalog, repository, new SessionGenerationEngine(), lane);

        var completion = service.generate(new GenerationRequest(
                List.of(new GenerationRequest.PartyLevel(3, 2), new GenerationRequest.PartyLevel(4, 2)),
                new BigDecimal("0.6"), OptionalInt.of(3), 179974L)).toCompletableFuture();

        assertFalse(completion.isDone());
        assertFalse(catalog.loaded);
        assertFalse(repository.saved);
        lane.runNext();
        assertTrue(completion.isDone());
        assertTrue(catalog.loaded);
        assertTrue(repository.saved);
        assertTrue(completion.join().status() == GenerationStatus.SUCCESS);
    }

    @Test
    void failedHardAuditReturnsGenerationFailureWithoutPersistence() {
        QueuedLane lane = new QueuedLane();
        RecordingRepository repository = new RecordingRepository();
        SessionGenerationService service = new SessionGenerationService(
                new MissingCandidateCatalog(), repository, new SessionGenerationEngine(), lane);

        var completion = service.generate(new GenerationRequest(
                List.of(new GenerationRequest.PartyLevel(3, 4)),
                new BigDecimal("0.6"), OptionalInt.of(3), 7L)).toCompletableFuture();
        lane.runNext();

        assertEquals(GenerationStatus.GENERATION_FAILURE, completion.join().status());
        assertFalse(repository.saved);
    }

    @Test
    void unexpectedOperationFailureAlwaysCompletesWithStorageFailure() {
        QueuedLane lane = new QueuedLane();
        SessionGenerationService service = new SessionGenerationService(
                new RecordingCatalog(), new ThrowingRepository(), new SessionGenerationEngine(), lane);

        var completion = service.load(new GenerationRunId("broken-run")).toCompletableFuture();
        lane.runNext();

        assertTrue(completion.isDone());
        assertEquals(GenerationStatus.STORAGE_FAILURE, completion.join().status());
    }

    private static final class RecordingCatalog implements GenerationCatalog {
        private boolean loaded;

        @Override
        public CatalogSnapshot load() {
            loaded = true;
            return new features.sessiongeneration.adapter.resource.TsvGenerationCatalog().load();
        }
    }

    private static final class MissingCandidateCatalog implements GenerationCatalog {

        @Override
        public CatalogSnapshot load() {
            CatalogSnapshot source = new features.sessiongeneration.adapter.resource.TsvGenerationCatalog().load();
            return new CatalogSnapshot(
                    source.version(), source.contentHash(), source.progression(), source.challengeRanks(),
                    List.of(), source.patterns(), source.loot(), source.lootModifiers(), source.lootRelations(),
                    source.themes(), source.magic(), source.variants(), source.spells(), source.containers(),
                    source.enspelledRules(), source.curses());
        }
    }

    private static final class RecordingRepository implements GenerationRunRepository {
        private boolean saved;

        @Override
        public GeneratedRun save(GeneratedRun run) {
            saved = true;
            return run;
        }

        @Override
        public Optional<GeneratedRun> load(String runId) {
            return Optional.empty();
        }
    }

    private static final class ThrowingRepository implements GenerationRunRepository {

        @Override
        public GeneratedRun save(GeneratedRun run) {
            throw new IllegalArgumentException("malformed stored aggregate");
        }

        @Override
        public Optional<GeneratedRun> load(String runId) {
            throw new IllegalArgumentException("malformed stored aggregate");
        }
    }

    private static final class QueuedLane implements ExecutionLane {
        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
        }
    }
}
