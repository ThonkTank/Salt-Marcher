package app;

import features.campaign.CampaignDesk;
import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignSnapshot;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javafx.animation.AnimationTimer;
import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.layout.Pane;
import javafx.scene.control.Tooltip;
import javafx.stage.Stage;
import javafx.stage.WindowEvent;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellTopBarSpec;
import shell.host.AppShell;

/** Production whole-root owner for Campaign selection, switching, and recovery. */
final class CampaignDeskHost
        implements CampaignActivationCoordinator.SwitchingHost, AutoCloseable {

    private final Stage stage;
    private final CampaignDesk desk;
    private final Scene deskScene;
    private final AtomicReference<CampaignActivationCoordinator> coordinator = new AtomicReference<>();
    private final AtomicBoolean failAfterSwap = new AtomicBoolean();
    private final AtomicBoolean startupResumeStarted = new AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicInteger startupResumeAttempts =
            new java.util.concurrent.atomic.AtomicInteger();
    private volatile CampaignActivation durableActivation = CampaignActivation.none();
    private volatile AppShell activeCampaignShell;
    private volatile CampaignId activeCampaignId;
    private volatile boolean recoveryVisible;
    private volatile boolean containedRecoveryVisible;
    private volatile String recoveryMessage = "";
    private @org.jspecify.annotations.Nullable RootReadinessAttempt activeReadiness;
    private boolean closed;

    CampaignDeskHost(Stage stage) {
        this.stage = Objects.requireNonNull(stage, "stage");
        desk = CampaignDesk.compose(new CampaignDesk.Actions() {
            @Override
            public void create(String name) {
                createCampaign(name);
            }

            @Override
            public void select(CampaignSnapshot campaign) {
                selectCampaign(campaign);
            }

            @Override
            public void recover() {
                recoverCampaign();
            }

            @Override
            public void reload() {
                if (coordinator.get() == null) {
                    desk.showError(
                            "SaltMarcher konnte nicht vorbereitet werden. Starte die Anwendung neu.",
                            false);
                } else if (recoveryVisible) {
                    refreshRecovery(recoveryMessage);
                } else {
                    refresh("");
                }
            }
        });
        deskScene = new Scene(desk.root(), 1_150, 700);
        deskScene.getStylesheets().add(
                SaltMarcherApp.class.getResource("/salt-marcher.css").toExternalForm());
        stage.addEventHandler(WindowEvent.WINDOW_HIDDEN, ignored -> {
            cancelActiveReadinessOnFx();
            releaseCampaignPublicationOnFx();
        });
    }

    void attach(CampaignActivationCoordinator owner) {
        requireFxThread();
        if (!coordinator.compareAndSet(null, Objects.requireNonNull(owner, "owner"))) {
            throw new IllegalStateException("Campaign desk already has a coordinator");
        }
        showDesk();
        refresh("");
    }

    CompletionStage<Void> attachAndResume(CampaignActivationCoordinator owner) {
        requireFxThread();
        if (!coordinator.compareAndSet(null, Objects.requireNonNull(owner, "owner"))) {
            throw new IllegalStateException("Campaign desk already has a coordinator");
        }
        if (!startupResumeStarted.compareAndSet(false, true)) {
            throw new IllegalStateException("Durable Campaign resume already started");
        }
        startupResumeAttempts.incrementAndGet();
        CompletableFuture<Void> ready = new CompletableFuture<>();
        owner.resumeDurableActive().whenComplete((result, failure) ->
                onFx(() -> handleStartupResume(result, failure, ready)));
        return ready;
    }

    void showInitialLoading() {
        requireFxThread();
        desk.showLoading();
        showDesk();
    }

    void showStartupFailure() {
        requireFxThread();
        showDesk();
        desk.showError(
                "SaltMarcher konnte nicht vorbereitet werden. Starte die Anwendung neu.",
                false);
    }

    @Override
    public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
            CampaignSnapshot campaign,
            long generation,
            AppShell shell
    ) {
        AppShell safeShell = Objects.requireNonNull(shell, "shell");
        Scene qualificationScene = Objects.requireNonNull(
                safeShell.getScene(), "Prepared Campaign shell must have a qualification Scene");
        if (qualificationScene == deskScene || qualificationScene.getRoot() != safeShell) {
            throw new IllegalStateException("Prepared Campaign shell has an invalid publication Scene");
        }
        CampaignActivationCoordinator.PublicationSurface surface =
                new CampaignActivationCoordinator.PublicationSurface(
                        safeShell, qualificationScene.getAccelerators());
        qualificationScene.setRoot(new Pane());
        return switchCampaign(campaign, generation, surface);
    }

    @Override
    public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
            CampaignSnapshot campaign,
            long generation,
            CampaignActivationCoordinator.PublicationSurface surface
    ) {
        requireFxThread();
        CampaignSnapshot safeCampaign = Objects.requireNonNull(campaign, "campaign");
        CampaignActivationCoordinator.PublicationSurface safeSurface =
                Objects.requireNonNull(surface, "surface");
        AppShell safeShell = Objects.requireNonNull(safeSurface.shell(), "surface shell");
        if (safeShell.getScene() != null) {
            throw new IllegalStateException("Campaign shell must be detached before publication");
        }
        if (closed) {
            throw new IllegalStateException("Campaign host is closed");
        }
        cancelActiveReadinessOnFx();
        stage.setTitle("SaltMarcher – " + safeCampaign.name());
        deskScene.setRoot(safeShell);
        deskScene.getAccelerators().clear();
        deskScene.getAccelerators().putAll(safeSurface.accelerators());
        stage.setScene(deskScene);
        activeCampaignShell = safeShell;
        activeCampaignId = safeCampaign.id();
        durableActivation = new CampaignActivation(Optional.of(safeCampaign), generation);
        recoveryVisible = false;
        containedRecoveryVisible = false;
        recoveryMessage = "";
        if (failAfterSwap.compareAndSet(true, false)) {
            showRecoveryOnFx("Die Kampagne konnte nach dem Wechsel nicht sicher angezeigt werden.");
            return CampaignActivationCoordinator.RootSwitchResult.RECOVERY_VISIBLE;
        }
        focusMeaningfulCampaignTarget(safeShell);
        return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
    }

    @Override
    public CampaignActivationCoordinator.PublishedRootReadinessAttempt awaitPublishedRootReady(
            AppShell shell
    ) {
        requireFxThread();
        if (closed) {
            throw new IllegalStateException("Campaign host is closed");
        }
        AppShell expectedRoot = Objects.requireNonNull(shell, "shell");
        cancelActiveReadinessOnFx();
        RootReadinessAttempt readiness = new RootReadinessAttempt(expectedRoot);
        AnimationTimer timer = new AnimationTimer() {
            @Override
            public void handle(long now) {
                readiness.observePulse();
            }
        };
        readiness.install(timer);
        activeReadiness = readiness;
        timer.start();
        Platform.requestNextPulse();
        return readiness;
    }

    final class RootReadinessAttempt
            implements CampaignActivationCoordinator.PublishedRootReadinessAttempt {
        private final PublishedRootReadiness readiness = new PublishedRootReadiness();
        private final CompletableFuture<Void> terminated = new CompletableFuture<>();
        private final AtomicReference<AppShell> expectedRoot;
        private final AtomicReference<AnimationTimer> timer = new AtomicReference<>();
        private final AtomicInteger pulseObservations = new AtomicInteger();

        private RootReadinessAttempt(AppShell expectedRoot) {
            this.expectedRoot = new AtomicReference<>(
                    Objects.requireNonNull(expectedRoot, "expected root"));
        }

        private void install(AnimationTimer installedTimer) {
            if (!timer.compareAndSet(null, Objects.requireNonNull(installedTimer, "timer"))) {
                throw new IllegalStateException("Published-root timer is already installed");
            }
        }

        private void observePulse() {
            requireFxThread();
            AppShell root = expectedRoot.get();
            if (root == null || terminated.isDone()) {
                return;
            }
            pulseObservations.incrementAndGet();
            boolean rootCurrent = publishedRootIsCurrent(root);
            Bounds screenBounds = rootCurrent
                    ? root.localToScreen(root.getBoundsInLocal())
                    : null;
            boolean positiveBounds = rootCurrent
                    && root.getLayoutBounds().getWidth() > 0.0
                    && root.getLayoutBounds().getHeight() > 0.0
                    && screenBounds != null
                    && screenBounds.getWidth() > 0.0
                    && screenBounds.getHeight() > 0.0;
            if (readiness.observePulse(rootCurrent, positiveBounds)) {
                terminateOnFx(null);
                return;
            }
            if (!terminated.isDone()) {
                Platform.requestNextPulse();
            }
        }

        @Override
        public CompletionStage<Void> completion() {
            return readiness.completion();
        }

        @Override
        public CompletionStage<Void> cancel() {
            if (terminated.isDone()) {
                return terminated;
            }
            Runnable cancellation = () -> terminateOnFx(
                    new CancellationException("Published Campaign root readiness was revoked"));
            if (Platform.isFxApplicationThread()) {
                cancellation.run();
            } else {
                try {
                    Platform.runLater(cancellation);
                } catch (IllegalStateException toolkitStopped) {
                    timer.set(null);
                    expectedRoot.set(null);
                    readiness.cancel(toolkitStopped);
                    terminated.completeExceptionally(toolkitStopped);
                }
            }
            return terminated;
        }

        private void terminateOnFx(@org.jspecify.annotations.Nullable Throwable failure) {
            requireFxThread();
            if (terminated.isDone()) {
                return;
            }
            AnimationTimer installedTimer = timer.getAndSet(null);
            if (installedTimer != null) {
                installedTimer.stop();
            }
            expectedRoot.set(null);
            if (activeReadiness == this) {
                activeReadiness = null;
            }
            if (failure == null) {
                readiness.complete();
                terminated.complete(null);
            } else {
                readiness.cancel(failure);
                terminated.complete(null);
            }
        }

        int pulseObservations() {
            return pulseObservations.get();
        }

        boolean retainsPublishedRoot() {
            return expectedRoot.get() != null;
        }
    }

    static final class PublishedRootReadiness {
        private final CompletableFuture<Void> completion = new CompletableFuture<>();
        private int pulses;

        CompletionStage<Void> completion() {
            return completion;
        }

        boolean observePulse(boolean publishedRootCurrent, boolean positiveBounds) {
            if (completion.isDone()) {
                return true;
            }
            if (!publishedRootCurrent || !positiveBounds) {
                pulses = 0;
                return false;
            }
            pulses++;
            if (pulses >= 2) {
                completion.complete(null);
                return true;
            }
            return false;
        }

        private void complete() {
            completion.complete(null);
        }

        private void cancel(Throwable failure) {
            completion.completeExceptionally(Objects.requireNonNull(failure, "failure"));
        }
    }

    private boolean publishedRootIsCurrent(AppShell expectedRoot) {
        return stage.isShowing()
                && stage.getScene() == deskScene
                && deskScene.getRoot() == expectedRoot
                && expectedRoot.getScene() == deskScene
                && deskScene.getWindow() == stage;
    }

    @Override
    public CompletionStage<Void> showRecovery(
            Optional<CampaignActivation> durable,
            Class<? extends Throwable> failureType
    ) {
        CompletableFuture<Void> shown = new CompletableFuture<>();
        Runnable publication = () -> {
            try {
                durable.ifPresent(value -> durableActivation = value);
                showRecoveryOnFx("Die aktuelle Kampagne ist nicht spielbereit. "
                        + "Daten bleiben erhalten; versuche sie erneut zu öffnen.");
                shown.complete(null);
            } catch (RuntimeException | Error failure) {
                shown.completeExceptionally(failure);
            }
        };
        if (Platform.isFxApplicationThread()) {
            publication.run();
        } else {
            Platform.runLater(publication);
        }
        return shown;
    }

    @Override
    public void installSelectorAccess(AppShell shell) {
        requireFxThread();
        Button campaigns = new Button("Kampagnen");
        campaigns.getStyleClass().add("neutral-action");
        campaigns.setAccessibleText("Kampagnen auswählen oder neu erstellen");
        campaigns.setTooltip(new Tooltip("Kampagnen auswählen (Alt+K)"));
        campaigns.setOnAction(ignored -> openDesk());
        shell.registerTopBar(
                new ShellTopBarSpec(new ContributionKey("campaign-selector"), -1_000),
                ShellBinding.topBar("Kampagnen", campaigns));
        shell.getScene().getAccelerators().put(
                new javafx.scene.input.KeyCodeCombination(
                        javafx.scene.input.KeyCode.K,
                        javafx.scene.input.KeyCombination.ALT_DOWN),
                this::openDesk);
    }

    void failAfterRootSwapForTesting() {
        failAfterSwap.set(true);
    }

    boolean recoveryVisibleForTesting() {
        return recoveryVisible;
    }

    boolean deskVisibleForTesting() {
        return stage.getScene() == deskScene && deskScene.getRoot() == desk.root();
    }

    CampaignDesk deskForTesting() {
        return desk;
    }

    @org.jspecify.annotations.Nullable AppShell retainedCampaignShellForTesting() {
        return activeCampaignShell;
    }

    @org.jspecify.annotations.Nullable CampaignId retainedCampaignIdForTesting() {
        return activeCampaignId;
    }

    boolean containedRecoveryVisibleForTesting() {
        return containedRecoveryVisible;
    }

    int startupResumeAttemptsForTesting() {
        return startupResumeAttempts.get();
    }

    private void openDesk() {
        requireFxThread();
        showDesk();
        if (recoveryVisible) {
            refreshRecovery(recoveryMessage);
        } else {
            refresh("");
        }
    }

    private void createCampaign(String name) {
        requireFxThread();
        if (recoveryVisible) {
            showRecoveryForCurrentOwnershipOnFx(recoveryMessage);
            return;
        }
        CampaignActivationCoordinator owner = requireCoordinator();
        desk.showSwitching(name);
        owner.create(name, durableActivation.generation())
                .whenComplete((result, failure) -> onFx(() -> handleResult(result, failure, true)));
    }

    private void selectCampaign(CampaignSnapshot campaign) {
        requireFxThread();
        CampaignSnapshot target = Objects.requireNonNull(campaign, "campaign");
        desk.showSwitching(target.name());
        CompletionStage<CampaignActivationCoordinator.Result> transition = recoveryVisible
                ? requireCoordinator().switchFromRecovery(
                        target.id(), durableActivation.generation())
                : requireCoordinator().switchTo(target.id(), durableActivation.generation());
        transition
                .whenComplete((result, failure) -> onFx(() -> handleResult(result, failure, false)));
    }

    private void recoverCampaign() {
        requireFxThread();
        String currentName = durableActivation.campaign()
                .map(CampaignSnapshot::name)
                .orElse("Aktuelle Kampagne");
        desk.showSwitching(currentName);
        requireCoordinator().recoverDurableActive()
                .whenComplete((result, failure) -> onFx(() -> handleResult(result, failure, false)));
    }

    private void handleResult(
            CampaignActivationCoordinator.Result result,
            Throwable failure,
            boolean creating
    ) {
        requireFxThread();
        if (failure != null) {
            if (recoveryVisible) {
                showRecoveryFailureForCurrentOwnershipOnFx(
                        "Die andere Kampagne konnte nicht geöffnet werden. "
                                + "Die beschädigte Kampagne bleibt unverändert.",
                        "Der Kampagnenwechsel ist noch nicht abgeschlossen. "
                                + "Die bisherige Kampagne bleibt verfügbar; versuche es erneut.");
                return;
            }
            desk.showError("Die Kampagne konnte nicht geöffnet werden. Lade die Liste neu.", creating);
            return;
        }
        CampaignActivationCoordinator.Result safeResult = Objects.requireNonNull(result, "result");
        safeResult.durableActivation().ifPresent(value -> durableActivation = value);
        switch (safeResult.status()) {
            case ACTIVATED, ACTIVATED_DEGRADED, RESUMED -> {
                if (creating) {
                    desk.confirmCreation();
                }
                restoreAlreadyActiveScene(safeResult);
            }
            case RECOVERY_REQUIRED -> showRecoveryOnFx(
                    "Die ausgewählte Kampagne ist nicht spielbereit. "
                            + "Daten bleiben erhalten; versuche sie erneut zu öffnen.");
            case RECOVERY_UNAVAILABLE -> showContainedRecoveryOnFx(
                    "Der Kampagnenwechsel wird noch sicher beendet. "
                            + "Die bisherige Kampagne bleibt erhalten; versuche es erneut.");
            case INVALID_NAME -> desk.showError(
                    "Der Name muss sichtbaren Text enthalten.", true);
            case STALE_GENERATION -> refreshForCurrentMode(
                    "Die Kampagnenliste hat sich geändert. Wähle erneut.");
            case CAMPAIGN_NOT_FOUND -> refreshForCurrentMode(
                    "Diese Kampagne ist nicht mehr verfügbar.");
            case REGISTRY_UNAVAILABLE -> {
                if (recoveryVisible) {
                    showRecoveryFailureForCurrentOwnershipOnFx(
                            "Die übrigen Kampagnen sind gerade nicht verfügbar. "
                                    + "Die beschädigte Kampagne bleibt unverändert.",
                            "Der Kampagnenwechsel ist noch nicht abgeschlossen und die Liste "
                                    + "ist gerade nicht verfügbar. Versuche es erneut.");
                } else {
                    desk.showError(
                            "Die Kampagnenliste ist gerade nicht verfügbar. Lade sie erneut.",
                            false);
                }
            }
            case PRE_COMMIT_FAILED -> {
                if (recoveryVisible) {
                    showRecoveryFailureForCurrentOwnershipOnFx(
                            "Die andere Kampagne konnte nicht geöffnet werden. "
                                    + "Die beschädigte Kampagne bleibt unverändert.",
                            "Der Kampagnenwechsel ist noch nicht abgeschlossen. "
                                    + "Die bisherige Kampagne bleibt verfügbar; versuche es erneut.");
                } else {
                    desk.showError("Die Kampagne konnte nicht geöffnet werden. "
                            + "Die bisherige Kampagne bleibt erhalten.", creating);
                }
            }
            case NO_ACTIVE_CAMPAIGN -> refresh(
                    "Es ist noch keine aktuelle Kampagne ausgewählt.");
            case INVALID_GENERATION, INVALID_STATE, CLOSED -> {
                if (recoveryVisible) {
                    showRecoveryFailureForCurrentOwnershipOnFx(
                            "Dieser Recovery-Wechsel ist nicht mehr gültig. "
                                    + "Die beschädigte Kampagne bleibt unverändert.",
                            "Dieser Versuch ist nicht mehr gültig. Der sichere Kampagnenwechsel "
                                    + "bleibt ausstehend; lade neu und versuche es erneut.");
                } else {
                    desk.showError(
                            "Der Wechsel ist nicht mehr gültig. Lade die Kampagnen neu.", false);
                }
            }
        }
    }

    private void handleStartupResume(
            CampaignActivationCoordinator.Result result,
            Throwable failure,
            CompletableFuture<Void> ready
    ) {
        requireFxThread();
        if (failure != null) {
            showDesk();
            desk.showError(
                    "Die aktuelle Kampagne konnte nicht gelesen werden. "
                            + "Es wurde keine andere Kampagne geöffnet.",
                    false);
            ready.complete(null);
            return;
        }
        CampaignActivationCoordinator.Result safeResult = Objects.requireNonNull(result, "result");
        safeResult.durableActivation().ifPresent(value -> durableActivation = value);
        switch (safeResult.status()) {
            case RESUMED, ACTIVATED, ACTIVATED_DEGRADED -> ready.complete(null);
            case NO_ACTIVE_CAMPAIGN -> refresh("", ready);
            case RECOVERY_REQUIRED -> {
                if (!recoveryVisible) {
                    showRecoveryOnFx(
                            "Die aktuelle Kampagne ist nicht spielbereit. "
                                    + "Daten bleiben unverändert; versuche sie erneut zu öffnen.");
                }
                ready.complete(null);
            }
            case RECOVERY_UNAVAILABLE -> {
                if (!recoveryVisible) {
                    showContainedRecoveryOnFx(
                            "Der Kampagnenwechsel wird noch sicher beendet. "
                                    + "Versuche den Abschluss erneut.");
                }
                ready.complete(null);
            }
            case REGISTRY_UNAVAILABLE -> {
                showDesk();
                desk.showError(
                        "Die aktuelle Kampagne konnte nicht gelesen werden. "
                                + "Es wurde keine andere Kampagne geöffnet.",
                        false);
                ready.complete(null);
            }
            case PRE_COMMIT_FAILED, CAMPAIGN_NOT_FOUND, STALE_GENERATION, INVALID_NAME,
                    INVALID_GENERATION, INVALID_STATE, CLOSED -> {
                showDesk();
                desk.showError(
                        "Der gespeicherte Kampagnenstart ist nicht verfügbar. "
                                + "Es wurde keine andere Kampagne geöffnet.",
                        false);
                ready.complete(null);
            }
        }
    }

    private void restoreAlreadyActiveScene(CampaignActivationCoordinator.Result result) {
        Optional<CampaignSnapshot> selected = result.durableActivation()
                .flatMap(CampaignActivation::campaign);
        if (stage.getScene() == deskScene
                && stage.getScene().getRoot() == desk.root()
                && selected.isPresent()
                && activeCampaignShell != null
                && selected.orElseThrow().id().equals(activeCampaignId)) {
            stage.setTitle("SaltMarcher – " + selected.orElseThrow().name());
            deskScene.setRoot(activeCampaignShell);
            recoveryVisible = false;
            containedRecoveryVisible = false;
            recoveryMessage = "";
            focusMeaningfulCampaignTarget(activeCampaignShell);
        }
    }

    private void refresh(String announcement) {
        refresh(announcement, null);
    }

    private void refreshForCurrentMode(String announcement) {
        if (recoveryVisible) {
            showRecoveryFailureForCurrentOwnershipOnFx(
                    announcement + " Die beschädigte Kampagne bleibt unverändert.",
                    announcement + " Der sichere Kampagnenwechsel bleibt ausstehend; "
                            + "versuche es erneut.");
        } else {
            refresh(announcement);
        }
    }

    private void refresh(String announcement, CompletableFuture<Void> startupReady) {
        requireFxThread();
        CampaignActivationCoordinator owner = requireCoordinator();
        desk.showLoading();
        owner.listCampaigns().thenCombine(
                        owner.readDurableActiveCampaign(),
                        CampaignCatalog::new)
                .whenComplete((catalog, failure) -> onFx(() -> {
                    if (failure != null) {
                        desk.showError(
                                "Die Kampagnenliste ist gerade nicht verfügbar. Lade sie erneut.",
                                false);
                        completeReady(startupReady);
                        return;
                    }
                    if (catalog.list().status() != CampaignListResult.Status.SUCCESS
                            || catalog.active().status() != CampaignActiveResult.Status.SUCCESS) {
                        desk.showError(
                                "Die Kampagnenliste ist gerade nicht verfügbar. Lade sie erneut.",
                                false);
                        completeReady(startupReady);
                        return;
                    }
                    durableActivation = catalog.active().activation().orElseThrow();
                    desk.showCampaigns(
                            catalog.list().campaigns(),
                            durableActivation.campaign(),
                            announcement);
                    completeReady(startupReady);
                }));
    }

    private static void completeReady(CompletableFuture<Void> ready) {
        if (ready != null) {
            ready.complete(null);
        }
    }

    private void showDesk() {
        cancelActiveReadinessOnFx();
        stage.setTitle("SaltMarcher – Kampagnen");
        deskScene.setRoot(desk.root());
        stage.setScene(deskScene);
    }

    private void showRecoveryOnFx(String message) {
        requireFxThread();
        recoveryMessage = Objects.requireNonNull(message, "message");
        cancelActiveReadinessOnFx();
        desk.showRecovery(
                recoveryMessage,
                java.util.List.of(),
                durableActivation.campaign());
        showDesk();
        releaseCampaignPublicationOnFx();
        recoveryVisible = true;
        containedRecoveryVisible = false;
        if (coordinator.get() != null) {
            refreshRecovery(recoveryMessage);
        }
    }

    /**
     * Contains an unresolved coordinator transition without claiming that the coordinator's
     * currently published shell has been lost. The desk temporarily replaces the root, while the
     * exact shell identity remains retained for a later RESUMED result.
     */
    private void showContainedRecoveryOnFx(String message) {
        requireFxThread();
        recoveryMessage = Objects.requireNonNull(message, "message");
        cancelActiveReadinessOnFx();
        desk.showContainedTransition(
                recoveryMessage,
                java.util.List.of(),
                retainedCampaignForContainedRecovery());
        showDesk();
        recoveryVisible = true;
        containedRecoveryVisible = true;
        if (coordinator.get() != null) {
            refreshRecovery(recoveryMessage);
        }
    }

    private void showRecoveryForCurrentOwnershipOnFx(String message) {
        if (containedRecoveryVisible) {
            showContainedRecoveryOnFx(message);
        } else {
            showRecoveryOnFx(message);
        }
    }

    private void showRecoveryFailureForCurrentOwnershipOnFx(
            String damagedMessage,
            String containedMessage
    ) {
        if (containedRecoveryVisible) {
            showContainedRecoveryOnFx(containedMessage);
        } else {
            showRecoveryOnFx(damagedMessage);
        }
    }

    private CompletionStage<Void> cancelActiveReadinessOnFx() {
        requireFxThread();
        RootReadinessAttempt readiness = activeReadiness;
        activeReadiness = null;
        return readiness == null
                ? CompletableFuture.completedFuture(null)
                : readiness.cancel();
    }

    private void releaseCampaignPublicationOnFx() {
        requireFxThread();
        if (deskScene.getRoot() instanceof AppShell) {
            deskScene.setRoot(desk.root());
        }
        deskScene.getAccelerators().clear();
        activeCampaignShell = null;
        activeCampaignId = null;
    }

    @Override
    public void close() {
        Runnable closure = () -> {
            if (closed) {
                return;
            }
            closed = true;
            cancelActiveReadinessOnFx();
            releaseCampaignPublicationOnFx();
        };
        if (Platform.isFxApplicationThread()) {
            closure.run();
        } else {
            Platform.runLater(closure);
        }
    }

    private void refreshRecovery(String message) {
        requireFxThread();
        CampaignActivationCoordinator owner = requireCoordinator();
        String safeMessage = Objects.requireNonNull(message, "message");
        owner.listCampaigns().whenComplete((listed, failure) -> onFx(() -> {
            if (!recoveryVisible || !Objects.equals(recoveryMessage, safeMessage)) {
                return;
            }
            if (failure != null || listed.status() != CampaignListResult.Status.SUCCESS) {
                renderRecoveryOnFx(
                        safeMessage + " Die übrigen Kampagnen konnten nicht geladen werden.",
                        java.util.List.of());
                return;
            }
            renderRecoveryOnFx(safeMessage, listed.campaigns());
        }));
    }

    private void renderRecoveryOnFx(
            String message,
            java.util.List<CampaignSnapshot> campaigns
    ) {
        if (containedRecoveryVisible) {
            desk.showContainedTransition(
                    message, campaigns, retainedCampaignForContainedRecovery());
        } else {
            desk.showRecovery(message, campaigns, durableActivation.campaign());
        }
    }

    private Optional<CampaignSnapshot> retainedCampaignForContainedRecovery() {
        return activeCampaignShell == null || activeCampaignId == null
                ? Optional.empty()
                : durableActivation.campaign()
                        .filter(campaign -> campaign.id().equals(activeCampaignId));
    }

    private void focusMeaningfulCampaignTarget(AppShell shell) {
        Platform.runLater(() -> {
            stage.requestFocus();
            shell.requestMeaningfulNavigationFocus();
        });
    }

    private CampaignActivationCoordinator requireCoordinator() {
        return Objects.requireNonNull(coordinator.get(), "Campaign coordinator is not attached");
    }

    private static void onFx(Runnable work) {
        if (Platform.isFxApplicationThread()) {
            work.run();
        } else {
            Platform.runLater(work);
        }
    }

    private static void requireFxThread() {
        if (!Platform.isFxApplicationThread()) {
            throw new IllegalStateException("Campaign root operations require the JavaFX thread");
        }
    }

    private record CampaignCatalog(CampaignListResult list, CampaignActiveResult active) {
    }
}
