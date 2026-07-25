package app;

import features.catalog.CatalogFeature;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import javafx.scene.Scene;
import javafx.scene.layout.Pane;
import shell.host.AppShell;

/** Closeable ownership aggregate for one prepared or active Campaign presentation. */
final class CampaignShell implements CampaignActivationCoordinator.Candidate {

    private final AppShell shell;
    private final Scene qualificationScene;
    private final CatalogFeature.Component catalog;
    private final CampaignRuntime runtime;
    private final RevocableUiDispatcher uiDispatcher;
    private final Consumer<String> closeObserver;
    private final Object closeMonitor = new Object();
    private boolean closeStarted;
    private boolean closed;
    private boolean uiRevoked;
    private boolean catalogClosed;
    private boolean catalogCloseObserved;
    private boolean runtimeCloseObserved;
    private boolean runtimeClosed;
    private CompletableFuture<Void> closeAttempt;
    private CampaignActivationCoordinator.PublicationSurface publicationSurface;
    private CampaignActivationCoordinator.PublishedRootReadinessAttempt publicationReadiness;

    CampaignShell(
            AppShell shell,
            Scene qualificationScene,
            CatalogFeature.Component catalog,
            CampaignRuntime runtime,
            RevocableUiDispatcher uiDispatcher,
            Consumer<String> closeObserver
    ) {
        this.shell = Objects.requireNonNull(shell, "shell");
        this.qualificationScene = Objects.requireNonNull(qualificationScene, "qualificationScene");
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
    public CampaignActivationCoordinator.PublicationSurface publicationSurface() {
        if (!javafx.application.Platform.isFxApplicationThread()) {
            throw new IllegalStateException("Campaign publication surface belongs to the FX thread");
        }
        if (publicationSurface == null) {
            if (qualificationScene.getRoot() != shell || shell.getScene() != qualificationScene) {
                throw new IllegalStateException("Campaign qualification Scene no longer owns its shell");
            }
            publicationSurface = new CampaignActivationCoordinator.PublicationSurface(
                    shell,
                    qualificationScene.getAccelerators());
            qualificationScene.setRoot(new Pane());
        } else if (shell.getScene() != null) {
            throw new IllegalStateException("Campaign shell must be detached before republication");
        }
        return publicationSurface;
    }

    @Override
    public boolean reusableWhileParked() {
        // The current shared Creature/Item definitions are read-only, and the focused Scene
        // binding has no delayed background session to retire. Other active workspaces may own
        // debounce or activation lifecycles, so they take the cold, close-and-rebuild path.
        return shell.activeLeftBarTab()
                .map(CampaignRuntime.REQUIRED_SCENE_JOURNEY::equals)
                .orElse(false);
    }

    @Override
    public void prepareForParking() {
        runtime.captureParkedState();
    }

    @Override
    public boolean parkedStateStillValid() {
        return runtime.parkedStateStillValid();
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
        shell.setDisable(true);
        shell.setAccessibleHelp("Campaign ist vorbereitet und wartet auf sichtbare Aktivierung.");
        return runtime.prepareCandidate(publication);
    }

    @Override
    public void ownPublishedRootReadiness(
            CampaignActivationCoordinator.PublishedRootReadinessAttempt readiness
    ) {
        CampaignActivationCoordinator.PublishedRootReadinessAttempt safeReadiness =
                Objects.requireNonNull(readiness, "readiness");
        synchronized (closeMonitor) {
            if (closeStarted) {
                safeReadiness.cancel();
                throw new IllegalStateException("Campaign shell is closing");
            }
            publicationReadiness = safeReadiness;
        }
        safeReadiness.completion().whenComplete((ignored, failure) -> {
            synchronized (closeMonitor) {
                if (publicationReadiness == safeReadiness) {
                    publicationReadiness = null;
                }
            }
        });
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
        CampaignActivationCoordinator.PublishedRootReadinessAttempt readiness;
        synchronized (closeMonitor) {
            if (closed) {
                return CompletableFuture.completedFuture(null);
            }
            if (closeAttempt != null) {
                return closeAttempt;
            }
            completion = new CompletableFuture<>();
            closeStarted = true;
            closeAttempt = completion;
            readiness = publicationReadiness;
        }
        CompletionStage<Void> readinessCancellation;
        try {
            readinessCancellation = readiness == null
                    ? CompletableFuture.completedFuture(null)
                    : Objects.requireNonNull(readiness.cancel(), "readiness cancellation");
        } catch (RuntimeException | Error failure) {
            readinessCancellation = CompletableFuture.failedFuture(failure);
        }
        readinessCancellation.whenComplete((ignoredReadiness, readinessFailure) -> {
            if (readinessFailure == null && readiness != null) {
                synchronized (closeMonitor) {
                    if (publicationReadiness == readiness) {
                        publicationReadiness = null;
                    }
                }
            }
            CompletionStage<Void> uiRevocation;
            synchronized (closeMonitor) {
                try {
                    uiRevocation = uiRevoked
                            ? CompletableFuture.completedFuture(null)
                            : Objects.requireNonNull(
                                    uiDispatcher.revokeAndDrain(), "UI revocation");
                } catch (RuntimeException | Error failure) {
                    uiRevocation = CompletableFuture.failedFuture(failure);
                }
            }
            uiRevocation.whenComplete((ignoredUi, uiFailure) -> {
                if (uiFailure == null) {
                    synchronized (closeMonitor) {
                        uiRevoked = true;
                    }
                }
                Throwable detachFailure = accumulate(readinessFailure, uiFailure);
                synchronized (closeMonitor) {
                    if (!catalogClosed) {
                        try {
                            catalog.close();
                            catalogClosed = true;
                        } catch (RuntimeException | Error failure) {
                            detachFailure = accumulate(detachFailure, failure);
                        }
                    }
                }
                synchronized (closeMonitor) {
                    if (catalogClosed && !catalogCloseObserved) {
                        try {
                            closeObserver.accept("catalog");
                            catalogCloseObserved = true;
                        } catch (RuntimeException | Error failure) {
                            detachFailure = accumulate(detachFailure, failure);
                        }
                    }
                }
                CompletionStage<Void> runtimeClose;
                synchronized (closeMonitor) {
                    if (!runtimeCloseObserved) {
                        try {
                            closeObserver.accept("runtime");
                            runtimeCloseObserved = true;
                        } catch (RuntimeException | Error failure) {
                            detachFailure = accumulate(detachFailure, failure);
                        }
                    }
                }
                synchronized (closeMonitor) {
                    if (runtimeClosed) {
                        runtimeClose = CompletableFuture.completedFuture(null);
                    } else {
                        try {
                            runtimeClose = Objects.requireNonNull(
                                    runtime.quiesceAsync(), "runtime close");
                        } catch (RuntimeException | Error failure) {
                            detachFailure = accumulate(detachFailure, failure);
                            runtimeClose = CompletableFuture.failedFuture(failure);
                        }
                    }
                }
                Throwable finalDetachFailure = detachFailure;
                runtimeClose.whenComplete((ignoredRuntime, runtimeFailure) -> {
                    Throwable failure = accumulate(finalDetachFailure, runtimeFailure);
                    synchronized (closeMonitor) {
                        if (runtimeFailure == null) {
                            runtimeClosed = true;
                        }
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
