package platform.ui;

import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;

/** UI dispatcher that reports callback execution, rejection, or cancellation terminally. */
public interface TrackedUiDispatcher extends UiDispatcher {

    /** Registers terminal observation before delegating, even if dispatch itself never returns. */
    CompletionStage<Void> dispatchTracked(
            Runnable update,
            Consumer<Throwable> terminalHandler);

    /** Reports a terminal result without letting a failing observer strand the returned stage. */
    static Throwable notifyTerminal(Consumer<Throwable> terminalHandler, Throwable failure) {
        try {
            terminalHandler.accept(failure);
            return failure;
        } catch (RuntimeException | Error handlerFailure) {
            if (failure != null && failure != handlerFailure) {
                handlerFailure.addSuppressed(failure);
            }
            return handlerFailure;
        }
    }

    default CompletionStage<Void> dispatchTracked(Runnable update) {
        java.util.concurrent.CompletableFuture<Void> terminal =
                new java.util.concurrent.CompletableFuture<>();
        dispatchTracked(update, failure -> {
            if (failure == null) {
                terminal.complete(null);
            } else {
                terminal.completeExceptionally(failure);
            }
        });
        return terminal;
    }
}
