package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.BoundedExecutionLane;
import platform.execution.ExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import platform.ui.TrackedUiDispatcher;

final class CampaignRuntimeLifecycleTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    @TempDir
    Path temporaryDirectory;
    private final java.util.List<InstallationRuntime> installations = new java.util.ArrayList<>();

    @AfterEach
    void closeInstallations() {
        installations.forEach(InstallationRuntime::close);
        installations.clear();
    }

    @Test
    void foundationReadinessCoversProductionStoresAndUsablePrimaryScene() throws Exception {
        Path databasePath = temporaryDirectory.resolve("campaign-runtime-ready.sqlite");
        CampaignRuntime runtime = open(databasePath, DirectExecutionLane.INSTANCE);
        try {
            CampaignRuntime.FoundationReadiness readiness = await(runtime.foundationReadiness());

            assertTrue(
                    readiness.foundationPrepared(),
                    () -> "runtime foundation readiness=" + readiness);
            assertTrue(readiness.encounterInitialized());
            assertTrue(readiness.persistenceWriteRollbackVerified());
            assertEquals(expectedOwners(), readiness.stores().keySet());
            assertTrue(readiness.stores().values().stream()
                    .allMatch(FeatureStoreReadiness.READY::equals));
            assertEquals(CampaignRuntime.State.FOUNDATION_PREPARED, runtime.state());
            assertEquals(1, runtime.components().scene().model().current().scenes().size());
            assertTrue(runtime.components().scene().model().current().focusedSceneId() > 0L);
        } finally {
            runtime.close();
        }

        assertEquals(CampaignRuntime.State.CLOSED, runtime.state());
        assertTrue(runtime.quiescence().toCompletableFuture().isDone());
        assertThrows(IllegalStateException.class, runtime::components);
    }

    @Test
    void preparedRuntimeRejectsMutationAndClosedRuntimeRemainsTerminalWithoutDurableWrite() throws Exception {
        Path databasePath = temporaryDirectory.resolve("campaign-runtime-quiescence.sqlite");
        SerialExecutionLane mutationLane = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        CampaignRuntime runtime = open(databasePath, mutationLane);
        await(runtime.foundationReadiness());
        CampaignRuntime.Components components = runtime.components();

        var rejectedWhilePrepared = components.scene().application().execute(
                new SceneCommand.Create("Vor Aktivierung abgelehnt"));
        runtime.quiesce();

        assertEquals(SceneMutationResult.Status.STORAGE_ERROR, await(rejectedWhilePrepared).status());
        assertEquals(CampaignRuntime.State.CLOSED, runtime.state());
        assertTrue(runtime.quiescence().toCompletableFuture().isDone());
        assertEquals(
                SceneMutationResult.Status.STORAGE_ERROR,
                await(components.scene().application().execute(
                        new SceneCommand.Create("Nach Close abgelehnt"))).status());

        try (CampaignRuntime reopened = open(databasePath, DirectExecutionLane.INSTANCE)) {
            assertTrue(await(reopened.foundationReadiness()).foundationPrepared());
            assertFalse(reopened.components().scene().model().current().scenes().stream()
                    .anyMatch(scene -> "Vor Aktivierung abgelehnt".equals(scene.title())));
            assertFalse(reopened.components().scene().model().current().scenes().stream()
                    .anyMatch(scene -> "Nach Close abgelehnt".equals(scene.title())));
        }
    }

    @Test
    void lastBoundedWorkerCanFinishWorkflowBeforeIndependentClosureClosesItsLane() throws Exception {
        Path databasePath = temporaryDirectory.resolve("bounded-last-task-close.sqlite");
        BoundedExecutionLane mutationLane = new BoundedExecutionLane(
                NoopDiagnostics.INSTANCE, "bounded-close-proof", 1);
        CampaignRuntime runtime = open(databasePath, mutationLane);
        var terminated = runtime.quiesceAsync();

        await(terminated);
        assertEquals(CampaignRuntime.State.CLOSED, runtime.state());
        assertTrue(runtime.closureWorkerDaemonForTesting());
    }

    @Test
    void closeBeforeFoundationReadyCompletesBothTerminalStagesExceptionallyDespiteCallbackRace()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("close-before-ready.sqlite");
        ManualExecutionLane mutationLane = new ManualExecutionLane();
        CampaignRuntime runtime = open(databasePath, mutationLane);
        assertFalse(runtime.foundationReadiness().toCompletableFuture().isDone());
        assertFalse(runtime.preparedReadiness().toCompletableFuture().isDone());

        var terminated = runtime.quiesceAsync();
        assertThrows(java.util.concurrent.ExecutionException.class,
                () -> runtime.foundationReadiness().toCompletableFuture().get());
        assertThrows(java.util.concurrent.ExecutionException.class,
                () -> runtime.preparedReadiness().toCompletableFuture().get());

        mutationLane.drain();
        await(terminated);
        assertEquals(CampaignRuntime.State.CLOSED, runtime.state());
        assertTrue(runtime.foundationReadiness().toCompletableFuture().isCompletedExceptionally());
        assertTrue(runtime.preparedReadiness().toCompletableFuture().isCompletedExceptionally());
    }

    @Test
    void unavailableStorePublishesNoRuntimeAndClosesEveryOwnedResource() throws Exception {
        Path databasePath = temporaryDirectory.resolve("campaign-runtime-unavailable.sqlite");
        try (CampaignRuntime initial = open(databasePath, DirectExecutionLane.INSTANCE)) {
            assertTrue(await(initial.foundationReadiness()).foundationPrepared());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "UPDATE sm_schema_versions SET version = 999 WHERE owner = 'scene'")) {
            assertEquals(1, statement.executeUpdate());
        }

        RecordingLane execution = new RecordingLane();
        List<RecordingLane> supporting = java.util.stream.IntStream.range(0, 8)
                .mapToObj(ignored -> new RecordingLane())
                .toList();
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);

        CampaignRuntime.StorePreparationException failure = assertThrows(
                CampaignRuntime.StorePreparationException.class,
                () -> CampaignRuntime.open(
                        NoopDiagnostics.INSTANCE,
                        execution,
                        supporting.get(6),
                        supporting.get(7),
                        supporting.get(0),
                        supporting.get(1),
                        supporting.get(2),
                        supporting.get(3),
                        supporting.get(4),
                        supporting.get(5),
                        DirectUiDispatcher.INSTANCE,
                        installationFor(databasePath).references(),
                        database));

        assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, failure.readiness().get("scene"));
        assertEquals(1, execution.closes);
        assertTrue(supporting.stream().allMatch(lane -> lane.closes == 1));
        assertThrows(SQLException.class, database::prepare);
    }

    @Test
    void supportingStoreFailureDegradesWithoutBlockingCampaignCore() throws Exception {
        for (String owner : List.of("dungeon", "hex", "session-generation")) {
            Path databasePath = temporaryDirectory.resolve(owner + "-degraded.sqlite");
            try (CampaignRuntime initial = open(databasePath, DirectExecutionLane.INSTANCE)) {
                assertTrue(await(initial.foundationReadiness()).foundationPrepared());
            }
            setStoreVersion(databasePath, owner, 999);

            try (CampaignRuntime degraded = open(databasePath, DirectExecutionLane.INSTANCE)) {
                CampaignRuntime.FoundationReadiness readiness = await(
                        degraded.foundationReadiness(), owner + " degradation");
                assertTrue(readiness.foundationPrepared(), () -> owner + " blocked core: " + readiness);
                assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, readiness.degradedStores().get(owner));
                assertFalse(readiness.coreRequiredStores().contains(owner));
                assertEquals(CampaignRuntime.State.FOUNDATION_PREPARED, degraded.state());
                assertTrue(degraded.components().scene().model().current().focusedSceneId() > 0L);
            }
        }
    }

    @Test
    void coreRequiredStoreFailureStillRejectsRuntime() throws Exception {
        Path databasePath = temporaryDirectory.resolve("core-unavailable.sqlite");
        try (CampaignRuntime initial = open(databasePath, DirectExecutionLane.INSTANCE)) {
            assertTrue(await(initial.foundationReadiness()).foundationPrepared());
        }
        setStoreVersion(databasePath, "scene", 999);

        CampaignRuntime.StorePreparationException failure = assertThrows(
                CampaignRuntime.StorePreparationException.class,
                () -> open(databasePath, DirectExecutionLane.INSTANCE));
        assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, failure.readiness().get("scene"));
    }

    @Test
    void closeUnsubscribesForeignCallbacksBeforeClosingMutationLane() throws Exception {
        Path databasePath = temporaryDirectory.resolve("subscription-close.sqlite");
        SerialExecutionLane mutationLane = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        QueuedUiDispatcher ui = new QueuedUiDispatcher();
        CampaignRuntime runtime = CampaignRuntime.open(
                NoopDiagnostics.INSTANCE,
                mutationLane,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                ui,
                installationFor(databasePath).references(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE));
        ui.flushUntil(runtime.foundationReadiness());
        await(runtime.foundationReadiness());

        var closed = runtime.quiesceAsync();
        ui.flushUntil(closed);
        await(closed);

        assertEquals(CampaignRuntime.State.CLOSED, runtime.state());
    }

    private static void setStoreVersion(Path databasePath, String owner, int version) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "UPDATE sm_schema_versions SET version = ? WHERE owner = ?")) {
            statement.setInt(1, version);
            statement.setString(2, owner);
            assertEquals(1, statement.executeUpdate());
        }
    }

    private CampaignRuntime open(Path databasePath, ExecutionLane mutationLane) {
        return CampaignRuntime.open(
                NoopDiagnostics.INSTANCE,
                mutationLane,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                installationFor(databasePath).references(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE));
    }

    private InstallationRuntime installationFor(Path campaignDatabasePath) {
        InstallationRuntime installation = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE,
                new SqliteDatabase(
                        campaignDatabasePath.resolveSibling(
                                campaignDatabasePath.getFileName() + ".installation.sqlite"),
                        NoopDiagnostics.INSTANCE));
        installations.add(installation);
        return installation;
    }

    private static Set<String> expectedOwners() {
        return Set.of(
                "dungeon",
                "encounter",
                "encounter-table",
                "hex",
                "party",
                "scene",
                "session-generation",
                "session-planner",
                "world-planner");
    }

    private static <T> T await(java.util.concurrent.CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static <T> T await(
            java.util.concurrent.CompletionStage<T> stage,
            String context
    ) throws Exception {
        try {
            return await(stage);
        } catch (java.util.concurrent.TimeoutException failure) {
            throw new AssertionError(context + " did not complete", failure);
        }
    }

    private static final class RecordingLane implements ExecutionLane {
        private int closes;

        @Override
        public void execute(Runnable work) {
            throw new AssertionError("Unavailable storage must prevent component startup");
        }

        @Override
        public void close() {
            closes++;
        }
    }

    private static final class QueuedUiDispatcher implements TrackedUiDispatcher {

        private final java.util.ArrayDeque<TrackedUpdate> updates = new java.util.ArrayDeque<>();
        private final java.util.concurrent.Semaphore accepted = new java.util.concurrent.Semaphore(0);

        @Override
        public synchronized void dispatch(Runnable update) {
            dispatchTracked(update);
        }

        @Override
        public synchronized java.util.concurrent.CompletionStage<Void> dispatchTracked(Runnable update) {
            return dispatchTracked(update, failure -> { });
        }

        @Override
        public synchronized java.util.concurrent.CompletionStage<Void> dispatchTracked(
                Runnable update,
                java.util.function.Consumer<Throwable> terminalHandler
        ) {
            CompletableFuture<Void> completion = new CompletableFuture<>();
            updates.addLast(new TrackedUpdate(update, terminalHandler, completion));
            accepted.release();
            return completion;
        }

        private void flushUntil(java.util.concurrent.CompletionStage<?> stage) {
            stage.whenComplete((ignored, failure) -> accepted.release());
            while (!stage.toCompletableFuture().isDone()) {
                try {
                    if (!accepted.tryAcquire(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                        throw new AssertionError("tracked UI did not reach a terminal callback");
                    }
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(interrupted);
                }
                TrackedUpdate update;
                synchronized (this) {
                    update = updates.pollFirst();
                }
                if (update == null) {
                    continue;
                }
                try {
                    update.update().run();
                    update.terminalHandler().accept(null);
                    update.completion().complete(null);
                } catch (RuntimeException | Error failure) {
                    update.terminalHandler().accept(failure);
                    update.completion().completeExceptionally(failure);
                    throw failure;
                }
            }
        }

        private record TrackedUpdate(
                Runnable update,
                java.util.function.Consumer<Throwable> terminalHandler,
                CompletableFuture<Void> completion
        ) { }
    }

    private static final class ManualExecutionLane implements ExecutionLane {
        private final java.util.ArrayDeque<Runnable> work = new java.util.ArrayDeque<>();

        @Override
        public synchronized void execute(Runnable next) {
            work.addLast(next);
        }

        private void drain() {
            while (true) {
                Runnable next;
                synchronized (this) {
                    next = work.pollFirst();
                }
                if (next == null) {
                    return;
                }
                next.run();
            }
        }

        @Override
        public void close() {
        }
    }
}
