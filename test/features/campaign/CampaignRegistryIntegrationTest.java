package features.campaign;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignPointerCommitResult;
import features.campaign.api.CampaignReadResult;
import features.campaign.api.CampaignRegistryApi;
import features.campaign.api.CampaignSnapshot;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;

final class CampaignRegistryIntegrationTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    @TempDir
    Path temporaryDirectory;

    @Test
    void duplicateNamesRegisterIndependentStableIdentitiesAndRemainReadable() throws Exception {
        try (RegistryRuntime runtime = open("duplicate-names.sqlite")) {
            CampaignSnapshot first = committedNew(
                    runtime.api(),
                    id(),
                    "Namesake",
                    0L);
            CampaignSnapshot second = committedNew(
                    runtime.api(),
                    id(),
                    "Namesake",
                    1L);

            assertEquals("Namesake", first.name());
            assertEquals("Namesake", second.name());
            assertNotEquals(first.id(), second.id());

            var listed = await(runtime.api().list());
            assertEquals(CampaignListResult.Status.SUCCESS, listed.status());
            assertEquals(2, listed.campaigns().size());
            assertEquals(first, found(await(runtime.api().read(first.id()))));
            assertEquals(second, found(await(runtime.api().read(second.id()))));
        }
    }

    @Test
    void committedPointerAndGenerationSurviveRegistryRestart() throws Exception {
        Path databasePath = temporaryDirectory.resolve("restart.sqlite");
        CampaignSnapshot campaign;
        try (RegistryRuntime initial = open(databasePath)) {
            var fresh = successful(await(initial.api().active()));
            assertTrue(fresh.campaign().isEmpty());
            assertEquals(0L, fresh.generation());

            campaign = committedNew(initial.api(), id(), "Restart truth", 0L);
        }

        try (RegistryRuntime restarted = open(databasePath)) {
            var resumed = successful(await(restarted.api().active()));
            assertEquals(campaign, resumed.campaign().orElseThrow());
            assertEquals(1L, resumed.generation());
        }
    }

    @Test
    void staleGenerationCannotChangeDurablePointer() throws Exception {
        try (RegistryRuntime runtime = open("stale-generation.sqlite")) {
            CampaignSnapshot first = committedNew(runtime.api(), id(), "First", 0L);
            CampaignSnapshot second = committedNew(runtime.api(), id(), "Second", 1L);

            var stale = await(runtime.api().commitActivePointer(first.id(), 1L));
            assertEquals(CampaignPointerCommitResult.Status.STALE_GENERATION, stale.status());
            assertEquals(second, stale.activation().orElseThrow().campaign().orElseThrow());
            assertEquals(2L, stale.activation().orElseThrow().generation());

            var durable = successful(await(runtime.api().active()));
            assertEquals(second, durable.campaign().orElseThrow());
            assertEquals(2L, durable.generation());
        }
    }

    @Test
    void blankNameIsRejectedWithoutRegistryRowOrPointerWrite() throws Exception {
        try (RegistryRuntime runtime = open("invalid-name.sqlite")) {
            CampaignId rejectedId = id();
            var invalid = await(runtime.api().registerAndCommitActivePointer(
                    rejectedId,
                    "  \t  ",
                    0L));

            assertEquals(CampaignPointerCommitResult.Status.INVALID_NAME, invalid.status());
            assertEquals(CampaignReadResult.Status.NOT_FOUND,
                    await(runtime.api().read(rejectedId)).status());
            assertTrue(await(runtime.api().list()).campaigns().isEmpty());
            assertEquals(0L, successful(await(runtime.api().active())).generation());
        }
    }

    @Test
    void closedDatabaseReturnsExplicitFailureWithoutPartialResult() throws Exception {
        RegistryRuntime runtime = open("closed-database.sqlite");
        try {
            runtime.database().close();

            var commit = await(runtime.api().registerAndCommitActivePointer(
                    id(),
                    "Cannot persist",
                    0L));
            var list = await(runtime.api().list());

            assertEquals(CampaignPointerCommitResult.Status.STORAGE_ERROR, commit.status());
            assertTrue(commit.activation().isEmpty());
            assertEquals(CampaignListResult.Status.STORAGE_ERROR, list.status());
            assertTrue(list.campaigns().isEmpty());
        } finally {
            runtime.close();
        }
    }

    @Test
    void pointerCommitMutationIsSubmittedBeforePersistenceRuns() throws Exception {
        Path databasePath = temporaryDirectory.resolve("scheduled-mutation.sqlite");
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        var store = database.featureStore(CampaignFeature.storeDefinition());
        assertEquals(
                FeatureStoreReadiness.READY,
                database.prepareRegisteredStores().get(store.owner()));
        QueuedLane lane = new QueuedLane();
        var api = CampaignFeature.compose(NoopDiagnostics.INSTANCE, lane, store).registry();
        try {
            CompletionStage<CampaignPointerCommitResult> pending =
                    api.registerAndCommitActivePointer(id(), "Scheduled", 0L);

            assertFalse(pending.toCompletableFuture().isDone());
            assertTrue(lane.hasWork());
            lane.runAcceptedWork();
            assertEquals(
                    CampaignPointerCommitResult.Status.COMMITTED,
                    await(pending).status());
        } finally {
            lane.close();
            database.close();
        }
    }

    @Test
    void twoConcurrentWritersProduceOneCommitAndOneDeterministicStaleResult()
            throws Exception {
        try (RegistryRuntime runtime = open("concurrent-writers.sqlite")) {
            CampaignSnapshot first = committedNew(runtime.api(), id(), "First", 0L);
            CampaignSnapshot second = committedNew(runtime.api(), id(), "Second", 1L);
            CyclicBarrier start = new CyclicBarrier(2);
            try (BarrierLane firstLane = new BarrierLane(start);
                    BarrierLane secondLane = new BarrierLane(start)) {
                CampaignRegistryApi firstWriter = CampaignFeature.compose(
                        NoopDiagnostics.INSTANCE,
                        firstLane,
                        runtime.store()).registry();
                CampaignRegistryApi secondWriter = CampaignFeature.compose(
                        NoopDiagnostics.INSTANCE,
                        secondLane,
                        runtime.store()).registry();

                var firstResult = firstWriter.commitActivePointer(first.id(), 2L);
                var secondResult = secondWriter.commitActivePointer(second.id(), 2L);
                List<CampaignPointerCommitResult> results =
                        List.of(await(firstResult), await(secondResult));

                assertEquals(
                        Set.of(
                                CampaignPointerCommitResult.Status.COMMITTED,
                                CampaignPointerCommitResult.Status.STALE_GENERATION),
                        results.stream()
                                .map(CampaignPointerCommitResult::status)
                                .collect(java.util.stream.Collectors.toSet()));
                assertTrue(results.stream().allMatch(result ->
                        result.activation().orElseThrow().generation() == 3L));
                CampaignSnapshot committed = results.stream()
                        .filter(result -> result.status()
                                == CampaignPointerCommitResult.Status.COMMITTED)
                        .findFirst()
                        .orElseThrow()
                        .activation()
                        .orElseThrow()
                        .campaign()
                        .orElseThrow();
                assertEquals(
                        committed,
                        successful(await(runtime.api().active())).campaign().orElseThrow());
            }
        }
    }

    @Test
    void commitBoundaryTriggerRollsBackNewRegistryRowAndPointerTogether() throws Exception {
        Path databasePath = temporaryDirectory.resolve("commit-boundary-fault.sqlite");
        try (RegistryRuntime runtime = open(databasePath)) {
            CampaignSnapshot original = committedNew(runtime.api(), id(), "Original", 0L);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.execute("""
                        CREATE TRIGGER campaign_registry_test_commit_fault
                        BEFORE UPDATE ON campaign_registry_activation
                        BEGIN
                            SELECT RAISE(ABORT, 'injected pointer commit failure');
                        END
                        """);
            }
            CampaignId rejectedId = id();

            var failed = await(runtime.api().registerAndCommitActivePointer(
                    rejectedId,
                    "Must roll back",
                    1L));

            assertEquals(CampaignPointerCommitResult.Status.STORAGE_ERROR, failed.status());
            assertEquals(CampaignReadResult.Status.NOT_FOUND,
                    await(runtime.api().read(rejectedId)).status());
            assertEquals(1, await(runtime.api().list()).campaigns().size());
            var durable = successful(await(runtime.api().active()));
            assertEquals(original, durable.campaign().orElseThrow());
            assertEquals(1L, durable.generation());
        }
    }

    private RegistryRuntime open(String fileName) {
        return open(temporaryDirectory.resolve(fileName));
    }

    private static RegistryRuntime open(Path databasePath) {
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        FeatureStoreHandle store = database.featureStore(CampaignFeature.storeDefinition());
        FeatureStoreReadiness readiness = database.prepareRegisteredStores().get(store.owner());
        if (readiness != FeatureStoreReadiness.READY) {
            database.close();
            throw new IllegalStateException("Campaign registry store did not prepare: " + readiness);
        }
        SerialExecutionLane lane = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        return new RegistryRuntime(
                CampaignFeature.compose(NoopDiagnostics.INSTANCE, lane, store).registry(),
                lane,
                database,
                store);
    }

    private static CampaignSnapshot committedNew(
            CampaignRegistryApi api,
            CampaignId campaignId,
            String name,
            long expectedGeneration) throws Exception {
        var result = await(api.registerAndCommitActivePointer(
                campaignId,
                name,
                expectedGeneration));
        assertEquals(CampaignPointerCommitResult.Status.COMMITTED, result.status());
        return result.activation().orElseThrow().campaign().orElseThrow();
    }

    private static CampaignSnapshot found(CampaignReadResult result) {
        assertEquals(CampaignReadResult.Status.FOUND, result.status());
        return result.campaign().orElseThrow();
    }

    private static features.campaign.api.CampaignActivation successful(
            CampaignActiveResult result) {
        assertEquals(CampaignActiveResult.Status.SUCCESS, result.status());
        return result.activation().orElseThrow();
    }

    private static CampaignId id() {
        return new CampaignId(UUID.randomUUID());
    }

    private static <T> T await(CompletionStage<T> result) throws Exception {
        return result.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private record RegistryRuntime(
            CampaignRegistryApi api,
            SerialExecutionLane lane,
            SqliteDatabase database,
            FeatureStoreHandle store) implements AutoCloseable {

        @Override
        public void close() {
            lane.close();
            database.close();
        }
    }

    private static final class QueuedLane implements ExecutionLane {

        private Runnable acceptedWork;
        private boolean closed;

        @Override
        public void execute(Runnable work) {
            if (closed) {
                throw new java.util.concurrent.RejectedExecutionException(
                        "Execution lane is closed");
            }
            if (acceptedWork != null) {
                throw new IllegalStateException("Test lane accepts one operation");
            }
            acceptedWork = work;
        }

        boolean hasWork() {
            return acceptedWork != null;
        }

        void runAcceptedWork() {
            Runnable work = acceptedWork;
            acceptedWork = null;
            work.run();
        }

        @Override
        public void close() {
            closed = true;
        }
    }

    private static final class BarrierLane implements ExecutionLane {

        private final CyclicBarrier start;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();

        private BarrierLane(CyclicBarrier start) {
            this.start = start;
        }

        @Override
        public void execute(Runnable work) {
            executor.execute(() -> {
                try {
                    start.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
                    work.run();
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(interrupted);
                } catch (java.util.concurrent.BrokenBarrierException
                        | java.util.concurrent.TimeoutException failure) {
                    throw new IllegalStateException(failure);
                }
            });
        }

        @Override
        public void close() {
            executor.shutdown();
            try {
                assertTrue(executor.awaitTermination(
                        TIMEOUT.toMillis(),
                        TimeUnit.MILLISECONDS));
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(interrupted);
            }
        }
    }
}
