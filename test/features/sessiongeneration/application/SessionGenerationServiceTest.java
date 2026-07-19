package features.sessiongeneration.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationPreparationIdentity;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.domain.catalog.GenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;
import features.sessiongeneration.domain.generation.GenerationRewardBatch;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import features.sessiongeneration.domain.generation.GenerationRunCommitResult;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import platform.execution.ExecutionLane;
import platform.execution.BoundedExecutionLane;
import platform.diagnostics.NoopDiagnostics;

final class SessionGenerationServiceTest {

    @Test
    void draftUsesIoThenCpuAndPerformsZeroRepositoryAccess() {
        QueuedLane cpu = new QueuedLane();
        QueuedLane io = new QueuedLane();
        RecordingCatalog catalog = new RecordingCatalog();
        RecordingRepository repository = new RecordingRepository();
        SessionGenerationService service = new SessionGenerationService(
                catalog, repository, new SessionGenerationEngine(), cpu, io);

        var completion = service.draft(request()).toCompletableFuture();

        assertFalse(completion.isDone());
        assertFalse(catalog.loaded);
        assertEquals(1, io.size());
        assertEquals(0, cpu.size());
        io.runNext();
        assertTrue(catalog.loaded);
        assertFalse(repository.accessed);
        assertEquals(1, cpu.size());
        cpu.runNext();
        assertEquals(GenerationStatus.SUCCESS, completion.join().status());
        assertFalse(repository.accessed);
    }

    @Test
    void commitPersistsExactSuppliedDraftSemanticValue() {
        QueuedLane cpu = new QueuedLane();
        QueuedLane io = new QueuedLane();
        RecordingRepository repository = new RecordingRepository();
        SessionGenerationService service = new SessionGenerationService(
                new RecordingCatalog(), repository, new SessionGenerationEngine(), cpu, io);

        var draftCompletion = service.draft(request()).toCompletableFuture();
        io.runNext();
        cpu.runNext();
        var draft = draftCompletion.join().draft().orElseThrow();
        var completion = service.commit(new CommitGenerationRunCommand(draft)).toCompletableFuture();
        assertFalse(completion.isDone());
        io.runNext();

        assertEquals(GenerationStatus.SUCCESS, completion.join().status());
        assertEquals(completion.join().result().orElseThrow().runId().value(), repository.committed.run().runId());
        assertEquals(repository.committed.contentFingerprint(),
                features.sessiongeneration.domain.generation.GenerationContentFingerprint.v1(
                        repository.committed.run()));
    }

    @Test
    void failedHardAuditReturnsGenerationFailureWithoutPersistence() {
        QueuedLane cpu = new QueuedLane();
        QueuedLane io = new QueuedLane();
        RecordingRepository repository = new RecordingRepository();
        SessionGenerationService service = new SessionGenerationService(
                new MissingCandidateCatalog(), repository, new SessionGenerationEngine(), cpu, io);

        var completion = service.draft(new GenerationRequest(
                new GenerationPreparationIdentity("preparation:test:failure"),
                List.of(new GenerationRequest.PartyLevel(3, 4)),
                new BigDecimal("0.6"), OptionalInt.of(3), 7L)).toCompletableFuture();
        io.runNext();
        cpu.runNext();

        assertEquals(GenerationStatus.GENERATION_FAILURE, completion.join().status());
        assertFalse(repository.accessed);
    }

    @Test
    void loadFailureCompletesOnIoLaneWithStorageFailure() {
        QueuedLane cpu = new QueuedLane();
        QueuedLane io = new QueuedLane();
        SessionGenerationService service = new SessionGenerationService(
                new RecordingCatalog(), new ThrowingRepository(), new SessionGenerationEngine(), cpu, io);

        var completion = service.load(new GenerationRunId("broken-run")).toCompletableFuture();
        assertEquals(0, cpu.size());
        io.runNext();

        assertTrue(completion.isDone());
        assertEquals(GenerationStatus.STORAGE_FAILURE, completion.join().status());
    }

