package app;

import features.catalog.CatalogFeature;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import shell.host.AppShell;

/** Closeable ownership aggregate for one prepared or active Campaign presentation. */
final class CampaignShell {

    private final AppShell shell;
    private final CatalogFeature.Component catalog;
    private final CampaignRuntime runtime;
    private final RevocableUiDispatcher uiDispatcher;
    private final Consumer<String> closeObserver;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final CompletableFuture<Void> closeCompletion = new CompletableFuture<>();

    CampaignShell(
            AppShell shell,
            CatalogFeature.Component catalog,
            CampaignRuntime runtime,
            RevocableUiDispatcher uiDispatcher,
            Consumer<String> closeObserver
    ) {
        this.shell = Objects.requireNonNull(shell, "shell");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.runtime = Objects.requireNonNull(runtime, "runtime");
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        this.closeObserver = Objects.requireNonNull(closeObserver, "closeObserver");
    }

    AppShell shell() {
        return shell;
    }

    CampaignRuntime runtime() {
        return runtime;
    }

    void activateVisibleShell() {
        runtime.activatePublishedShell(shell);
    }

    CompletionStage<Void> dispatchUiTracked(Runnable work, Consumer<Throwable> terminalHandler) {
        return uiDispatcher.dispatchTracked(work, terminalHandler);
    }

    CompletionStage<Void> closeAsync() {
        if (!closed.compareAndSet(false, true)) {
            return closeCompletion;
        }
        uiDispatcher.revokeAndDrain().whenComplete((ignoredUi, uiFailure) -> {
            Throwable detachFailure = uiFailure;
            try {
                catalog.close();
            } catch (RuntimeException | Error failure) {
                detachFailure = accumulate(detachFailure, failure);
            }
            try {
                closeObserver.accept("catalog");
            } catch (RuntimeException | Error failure) {
                detachFailure = accumulate(detachFailure, failure);
            }
            CompletionStage<Void> runtimeClose;
            try {
                closeObserver.accept("runtime");
            } catch (RuntimeException | Error failure) {
                detachFailure = accumulate(detachFailure, failure);
            }
            try {
                runtimeClose = runtime.quiesceAsync();
            } catch (RuntimeException | Error failure) {
                detachFailure = accumulate(detachFailure, failure);
                runtimeClose = CompletableFuture.completedFuture(null);
            }
            Throwable finalDetachFailure = detachFailure;
            runtimeClose.whenComplete((ignoredRuntime, runtimeFailure) -> {
                Throwable failure = accumulate(finalDetachFailure, runtimeFailure);
                if (failure == null) {
                    closeCompletion.complete(null);
                } else {
                    closeCompletion.completeExceptionally(failure);
                }
            });
        });
        return closeCompletion;
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
}
