package app;

import features.catalog.CatalogFeature;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import shell.host.AppShell;

/** Closeable ownership aggregate for one prepared or active Campaign presentation. */
final class CampaignShell implements CampaignActivationCoordinator.Candidate {

    private final AppShell shell;
    private final CatalogFeature.Component catalog;
    private final CampaignRuntime runtime;
    private final RevocableUiDispatcher uiDispatcher;
    private final Consumer<String> closeObserver;
    private final Object closeMonitor = new Object();
    private boolean closed;
    private CompletableFuture<Void> closeAttempt;

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

    @Override
    public AppShell shell() {
        return shell;
    }

    @Override
    public CampaignRuntime runtimeForTesting() {
        return runtime;
    }

    CampaignRuntime runtime() {
        return runtime;
    }

    @Override
    public CompletionStage<Void> pauseAndDrain() {
        return runtime.pauseAndDrain();
    }

    @Override
    public void resumeAdmission() {
        runtime.resumeAdmission();
    }

    @Override
    public void activateVisibleShell() {
        runtime.activatePublishedShell(shell);
    }

    @Override
    public CampaignRuntime.CandidatePreparation<Boolean> preparePublication(
            java.util.function.Supplier<Boolean> publication
    ) {
        return runtime.prepareCandidate(publication);
    }

    @Override
    public CompletionStage<Void> dispatchUiTracked(
            Runnable work,
            Consumer<Throwable> terminalHandler
    ) {
        return uiDispatcher.dispatchTracked(work, terminalHandler);
    }

    @Override
    public CompletionStage<Void> closeAsync() {
        CompletableFuture<Void> completion;
        synchronized (closeMonitor) {
            if (closed) {
                return CompletableFuture.completedFuture(null);
            }
            if (closeAttempt != null) {
                return closeAttempt;
            }
            completion = new CompletableFuture<>();
            closeAttempt = completion;
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
                synchronized (closeMonitor) {
                    if (failure == null) {
                        closed = true;
                    }
                    closeAttempt = null;
                }
                if (failure == null) {
                    completion.complete(null);
                } else {
                    completion.completeExceptionally(failure);
                }
            });
        });
        return completion;
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
