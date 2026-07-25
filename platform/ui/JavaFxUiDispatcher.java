package platform.ui;

import java.util.Objects;
import javafx.application.Platform;

public final class JavaFxUiDispatcher implements TrackedUiDispatcher {

    @FunctionalInterface
    interface Scheduler {
        void schedule(Runnable update);
    }

    private final Scheduler scheduler;

    public JavaFxUiDispatcher() {
        this(Platform::runLater);
    }

    JavaFxUiDispatcher(Scheduler scheduler) {
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
    }

    @Override
    public void dispatch(Runnable update) {
        Runnable safeUpdate = Objects.requireNonNull(update, "update");
        if (Platform.isFxApplicationThread()) {
            safeUpdate.run();
        } else {
            scheduler.schedule(safeUpdate);
        }
    }


    @Override
    public java.util.concurrent.CompletionStage<Void> dispatchTracked(
            Runnable update,
            java.util.function.Consumer<Throwable> terminalHandler
    ) {
        java.util.concurrent.CompletableFuture<Void> completion = new java.util.concurrent.CompletableFuture<>();
        java.util.concurrent.atomic.AtomicBoolean terminalPublished =
                new java.util.concurrent.atomic.AtomicBoolean();
        java.util.function.Consumer<Throwable> publishTerminal = failure -> {
            if (!terminalPublished.compareAndSet(false, true)) {
                return;
            }
            Throwable terminalFailure = TrackedUiDispatcher.notifyTerminal(terminalHandler, failure);
            if (terminalFailure == null) {
                completion.complete(null);
            } else {
                completion.completeExceptionally(terminalFailure);
            }
        };
        try {
            dispatch(() -> {
            Throwable failure = null;
            try {
                update.run();
            } catch (RuntimeException | Error callbackFailure) {
                failure = callbackFailure;
            }
                publishTerminal.accept(failure);
            });
        } catch (RuntimeException | Error schedulingFailure) {
            publishTerminal.accept(schedulingFailure);
        }
        return completion;
    }

}
