package platform.ui;

import java.util.Objects;

public enum DirectUiDispatcher implements TrackedUiDispatcher {
    INSTANCE;

    @Override
    public void dispatch(Runnable update) {
        Objects.requireNonNull(update, "update").run();
    }

    @Override
    public java.util.concurrent.CompletionStage<Void> dispatchTracked(
            Runnable update,
            java.util.function.Consumer<Throwable> terminalHandler
    ) {
        java.util.concurrent.CompletableFuture<Void> completion = new java.util.concurrent.CompletableFuture<>();
        Throwable failure = null;
        try {
            dispatch(update);
        } catch (RuntimeException | Error callbackFailure) {
            failure = callbackFailure;
        }
        Throwable terminalFailure = TrackedUiDispatcher.notifyTerminal(terminalHandler, failure);
        if (terminalFailure == null) {
            completion.complete(null);
        } else {
            completion.completeExceptionally(terminalFailure);
        }
        return completion;
    }

}
