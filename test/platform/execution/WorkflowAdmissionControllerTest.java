package platform.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.ui.DirectUiDispatcher;
import platform.ui.TrackedUiDispatcher;
import platform.ui.UiDispatcher;

final class WorkflowAdmissionControllerTest {

    @Test
    void acceptedMultiLaneWorkflowDrainsAllPhasesWhileFenceRejectsNewRootsThenCanResume() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        SerialExecutionLane authoredDelegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        SerialExecutionLane preparationDelegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        ExecutionLane authored = admission.admit(authoredDelegate);
        ExecutionLane preparation = admission.admit(preparationDelegate);
        CountDownLatch phaseOne = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        java.util.List<String> commits = new java.util.concurrent.CopyOnWriteArrayList<>();

        authored.execute(() -> {
            commits.add("reserved");
            preparation.execute(() -> {
                phaseOne.countDown();
                await(release);
                commits.add("prepared");
                authored.execute(() -> commits.add("committed"));
            });
        });
        assertTrue(phaseOne.await(5, TimeUnit.SECONDS));

        var paused = admission.pauseAndDrain().toCompletableFuture();
        assertFalse(paused.isDone());
        assertThrows(RejectedExecutionException.class,
                () -> authored.execute(() -> commits.add("must-not-run")));
        release.countDown();
        paused.get(5, TimeUnit.SECONDS);
        assertEquals(java.util.List.of("reserved", "prepared", "committed"), commits);

        admission.resume();
        CountDownLatch resumed = new CountDownLatch(1);
        preparation.execute(resumed::countDown);
        assertTrue(resumed.await(5, TimeUnit.SECONDS));

        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        assertThrows(RejectedExecutionException.class, () -> preparation.execute(() -> { }));
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void drainWaitsForHeldLaneToUiToLaneTailAndPreservesItsAdmission() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        SerialExecutionLane delegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        ExecutionLane lane = admission.admit(delegate);
        QueuedUiDispatcher queuedUi = new QueuedUiDispatcher();
        UiDispatcher ui = admission.admit(queuedUi);
        CountDownLatch uiAccepted = new CountDownLatch(1);
        CountDownLatch tailStarted = new CountDownLatch(1);
        CountDownLatch releaseTail = new CountDownLatch(1);
        java.util.List<String> effects = new java.util.concurrent.CopyOnWriteArrayList<>();

        lane.execute(() -> ui.dispatch(() -> {
            effects.add("published");
            lane.execute(() -> {
                tailStarted.countDown();
                await(releaseTail);
                effects.add("persisted-tail");
            });
        }));
        queuedUi.accepted.await(5, TimeUnit.SECONDS);

        var paused = admission.pauseAndDrain().toCompletableFuture();
        assertFalse(paused.isDone(), "held UI continuation remains part of the accepted workflow");
        assertThrows(RejectedExecutionException.class, () -> lane.execute(() -> { }));

        queuedUi.runAccepted();
        assertTrue(tailStarted.await(5, TimeUnit.SECONDS));
        assertFalse(paused.isDone(), "drain waits for the nested persistence tail, not UI queue emptiness");
        releaseTail.countDown();
        paused.get(5, TimeUnit.SECONDS);
        assertEquals(java.util.List.of("published", "persisted-tail"), effects);

        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void synchronousUiCallbackFailureFinishesAcceptedWorkflowExactlyOnce() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        SerialExecutionLane delegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        ExecutionLane lane = admission.admit(delegate);
        UiDispatcher ui = admission.admit(DirectUiDispatcher.INSTANCE);
        CountDownLatch tailStarted = new CountDownLatch(1);
        CountDownLatch releaseTail = new CountDownLatch(1);

        assertThrows(IllegalStateException.class, () -> ui.dispatch(() -> {
            lane.execute(() -> {
                tailStarted.countDown();
                await(releaseTail);
            });
            throw new IllegalStateException("synchronous callback failure");
        }));
        assertTrue(tailStarted.await(5, TimeUnit.SECONDS));