    @Test
    void catalogAndPersistenceUseIoWhilePureDraftCompletionUsesCpu() {
        AtomicReference<String> catalogThread = new AtomicReference<>();
        AtomicReference<String> draftThread = new AtomicReference<>();
        RecordingRepository repository = new RecordingRepository();
        GenerationCatalog catalog = () -> {
            catalogThread.set(Thread.currentThread().getName());
            return new features.sessiongeneration.adapter.resource.TsvGenerationCatalog().load();
        };
        try (BoundedExecutionLane cpu = new BoundedExecutionLane(
                        NoopDiagnostics.INSTANCE, "session-generation-cpu-test", 2);
                BoundedExecutionLane io = new BoundedExecutionLane(
                        NoopDiagnostics.INSTANCE, "session-generation-io-test", 2)) {
            SessionGenerationService service = new SessionGenerationService(
                    catalog, repository, new SessionGenerationEngine(), cpu, io);
            var drafted = service.draft(request()).thenApply(response -> {
                draftThread.set(Thread.currentThread().getName());
                return response.draft().orElseThrow();
            }).toCompletableFuture().join();
            service.commit(new CommitGenerationRunCommand(drafted)).toCompletableFuture().join();
        }

        assertTrue(catalogThread.get().startsWith("session-generation-io-test-"));
        assertTrue(draftThread.get().startsWith("session-generation-cpu-test-"));
        assertTrue(repository.commitThread.startsWith("session-generation-io-test-"));
    }

    @Test
    void runIdentityUsesPreparationEngineAndCatalogContentNotCatalogLabel() {
        var catalog = new features.sessiongeneration.adapter.resource.TsvGenerationCatalog().load();
        var generated = new SessionGenerationEngine().generate(
                new features.sessiongeneration.domain.generation.GenerationInput(
                        List.of(new features.sessiongeneration.domain.generation.GeneratedRun.PartyLevel(3, 4)),
                        new BigDecimal("0.6"), OptionalInt.of(3), 179974L),
                catalog);
        var relabeled = new features.sessiongeneration.domain.generation.GeneratedRun(
                generated.runId(), generated.engineVersion(), "label-only-change", generated.catalogContentHash(),
                generated.seed(), generated.party(), generated.session(), generated.encounterTargets(),
                generated.encounters(), generated.treasures(), generated.loot(), generated.packing(),
                generated.rewards(), generated.formattedText(), generated.audits());
        GenerationPreparationIdentity preparation = new GenerationPreparationIdentity("preparation:stable-id");

        assertEquals(
                GenerationRunIdentity.assign(preparation, generated),
                GenerationRunIdentity.assign(preparation, relabeled));
    }

    private static GenerationRequest request() {
        return new GenerationRequest(
                new GenerationPreparationIdentity("preparation:test:canonical"),
                List.of(new GenerationRequest.PartyLevel(3, 2), new GenerationRequest.PartyLevel(4, 2)),
                new BigDecimal("0.6"), OptionalInt.of(3), 179974L);
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
        private boolean accessed;
        private GeneratedRunDraft committed;
        private String commitThread;

        @Override
        public GenerationRunCommitResult commit(GeneratedRunDraft draft) {
            accessed = true;
            committed = draft;
            commitThread = Thread.currentThread().getName();
            return new GenerationRunCommitResult(draft, GenerationRunCommitResult.Outcome.INSERTED);
        }

        @Override
        public Optional<GeneratedRunDraft> load(String runId) {
            accessed = true;
            return Optional.empty();
        }

        @Override
        public GenerationRewardBatch loadRewards(List<GenerationRewardReference> references) {
            accessed = true;
            return new GenerationRewardBatch(List.of(), references);
        }
    }

    private static final class ThrowingRepository implements GenerationRunRepository {

        @Override
        public GenerationRunCommitResult commit(GeneratedRunDraft draft) {
            throw new IllegalArgumentException("malformed stored aggregate");
        }

        @Override
        public Optional<GeneratedRunDraft> load(String runId) {
            throw new IllegalArgumentException("malformed stored aggregate");
        }

        @Override
        public GenerationRewardBatch loadRewards(List<GenerationRewardReference> references) {
            throw new IllegalArgumentException("malformed stored aggregate");
        }
    }

    private static final class QueuedLane implements ExecutionLane {
        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        int size() {
            return work.size();
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
        }
    }
}
