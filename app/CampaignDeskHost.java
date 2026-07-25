package app;

import features.campaign.CampaignDesk;
import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignSnapshot;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Pane;
import javafx.scene.control.Tooltip;
import javafx.stage.Stage;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellTopBarSpec;
import shell.host.AppShell;

/** Production whole-root owner for Campaign selection, switching, and recovery. */
final class CampaignDeskHost implements CampaignActivationCoordinator.SwitchingHost {

    private final Stage stage;
    private final CampaignDesk desk;
    private final Scene deskScene;
    private final AtomicReference<CampaignActivationCoordinator> coordinator = new AtomicReference<>();
    private final AtomicBoolean failAfterSwap = new AtomicBoolean();
    private final AtomicBoolean startupResumeStarted = new AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicInteger startupResumeAttempts =
            new java.util.concurrent.atomic.AtomicInteger();
    private volatile CampaignActivation durableActivation = CampaignActivation.none();
    private volatile Scene activeCampaignScene;
    private volatile CampaignId activeCampaignId;
    private volatile boolean recoveryVisible;
    private volatile String recoveryMessage = "";

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
        requireFxThread();
        CampaignSnapshot safeCampaign = Objects.requireNonNull(campaign, "campaign");
        Scene qualifiedScene = Objects.requireNonNull(
                Objects.requireNonNull(shell, "shell").getScene(),
                "Prepared Campaign shell must retain its qualified Scene");
        stage.setTitle("SaltMarcher – " + safeCampaign.name());
        stage.setScene(qualifiedScene);
        activeCampaignScene = qualifiedScene;
        activeCampaignId = safeCampaign.id();
        durableActivation = new CampaignActivation(Optional.of(safeCampaign), generation);
        recoveryVisible = false;
        recoveryMessage = "";
        if (failAfterSwap.compareAndSet(true, false)) {
            showRecoveryOnFx("Die Kampagne konnte nach dem Wechsel nicht sicher angezeigt werden.");
            return CampaignActivationCoordinator.RootSwitchResult.RECOVERY_VISIBLE;
        }
        focusMeaningfulCampaignTarget(shell);
        return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
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
            showRecoveryOnFx(recoveryMessage);
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
                showRecoveryOnFx("Die andere Kampagne konnte nicht geöffnet werden. "
                        + "Die beschädigte Kampagne bleibt unverändert.");
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
            case RECOVERY_REQUIRED, RECOVERY_UNAVAILABLE -> showRecoveryOnFx(
                    "Die ausgewählte Kampagne ist nicht spielbereit. "
                            + "Daten bleiben erhalten; versuche sie erneut zu öffnen.");
            case INVALID_NAME -> desk.showError(
                    "Der Name muss sichtbaren Text enthalten.", true);
            case STALE_GENERATION -> refreshForCurrentMode(
                    "Die Kampagnenliste hat sich geändert. Wähle erneut.");
            case CAMPAIGN_NOT_FOUND -> refreshForCurrentMode(
                    "Diese Kampagne ist nicht mehr verfügbar.");
            case REGISTRY_UNAVAILABLE -> {
                if (recoveryVisible) {
                    showRecoveryOnFx("Die übrigen Kampagnen sind gerade nicht verfügbar. "
                            + "Die beschädigte Kampagne bleibt unverändert.");
                } else {
                    desk.showError(
                            "Die Kampagnenliste ist gerade nicht verfügbar. Lade sie erneut.",
                            false);
                }
            }
            case PRE_COMMIT_FAILED -> {
                if (recoveryVisible) {
                    showRecoveryOnFx("Die andere Kampagne konnte nicht geöffnet werden. "
                            + "Die beschädigte Kampagne bleibt unverändert.");
                } else {
                    desk.showError("Die Kampagne konnte nicht geöffnet werden. "
                            + "Die bisherige Kampagne bleibt erhalten.", creating);
                }
            }
            case NO_ACTIVE_CAMPAIGN -> refresh(
                    "Es ist noch keine aktuelle Kampagne ausgewählt.");
            case INVALID_GENERATION, INVALID_STATE, CLOSED -> {
                if (recoveryVisible) {
                    showRecoveryOnFx("Dieser Recovery-Wechsel ist nicht mehr gültig. "
                            + "Die beschädigte Kampagne bleibt unverändert.");
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
            case RECOVERY_REQUIRED, RECOVERY_UNAVAILABLE -> {
                if (!recoveryVisible) {
                    showRecoveryOnFx(
                            "Die aktuelle Kampagne ist nicht spielbereit. "
                                    + "Daten bleiben unverändert; versuche sie erneut zu öffnen.");
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
                && selected.isPresent()
                && activeCampaignScene != null
                && selected.orElseThrow().id().equals(activeCampaignId)) {
            stage.setTitle("SaltMarcher – " + selected.orElseThrow().name());
            stage.setScene(activeCampaignScene);
            recoveryVisible = false;
            recoveryMessage = "";
            if (activeCampaignScene.getRoot() instanceof AppShell shell) {
                focusMeaningfulCampaignTarget(shell);
            }
        }
    }

    private void refresh(String announcement) {
        refresh(announcement, null);
    }

    private void refreshForCurrentMode(String announcement) {
        if (recoveryVisible) {
            showRecoveryOnFx(announcement + " Die beschädigte Kampagne bleibt unverändert.");
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
        stage.setTitle("SaltMarcher – Kampagnen");
        stage.setScene(deskScene);
    }

    private void showRecoveryOnFx(String message) {
        requireFxThread();
        recoveryMessage = Objects.requireNonNull(message, "message");
        showDesk();
        recoveryVisible = true;
        desk.showRecovery(
                recoveryMessage,
                java.util.List.of(),
                durableActivation.campaign());
        if (coordinator.get() != null) {
            refreshRecovery(recoveryMessage);
        }
    }

    private void refreshRecovery(String message) {
        requireFxThread();
        CampaignActivationCoordinator owner = requireCoordinator();
        String safeMessage = Objects.requireNonNull(message, "message");
        owner.listCampaigns().whenComplete((listed, failure) -> onFx(() -> {
            if (!recoveryVisible) {
                return;
            }
            if (failure != null || listed.status() != CampaignListResult.Status.SUCCESS) {
                desk.showRecovery(
                        safeMessage + " Die übrigen Kampagnen konnten nicht geladen werden.",
                        java.util.List.of(),
                        durableActivation.campaign());
                return;
            }
            desk.showRecovery(
                    safeMessage,
                    listed.campaigns(),
                    durableActivation.campaign());
        }));
    }

    private void focusMeaningfulCampaignTarget(AppShell shell) {
        Platform.runLater(() -> {
            Pane navigation = shell.lookup(".nav-sidebar") instanceof Pane pane ? pane : null;
            if (navigation == null) {
                return;
            }
            Node selected = navigation.getChildrenUnmodifiable().stream()
                    .filter(ToggleButton.class::isInstance)
                    .map(ToggleButton.class::cast)
                    .filter(ToggleButton::isSelected)
                    .findFirst()
                    .orElseGet(() -> navigation.getChildrenUnmodifiable().stream()
                            .filter(ToggleButton.class::isInstance)
                            .map(ToggleButton.class::cast)
                            .findFirst()
                            .orElse(null));
            if (selected != null) {
                stage.requestFocus();
                selected.requestFocus();
                Platform.runLater(selected::requestFocus);
            }
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
