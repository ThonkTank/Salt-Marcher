package platform.execution;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import platform.ui.UiDispatcher;
import platform.ui.TrackedUiDispatcher;

/**
 * Campaign-wide admission fence for work that can cross multiple execution lanes.
 *
 * <p>A root submission starts one tracked workflow. Submissions made while that workflow is
 * executing inherit its admission even after a pause or terminal fence. This lets an accepted
 * workflow finish its remaining phases without admitting a new external workflow.
 */
public final class WorkflowAdmissionController {

    private enum State { OPEN, PAUSED, REVOKED, CLOSED }

    private final Object monitor = new Object();
    private final ThreadLocal<Workflow> currentWorkflow = new ThreadLocal<>();
    private final Map<ExecutionLane, AdmittedLane> admitted = new IdentityHashMap<>();
    private final Map<UiDispatcher, AdmittedUiDispatcher> admittedUi = new IdentityHashMap<>();
    private State state = State.OPEN;
    private int activeWorkflows;
    private CompletableFuture<Void> drain = CompletableFuture.completedFuture(null);

    public ExecutionLane admit(ExecutionLane delegate) {
        ExecutionLane safeDelegate = Objects.requireNonNull(delegate, "delegate");
        synchronized (monitor) {
            if (state == State.CLOSED) {
                throw new IllegalStateException("workflow admission controller is closed");
            }
            return admitted.computeIfAbsent(safeDelegate, AdmittedLane::new);
        }
    }

    /** Preserves workflow admission across an asynchronous UI publication hop. */
    public UiDispatcher admit(UiDispatcher delegate) {
        UiDispatcher safeDelegate = Objects.requireNonNull(delegate, "delegate");
        if (!(safeDelegate instanceof TrackedUiDispatcher trackedDelegate)) {
            throw new IllegalArgumentException(
                    "Campaign UI admission requires terminal dispatch tracking");
        }
        synchronized (monitor) {
            if (state == State.CLOSED) {
                throw new IllegalStateException("workflow admission controller is closed");
            }
            return admittedUi.computeIfAbsent(
                    safeDelegate, ignored -> new AdmittedUiDispatcher(trackedDelegate));
        }
    }

    public CompletionStage<Void> pauseAndDrain() {
        synchronized (monitor) {
            if (state == State.REVOKED || state == State.CLOSED) {
                return CompletableFuture.failedFuture(
                        new IllegalStateException("terminal workflow admission cannot be paused"));
            }
            state = State.PAUSED;
            return currentDrain();
        }
    }

    public void resume() {
        resumeWith(() -> { });
    }

    public void resumeWith(Runnable activation) {
        Objects.requireNonNull(activation, "activation");
        synchronized (monitor) {
            if (state != State.PAUSED || activeWorkflows != 0) {
                throw new IllegalStateException("workflow admission can resume only after a paused drain");
            }
            activation.run();
            state = State.OPEN;
        }
    }

    /** Runs one explicitly owned candidate-preparation root while public admission is paused. */
    public <T> AcceptedResult<T> runWhilePaused(Supplier<T> preparation) {
        Objects.requireNonNull(preparation, "preparation");
        Workflow workflow;
        synchronized (monitor) {
            if (state != State.PAUSED || activeWorkflows != 0 || currentWorkflow.get() != null) {
                throw new IllegalStateException("candidate preparation requires a fully drained pause");
            }
            workflow = new Workflow();
            workflow.tasks = 1;
            activeWorkflows = 1;
        }
        currentWorkflow.set(workflow);
        T value;
        try {
            value = preparation.get();
        } finally {
            currentWorkflow.remove();
            taskFinished(workflow);
        }
        synchronized (monitor) {
            return new AcceptedResult<>(value, currentDrain());
        }
    }

    public CompletionStage<Void> revokeAndDrain() {
        synchronized (monitor) {
            if (state != State.CLOSED) {
                state = State.REVOKED;
            }
            return currentDrain();
        }
    }

    public void closeDelegatesAfterDrain() {
        List<ExecutionLane> delegates;
        synchronized (monitor) {
            if (state == State.CLOSED) {
                return;
            }
            if (state != State.REVOKED || activeWorkflows != 0) {
                throw new IllegalStateException("execution lanes can close only after terminal drain");
            }
            state = State.CLOSED;
            delegates = new ArrayList<>(admitted.keySet());
        }
        Throwable failure = null;
        for (ExecutionLane delegate : delegates) {
            try {
                if (delegate instanceof BoundedExecutionLane bounded) {
                    if (!bounded.terminateNow(java.time.Duration.ofSeconds(1))) {
                        throw new IllegalStateException(
                                "bounded execution lane did not terminate within close budget");
                    }
                } else {
                    delegate.close();
                }
            } catch (RuntimeException | Error closeFailure) {
                if (failure == null) {
                    failure = closeFailure;
                } else {
                    failure.addSuppressed(closeFailure);
                }
            }
        }
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
    }

    private CompletableFuture<Void> currentDrain() {
        if (activeWorkflows == 0) {
            return CompletableFuture.completedFuture(null);
        }
        if (drain.isDone()) {
            drain = new CompletableFuture<>();
        }
        return drain;
    }