        var paused = admission.pauseAndDrain().toCompletableFuture();
        assertFalse(paused.isDone(), "synchronous callback failure must not lose its admitted tail");
        releaseTail.countDown();
        paused.get(5, TimeUnit.SECONDS);
        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void pausedUnownedPresentationIsRejected() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        UiDispatcher ui = admission.admit(DirectUiDispatcher.INSTANCE);
        admission.pauseAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);

        assertThrows(RejectedExecutionException.class, () -> ui.dispatch(() -> { }));
        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void rejectedTrackedRootReturnsHandlerFailureAndPreservesAdmissionRejection() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        TrackedUiDispatcher ui = (TrackedUiDispatcher) admission.admit(DirectUiDispatcher.INSTANCE);
        admission.pauseAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        IllegalStateException handlerFailure = new IllegalStateException("handler failed");
        AtomicInteger handlerCalls = new AtomicInteger();

        var terminal = ui.dispatchTracked(
                () -> { throw new AssertionError("rejected update executed"); },
                observed -> {
                    assertTrue(observed instanceof RejectedExecutionException);
                    handlerCalls.incrementAndGet();
                    throw handlerFailure;
                }).toCompletableFuture();

        CompletionException reported = assertThrows(CompletionException.class, terminal::join);
        assertSame(handlerFailure, reported.getCause());
        assertEquals(1, handlerCalls.get());
        assertEquals(1, handlerFailure.getSuppressed().length);
        assertTrue(handlerFailure.getSuppressed()[0] instanceof RejectedExecutionException);
        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void revokeTerminatesUiWorkflowWhileTrackedDispatchReturnIsStillBlocked() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        ReturnGapTrackedUiDispatcher delegate = new ReturnGapTrackedUiDispatcher();
        UiDispatcher ui = admission.admit(delegate);
        AtomicReference<Throwable> submitFailure = new AtomicReference<>();
        Thread submitter = new Thread(() -> {
            try {
                ui.dispatch(() -> { });
            } catch (Throwable failure) {
                submitFailure.set(failure);
            }
        }, "tracked-ui-return-gap");
        submitter.start();
        assertTrue(delegate.accepted.await(5, TimeUnit.SECONDS));

        var revoked = admission.revokeAndDrain().toCompletableFuture();
        assertFalse(revoked.isDone());
        delegate.cancelAccepted();
        revoked.get(5, TimeUnit.SECONDS);
        assertTrue(submitter.isAlive(), "drain completes before tracked dispatch returns");

        delegate.releaseReturn.countDown();
        submitter.join(TimeUnit.SECONDS.toMillis(5));
        assertFalse(submitter.isAlive());
        assertTrue(submitFailure.get() instanceof java.util.concurrent.CancellationException);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void queuedThrowingTerminalHandlerCompletesAdmittedStageOnce() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        QueuedUiDispatcher delegate = new QueuedUiDispatcher();
        TrackedUiDispatcher ui = (TrackedUiDispatcher) admission.admit(delegate);
        IllegalStateException handlerFailure = new IllegalStateException("handler failed");
        AtomicInteger handlerCalls = new AtomicInteger();
        AtomicInteger completions = new AtomicInteger();

        var terminal = ui.dispatchTracked(
                () -> { },
                ignored -> {
                    handlerCalls.incrementAndGet();
                    throw handlerFailure;
                }).toCompletableFuture();
        assertTrue(delegate.accepted.await(5, TimeUnit.SECONDS));
        var paused = admission.pauseAndDrain().toCompletableFuture();
        assertFalse(paused.isDone());

        delegate.runAccepted();
        terminal.whenComplete((ignored, failure) -> completions.incrementAndGet());

        CompletionException reported = assertThrows(CompletionException.class, terminal::join);
        assertSame(handlerFailure, reported.getCause());
        assertEquals(1, handlerCalls.get());
        assertEquals(1, completions.get());
        paused.get(5, TimeUnit.SECONDS);
        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        admission.closeDelegatesAfterDrain();
    }

    @Test
    void returnGapThrowingTerminalHandlerCompletesOnceAndPreservesCancellation() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        ReturnGapTrackedUiDispatcher delegate = new ReturnGapTrackedUiDispatcher();
        TrackedUiDispatcher ui = (TrackedUiDispatcher) admission.admit(delegate);
        IllegalStateException handlerFailure = new IllegalStateException("handler failed");
        AtomicInteger handlerCalls = new AtomicInteger();
        AtomicReference<CompletableFuture<Void>> returned = new AtomicReference<>();
        Thread submitter = new Thread(() -> returned.set(ui.dispatchTracked(
                () -> { },
                ignored -> {
                    handlerCalls.incrementAndGet();
                    throw handlerFailure;
                }).toCompletableFuture()), "throwing-handler-return-gap");
        submitter.start();
        assertTrue(delegate.accepted.await(5, TimeUnit.SECONDS));

        var revoked = admission.revokeAndDrain().toCompletableFuture();
        delegate.cancelAccepted();
        revoked.get(5, TimeUnit.SECONDS);
        assertTrue(submitter.isAlive(), "terminal observation precedes delegate return");

        delegate.releaseReturn.countDown();
        submitter.join(TimeUnit.SECONDS.toMillis(5));
        assertFalse(submitter.isAlive());
        CompletableFuture<Void> terminal = returned.get();
        AtomicInteger completions = new AtomicInteger();
        terminal.whenComplete((ignored, failure) -> completions.incrementAndGet());
        CompletionException reported = assertThrows(CompletionException.class, terminal::join);
        assertSame(handlerFailure, reported.getCause());
        assertEquals(1, handlerCalls.get());
        assertEquals(1, completions.get());
        assertEquals(1, handlerFailure.getSuppressed().length);
        assertTrue(handlerFailure.getSuppressed()[0]
                instanceof java.util.concurrent.CancellationException);
        admission.closeDelegatesAfterDrain();
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(Duration.ofSeconds(5).toMillis(), TimeUnit.MILLISECONDS)) {
                throw new AssertionError("workflow phase timed out");
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new AssertionError(failure);
        }
    }

    private static final class QueuedUiDispatcher implements TrackedUiDispatcher {

        private final CountDownLatch accepted = new CountDownLatch(1);
        private Runnable update;
        private CompletableFuture<Void> completion;
        private java.util.function.Consumer<Throwable> terminalHandler;

        @Override
        public synchronized void dispatch(Runnable acceptedUpdate) {
            dispatchTracked(acceptedUpdate);
        }

        @Override
        public synchronized java.util.concurrent.CompletionStage<Void> dispatchTracked(
                Runnable acceptedUpdate
        ) {
            return dispatchTracked(acceptedUpdate, failure -> { });
        }

        @Override
        public synchronized java.util.concurrent.CompletionStage<Void> dispatchTracked(
                Runnable acceptedUpdate,
                java.util.function.Consumer<Throwable> registeredTerminalHandler
        ) {
            if (update != null) {
                throw new IllegalStateException("test UI dispatcher accepts one held update");
            }
            update = acceptedUpdate;
            completion = new CompletableFuture<>();
            terminalHandler = registeredTerminalHandler;
            accepted.countDown();
            return completion;
        }

        synchronized void runAccepted() {
            Runnable acceptedUpdate = update;
            CompletableFuture<Void> acceptedCompletion = completion;
            java.util.function.Consumer<Throwable> acceptedTerminalHandler = terminalHandler;
            update = null;
            completion = null;
            terminalHandler = null;
            try {
                acceptedUpdate.run();
                acceptedTerminalHandler.accept(null);
                acceptedCompletion.complete(null);
            } catch (RuntimeException | Error failure) {
                acceptedTerminalHandler.accept(failure);
                acceptedCompletion.completeExceptionally(failure);
                throw failure;
            }
        }
    }

    private static final class ReturnGapTrackedUiDispatcher implements TrackedUiDispatcher {
        private final CountDownLatch accepted = new CountDownLatch(1);
        private final CountDownLatch releaseReturn = new CountDownLatch(1);
        private java.util.function.Consumer<Throwable> terminalHandler;
        private CompletableFuture<Void> terminal;

        @Override
        public void dispatch(Runnable update) {
            dispatchTracked(update);
        }

        @Override
        public java.util.concurrent.CompletionStage<Void> dispatchTracked(Runnable update) {
            return dispatchTracked(update, failure -> { });
        }

        @Override
        public java.util.concurrent.CompletionStage<Void> dispatchTracked(
                Runnable update,
                java.util.function.Consumer<Throwable> registeredTerminalHandler
        ) {
            synchronized (this) {
                terminalHandler = registeredTerminalHandler;
                terminal = new CompletableFuture<>();
            }
            accepted.countDown();
            await(releaseReturn);
            return terminal;
        }

        void cancelAccepted() {
            java.util.function.Consumer<Throwable> handler;
            CompletableFuture<Void> completion;
            synchronized (this) {
                handler = terminalHandler;
                completion = terminal;
            }
            java.util.concurrent.CancellationException cancellation =
                    new java.util.concurrent.CancellationException("injected tracked cancellation");
            handler.accept(cancellation);
            completion.completeExceptionally(cancellation);
        }
    }
}
