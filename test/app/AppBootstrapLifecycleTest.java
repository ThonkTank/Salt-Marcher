package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

final class AppBootstrapLifecycleTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void bootstrapClosesAllOwnedGenerationLanesExactlyOnce() {
        RecordingLane shared = new RecordingLane();
        RecordingLane startup = new RecordingLane();
        RecordingLane creatureRead = new RecordingLane();
        RecordingLane itemRead = new RecordingLane();
        RecordingLane generationCpu = new RecordingLane();
        RecordingLane generationIo = new RecordingLane();
        RecordingLane encounterCpu = new RecordingLane();
        RecordingLane encounterIo = new RecordingLane();
        RecordingLane preparationCpu = new RecordingLane();
        RecordingLane preparationIo = new RecordingLane();
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                startup,
                shared,
                creatureRead,
                itemRead,
                generationCpu,
                generationIo,
                encounterCpu,
                encounterIo,
                preparationCpu,
                preparationIo,
                DirectUiDispatcher.INSTANCE,
                new SqliteDatabase(temporaryDirectory.resolve("lifecycle.sqlite"), NoopDiagnostics.INSTANCE));

        bootstrap.close();
        bootstrap.close();

        assertEquals(1, generationCpu.closes);
        assertEquals(1, generationIo.closes);
        assertEquals(1, encounterCpu.closes);
        assertEquals(1, encounterIo.closes);
        assertEquals(1, preparationCpu.closes);
        assertEquals(1, preparationIo.closes);
        assertEquals(1, creatureRead.closes);
        assertEquals(1, itemRead.closes);
        assertEquals(1, shared.closes);
        assertEquals(1, startup.closes);
    }

    @Test
    void closeDrainsBlockedStartupBeforeResolvingAndClosesAcquiredResourcesExactlyOnce()
            throws Exception {
        GateStartupLane startup = new GateStartupLane();
        RecordingLane shared = new RecordingLane();
        RecordingLane creatureRead = new RecordingLane();
        RecordingLane itemRead = new RecordingLane();
        RecordingLane generationCpu = new RecordingLane();
        RecordingLane generationIo = new RecordingLane();
        RecordingLane encounterCpu = new RecordingLane();
        RecordingLane encounterIo = new RecordingLane();
        RecordingLane preparationCpu = new RecordingLane();
        RecordingLane preparationIo = new RecordingLane();
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("blocked-close.sqlite"), NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE, startup, shared, creatureRead, itemRead,
                generationCpu, generationIo, encounterCpu, encounterIo,
                preparationCpu, preparationIo, DirectUiDispatcher.INSTANCE, database);

        var shell = bootstrap.createShellAsync().toCompletableFuture();
        assertTrue(startup.blocked.await(5, java.util.concurrent.TimeUnit.SECONDS));
        var closeCall = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        assertFalse(bootstrap.termination().toCompletableFuture().isDone());
        startup.release.countDown();

        closeCall.get(5, java.util.concurrent.TimeUnit.SECONDS);
        bootstrap.termination().toCompletableFuture().get(5, java.util.concurrent.TimeUnit.SECONDS);
        assertTrue(shell.isCompletedExceptionally());
        assertEquals(1, startup.closes);
        for (RecordingLane lane : java.util.List.of(
                shared, creatureRead, itemRead, generationCpu, generationIo,
                encounterCpu, encounterIo, preparationCpu, preparationIo)) {
            assertEquals(1, lane.closes);
        }
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void cleanupAggregatesStartupFailureAndStillClosesEveryDelegateAndDatabase() {
        ThrowingCloseLane startup = new ThrowingCloseLane("startup");
        RecordingLane shared = new RecordingLane();
        RecordingLane creatureRead = new RecordingLane();
        ThrowingCloseLane itemRead = new ThrowingCloseLane("item-read");
        RecordingLane generationCpu = new RecordingLane();
        RecordingLane generationIo = new RecordingLane();
        RecordingLane encounterCpu = new RecordingLane();
        RecordingLane encounterIo = new RecordingLane();
        RecordingLane preparationCpu = new RecordingLane();
        RecordingLane preparationIo = new RecordingLane();
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("cleanup-failure.sqlite"), NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE, startup, shared, creatureRead, itemRead,
                generationCpu, generationIo, encounterCpu, encounterIo,
                preparationCpu, preparationIo, DirectUiDispatcher.INSTANCE, database);

        java.util.concurrent.CompletionException thrown = assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);

        assertTrue(thrown.getCause().getSuppressed().length >= 1);
        assertEquals(1, ((RecordingLane) startup).closes);
        for (RecordingLane lane : java.util.List.of(
                shared, creatureRead, itemRead, generationCpu, generationIo,
                encounterCpu, encounterIo, preparationCpu, preparationIo)) {
            assertEquals(1, lane.closes);
        }
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void trackedDispatchRejectionBeforeComposeClosesRuntimeAndDatabase() {
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dispatch-rejected.sqlite"), NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = directBootstrap(new TrackedDispatcher(TrackedMode.REJECT), database);

        var shell = bootstrap.createShellAsync().toCompletableFuture();

        assertThrows(java.util.concurrent.CompletionException.class, shell::join);
        bootstrap.close();
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void acceptedButNeverExecutedComposeIsCancelledAndSettledByClose() {
        TrackedDispatcher dispatcher = new TrackedDispatcher(TrackedMode.QUEUE);
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dispatch-dropped.sqlite"), NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = directBootstrap(dispatcher, database);
        var shell = bootstrap.createShellAsync().toCompletableFuture();
        dispatcher.trackedAccepted.join();

        assertFalse(shell.isDone());
        bootstrap.close();

        assertTrue(shell.isCompletedExceptionally());
        assertTrue(bootstrap.termination().toCompletableFuture().isDone());
        dispatcher.runQueued();
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void closeWaitsForRunningPreComposeCallbackBeforeClosingOwnedRuntime() throws Exception {
        TrackedDispatcher dispatcher = new TrackedDispatcher(TrackedMode.ASYNC);
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dispatch-running.sqlite"), NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = directBootstrap(dispatcher, database);
        java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        bootstrap.installPreComposeGateForTesting(() -> {
            entered.countDown();
            try {
                release.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError(failure);
            }
        });
        var shell = bootstrap.createShellAsync().toCompletableFuture();
        entered.await();

        var close = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        while (!bootstrap.preparatoryUiRevokedForTesting()) {
            Thread.onSpinWait();
        }
        assertFalse(bootstrap.closeClaimedForTesting());
        assertFalse(close.isDone());
        assertFalse(bootstrap.termination().toCompletableFuture().isDone());
        release.countDown();

        close.join();
        assertTrue(shell.isCompletedExceptionally());
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    private static AppBootstrap directBootstrap(UiDispatcher dispatcher, SqliteDatabase database) {
        return new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
    }

    private enum TrackedMode { REJECT, QUEUE, ASYNC }

    private static final class TrackedDispatcher implements UiDispatcher {
        private final TrackedMode mode;
        private final java.util.ArrayDeque<Runnable> queued = new java.util.ArrayDeque<>();
        private final java.util.concurrent.CompletableFuture<Void> trackedAccepted =
                new java.util.concurrent.CompletableFuture<>();

        private TrackedDispatcher(TrackedMode mode) {
            this.mode = mode;
        }

        @Override
        public synchronized void dispatch(Runnable update) {
            if (!isTrackedSubmission()) {
                update.run();
                return;
            }
            trackedAccepted.complete(null);
            switch (mode) {
                case REJECT -> throw new IllegalStateException("tracked dispatch rejected");
                case QUEUE -> queued.addLast(update);
                case ASYNC -> {
                    Thread worker = new Thread(update, "tracked-bootstrap-ui-test");
                    worker.setDaemon(true);
                    worker.start();
                }
            }
        }

        synchronized void runQueued() {
            while (!queued.isEmpty()) {
                queued.removeFirst().run();
            }
        }

        private static boolean isTrackedSubmission() {
            return StackWalker.getInstance().walk(frames -> frames.anyMatch(frame ->
                    frame.getClassName().equals(RevocableUiDispatcher.class.getName())
                            && frame.getMethodName().equals("dispatchTracked")));
        }
    }

    private static class RecordingLane implements ExecutionLane {
        private int closes;

        @Override
        public void execute(Runnable work) {
            work.run();
        }

        @Override
        public void close() {
            closes++;
        }
    }

    private static final class ThrowingCloseLane extends RecordingLane {
        private final String name;

        private ThrowingCloseLane(String name) {
            this.name = name;
        }

        @Override
        public void close() {
            super.close();
            throw new IllegalStateException("injected " + name + " close failure");
        }
    }

    private static final class GateStartupLane implements ExecutionLane {
        private final java.util.concurrent.CountDownLatch blocked = new java.util.concurrent.CountDownLatch(1);
        private final java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        private final java.util.concurrent.ExecutorService executor =
                java.util.concurrent.Executors.newSingleThreadExecutor();
        private int closes;

        @Override
        public void execute(Runnable work) {
            executor.execute(() -> {
                blocked.countDown();
                try {
                    release.await();
                    work.run();
                } catch (InterruptedException failure) {
                    Thread.currentThread().interrupt();
                }
            });
        }

        @Override
        public void close() {
            closes++;
            executor.shutdown();
            try {
                assertTrue(executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS));
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError(failure);
            }
        }
    }
}