    private void submit(ExecutionLane delegate, Runnable work) {
        Objects.requireNonNull(work, "work");
        Workflow workflow;
        synchronized (monitor) {
            Workflow inherited = currentWorkflow.get();
            if (inherited == null) {
                if (state != State.OPEN) {
                    throw new RejectedExecutionException("Campaign workflow admission is " + state);
                }
                workflow = new Workflow();
                activeWorkflows++;
            } else {
                workflow = inherited;
            }
            workflow.tasks++;
        }
        AtomicBoolean finished = new AtomicBoolean();
        try {
            delegate.execute(() -> run(workflow, work, finished));
        } catch (RuntimeException | Error failure) {
            finishOnce(workflow, finished);
            throw failure;
        }
    }

    private CompletionStage<Void> submit(
            TrackedUiDispatcher delegate,
            Runnable work,
            java.util.function.Consumer<Throwable> terminalHandler
    ) {
        Objects.requireNonNull(work, "work");
        Objects.requireNonNull(terminalHandler, "terminalHandler");
        Workflow workflow;
        synchronized (monitor) {
            Workflow inherited = currentWorkflow.get();
            if (inherited == null) {
                if (state != State.OPEN) {
                    RejectedExecutionException rejection = new RejectedExecutionException(
                            "Campaign workflow admission is " + state);
                    return CompletableFuture.failedFuture(
                            TrackedUiDispatcher.notifyTerminal(terminalHandler, rejection));
                }
                workflow = new Workflow();
                activeWorkflows++;
            } else {
                workflow = inherited;
            }
            workflow.tasks++;
        }
        Workflow accepted = workflow;
        AtomicBoolean finished = new AtomicBoolean();
        CompletableFuture<Void> observedTerminal = new CompletableFuture<>();
        AtomicBoolean terminalObserved = new AtomicBoolean();
        java.util.function.Consumer<Throwable> observe = failure -> {
            if (!terminalObserved.compareAndSet(false, true)) {
                return;
            }
            finishOnce(accepted, finished);
            Throwable terminalFailure = TrackedUiDispatcher.notifyTerminal(terminalHandler, failure);
            if (terminalFailure == null) {
                observedTerminal.complete(null);
            } else {
                observedTerminal.completeExceptionally(terminalFailure);
            }
        };
        try {
            CompletionStage<Void> terminal = delegate.dispatchTracked(
                    () -> run(accepted, work, finished), observe);
            terminal.whenComplete((ignored, failure) -> observe.accept(failure));
        } catch (RuntimeException | Error failure) {
            observe.accept(failure);
        }
        return observedTerminal;
    }

    private void run(Workflow workflow, Runnable work, AtomicBoolean finished) {
        Workflow previous = currentWorkflow.get();
        currentWorkflow.set(workflow);
        try {
            work.run();
        } finally {
            if (previous == null) {
                currentWorkflow.remove();
            } else {
                currentWorkflow.set(previous);
            }
            finishOnce(workflow, finished);
        }
    }

    private void finishOnce(Workflow workflow, AtomicBoolean finished) {
        if (finished.compareAndSet(false, true)) {
            taskFinished(workflow);
        }
    }

    private void taskFinished(Workflow workflow) {
        synchronized (monitor) {
            workflow.tasks--;
            if (workflow.tasks == 0) {
                activeWorkflows--;
                if (activeWorkflows == 0 && !drain.isDone()) {
                    drain.complete(null);
                }
            }
        }
    }

    private static final class Workflow {
        private int tasks;
    }

    public record AcceptedResult<T>(T value, CompletionStage<Void> drained) {
        public AcceptedResult {
            value = Objects.requireNonNull(value, "value");
            drained = Objects.requireNonNull(drained, "drained");
        }
    }

    private final class AdmittedLane implements ExecutionLane {
        private final ExecutionLane delegate;

        private AdmittedLane(ExecutionLane delegate) {
            this.delegate = delegate;
        }

        @Override
        public void execute(Runnable work) {
            submit(delegate, work);
        }

        /** Lane lifetime belongs to the controller so shared delegates close exactly once. */
        @Override
        public void close() {
        }
    }

    private final class AdmittedUiDispatcher implements TrackedUiDispatcher {

        private final TrackedUiDispatcher delegate;

        private AdmittedUiDispatcher(TrackedUiDispatcher delegate) {
            this.delegate = delegate;
        }

        @Override
        public void dispatch(Runnable update) {
            CompletionStage<Void> terminal = dispatchTracked(update);
            CompletableFuture<Void> future = terminal.toCompletableFuture();
            if (future.isDone()) {
                try {
                    future.join();
                } catch (java.util.concurrent.CompletionException failure) {
                    Throwable cause = failure.getCause();
                    if (cause instanceof RuntimeException runtimeFailure) {
                        throw runtimeFailure;
                    }
                    if (cause instanceof Error error) {
                        throw error;
                    }
                    throw failure;
                }
            }
        }

        @Override
        public CompletionStage<Void> dispatchTracked(
                Runnable update,
                java.util.function.Consumer<Throwable> terminalHandler
        ) {
            return submit(delegate, update, terminalHandler);
        }
    }
}
