package app;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

final class RevocableUiDispatcherTest {

    @Test
    void ordinaryDispatchPreservesDirectCallbackFailureWhileTrackedDispatchReportsIt() {
        RevocableUiDispatcher dispatcher = new RevocableUiDispatcher(DirectUiDispatcher.INSTANCE);

        assertThrows(IllegalStateException.class,
                () -> dispatcher.dispatch(() -> { throw new IllegalStateException("ordinary"); }));
        assertTrue(dispatcher.dispatchTracked(
                () -> { throw new IllegalStateException("tracked"); })
                .toCompletableFuture().isCompletedExceptionally());
    }

    @Test
    void delegateRejectionCompletesTrackedDispatchExceptionally() {
        RevocableUiDispatcher dispatcher = new RevocableUiDispatcher(
                update -> { throw new IllegalStateException("delegate rejected"); });

        assertTrue(dispatcher.dispatchTracked(() -> { })
                .toCompletableFuture().isCompletedExceptionally());
    }

    @Test
    void revokeCancelsQueuedWorkAndDrainsOnlyAfterRunningWorkReturns() throws Exception {
        QueuedDispatcher delegate = new QueuedDispatcher();
        RevocableUiDispatcher dispatcher = new RevocableUiDispatcher(delegate);
        CountDownLatch running = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        var runningStage = dispatcher.dispatchTracked(() -> {
            running.countDown();
            await(release);
        }).toCompletableFuture();
        var cancelledStage = dispatcher.dispatchTracked(() -> {
            throw new AssertionError("cancelled callback executed");
        }).toCompletableFuture();
        Thread worker = new Thread(delegate.remove(), "tracked-ui-test-worker");
        worker.start();
        running.await();

        var drain = dispatcher.revokeAndDrain().toCompletableFuture();

        assertFalse(drain.isDone());
        assertTrue(cancelledStage.isCompletedExceptionally());
        delegate.remove().run();
        assertFalse(drain.isDone());
        release.countDown();
        worker.join();
        drain.join();
        runningStage.join();
    }

    @Test
    void cancellationHandlerIsInstalledBeforeDelegateReturnGapAndRunsBeforeDrain() throws Exception {
        BlockingReturnDispatcher delegate = new BlockingReturnDispatcher();
        RevocableUiDispatcher dispatcher = new RevocableUiDispatcher(delegate);
        AtomicBoolean handlerRan = new AtomicBoolean();
        AtomicReference<java.util.concurrent.CompletionStage<Void>> observer = new AtomicReference<>();
        Thread submitter = new Thread(() -> observer.set(dispatcher.dispatchTracked(
                () -> { throw new AssertionError("cancelled callback executed"); },
                failure -> handlerRan.set(failure != null))), "tracked-submit-gap");
        submitter.start();
        delegate.accepted.await();

        var drain = dispatcher.revokeAndDrain().toCompletableFuture();

        assertTrue(handlerRan.get());
        assertTrue(drain.isDone());
        delegate.releaseReturn.countDown();
        submitter.join();
        assertTrue(observer.get().toCompletableFuture().isCompletedExceptionally());
        delegate.acceptedUpdate.run();
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new AssertionError(failure);
        }
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final ArrayDeque<Runnable> queued = new ArrayDeque<>();

        @Override
        public synchronized void dispatch(Runnable update) {
            queued.addLast(update);
        }

        synchronized Runnable remove() {
            return queued.removeFirst();
        }
    }

    private static final class BlockingReturnDispatcher implements UiDispatcher {
        private final CountDownLatch accepted = new CountDownLatch(1);
        private final CountDownLatch releaseReturn = new CountDownLatch(1);
        private volatile Runnable acceptedUpdate;

        @Override
        public void dispatch(Runnable update) {
            acceptedUpdate = update;
            accepted.countDown();
            await(releaseReturn);
        }
    }
}
