package app;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import platform.ui.UiDispatcher;

/** Campaign UI dispatcher whose accepted work can be cancelled or drained deterministically. */
final class RevocableUiDispatcher implements UiDispatcher {

    private enum TaskState { QUEUED, RUNNING, SETTLING, DONE }

    private final UiDispatcher delegate;
    private final Set<TrackedTask> queued = new LinkedHashSet<>();
    private boolean revoked;
    private boolean publishingCancellations;
    private int running;
    private int settling;
    private CompletableFuture<Void> drain;

    RevocableUiDispatcher(UiDispatcher delegate) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
    }

    @Override
    public void dispatch(Runnable update) {
        submit(update, true, ignored -> { });
    }

    CompletionStage<Void> dispatchTracked(Runnable update) {
        return dispatchTracked(update, ignored -> { });
    }

    CompletionStage<Void> dispatchTracked(Runnable update, Consumer<Throwable> terminalHandler) {
        return submit(update, false, terminalHandler);
    }

    private CompletionStage<Void> submit(
            Runnable update,
            boolean propagateCallbackFailure,
            Consumer<Throwable> terminalHandler
    ) {
        TrackedTask task = new TrackedTask(
                Objects.requireNonNull(update, "update"),
                propagateCallbackFailure,
                Objects.requireNonNull(terminalHandler, "terminalHandler"));
        boolean rejected;
        synchronized (this) {
            rejected = revoked;
            if (rejected) {
                task.state = TaskState.SETTLING;
                settling++;
            } else {
                queued.add(task);
            }
        }
        if (rejected) {
            finishTerminal(
                    task,
                    new DispatchRejectedException("Campaign UI dispatcher is revoked"),
                    false);
            return task.completion;
        }
        try {
            delegate.dispatch(() -> execute(task));
        } catch (RuntimeException | Error failure) {
            rejectQueuedTask(task, failure);
            if (propagateCallbackFailure) {
                rethrow(failure);
            }
        }
        return task.completion;
    }

    CompletionStage<Void> revokeAndDrain() {
        List<TrackedTask> cancelled;
        CompletableFuture<Void> currentDrain;
        CompletableFuture<Void> drainToComplete;
        synchronized (this) {
            if (!revoked) {
                revoked = true;
            }
            if (drain == null) {
                drain = new CompletableFuture<>();
            }
            currentDrain = drain;
            cancelled = new ArrayList<>(queued);
            queued.clear();
            if (!cancelled.isEmpty()) {
                publishingCancellations = true;
            }
            for (TrackedTask task : cancelled) {
                task.state = TaskState.SETTLING;
                settling++;
            }
            drainToComplete = drainIfIdle();
        }
        DispatchRejectedException cancellation =
                new DispatchRejectedException("Campaign UI work cancelled during revocation");
        cancelled.forEach(task -> finishTerminal(task, cancellation, false));
        if (!cancelled.isEmpty()) {
            synchronized (this) {
                publishingCancellations = false;
                drainToComplete = drainIfIdle();
            }
        }
        if (drainToComplete != null) {
            drainToComplete.complete(null);
        }
        return currentDrain;
    }

    void revoke() {
        revokeAndDrain();
    }

    synchronized boolean revokedForTesting() {
        return revoked;
    }

    private void execute(TrackedTask task) {
        synchronized (this) {
            if (task.state != TaskState.QUEUED || !queued.remove(task)) {
                return;
            }
            task.state = TaskState.RUNNING;
            running++;
        }
        Throwable failure = null;
        try {
            task.update.run();
        } catch (RuntimeException | Error callbackFailure) {
            failure = callbackFailure;
        } finally {
            synchronized (this) {
                task.state = TaskState.SETTLING;
                settling++;
            }
        }
        finishTerminal(task, failure, true);
        if (failure != null && task.propagateCallbackFailure) {
            rethrow(failure);
        }
    }

    private void rejectQueuedTask(TrackedTask task, Throwable failure) {
        boolean rejected = false;
        synchronized (this) {
            if (task.state == TaskState.QUEUED && queued.remove(task)) {
                task.state = TaskState.SETTLING;
                settling++;
                rejected = true;
            }
        }
        if (rejected) {
            finishTerminal(task, failure, false);
        }
    }

    private void finishTerminal(TrackedTask task, Throwable failure, boolean wasRunning) {
        Throwable terminalFailure = failure;
        try {
            task.terminalHandler.accept(failure);
        } catch (RuntimeException | Error handlerFailure) {
            terminalFailure = accumulate(terminalFailure, handlerFailure);
        }
        CompletableFuture<Void> drainToComplete;
        synchronized (this) {
            settling--;
            if (wasRunning) {
                running--;
            }
            task.state = TaskState.DONE;
            drainToComplete = drainIfIdle();
        }
        if (terminalFailure == null) {
            task.completion.complete(null);
        } else {
            task.completion.completeExceptionally(terminalFailure);
        }
        if (drainToComplete != null) {
            drainToComplete.complete(null);
        }
    }

    private CompletableFuture<Void> drainIfIdle() {
        if (revoked && !publishingCancellations && queued.isEmpty()
                && running == 0 && settling == 0 && drain != null && !drain.isDone()) {
            return drain;
        }
        return null;
    }

    private static final class TrackedTask {
        private final Runnable update;
        private final boolean propagateCallbackFailure;
        private final Consumer<Throwable> terminalHandler;
        private final CompletableFuture<Void> completion = new CompletableFuture<>();
        private TaskState state = TaskState.QUEUED;

        private TrackedTask(
                Runnable update,
                boolean propagateCallbackFailure,
                Consumer<Throwable> terminalHandler
        ) {
            this.update = update;
            this.propagateCallbackFailure = propagateCallbackFailure;
            this.terminalHandler = terminalHandler;
        }
    }

    private static Throwable accumulate(Throwable current, Throwable next) {
        if (next == null || current == next) {
            return current;
        }
        if (current == null) {
            return next;
        }
        current.addSuppressed(next);
        return current;
    }

    private static void rethrow(Throwable failure) {
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
        throw new IllegalStateException(failure);
    }

    static final class DispatchRejectedException extends IllegalStateException {
        private DispatchRejectedException(String message) {
            super(message);
        }
    }
}
