package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Pane;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.execution.DirectExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import platform.ui.DirectUiDispatcher;
import platform.ui.JavaFxUiDispatcher;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import features.sessiongeneration.api.GenerationStatus;
import features.sessionplanner.api.SessionPlannerCatalogCommand;

import shell.api.ContributionKey;
import shell.host.AppShell;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javafx.stage.Stage;

@org.junit.jupiter.api.Tag("ui")
public final class SmokeStartupTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private SmokeStartupTest() {
    }

    @AfterAll
    static void shutdownFx() throws Exception {
        runOnFx(testsupport.JavaFxRuntime::shutdown);
    }

    @Test
    void SMOKE_STARTUP_001() throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        try (AppBootstrap bootstrap = new AppBootstrap()) {
            AppShell shell = createShellOnFx(bootstrap);
            runOnFx(() -> {
                require(shell.getScene() != null, "CoreReady shell has no qualified Scene");
                shell.applyCss();
                shell.layout();
                List<ToggleButton> navigation = navigationButtons(shell);
                require(
                        navigation.stream().map(Node::getAccessibleText).toList().equals(List.of(
                                "Szenen",
                                "Session Planner",
                                "Dungeon-Editor",
                                "Dungeon-Reise",
                                "Hex-Karte",
                                "Katalog")),
                        "Expected exact explicit navigation manifest in shell order.");
                require(
                        shell.lookup(".title-large") instanceof Label title
                                && "Dungeon-Editor".equals(title.getText()),
                        "Expected Dungeon-Editor as explicit default landing.");
                require(
                        navigation.stream().filter(ToggleButton::isSelected).map(Node::getAccessibleText).toList()
                                .equals(List.of("Dungeon-Editor")),
                                "Expected only the default landing navigation entry to be"
                                    + " selected.");
                require(
                        shell.lookup(".toolbar") instanceof Pane toolbar && toolbar.getChildren().size() == 4,
                                "Expected title, spacer, and exactly two explicit top-bar"
                                    + " contributions.");
                List<String> topBarTooltips = shell.lookupAll(".toolbar .button").stream()
                        .filter(Button.class::isInstance)
                        .map(Button.class::cast)
                        .map(Button::getTooltip)
                        .filter(java.util.Objects::nonNull)
                        .map(javafx.scene.control.Tooltip::getText)
                        .sorted()
                        .toList();
                require(topBarTooltips.equals(List.of(
                                "Adventuring-Day-Rechner öffnen",
                                "Party-Panel öffnen (Alt+P)")),
                                "Expected distinct Adventuring Day and Party top-bar surfaces, but"
                                    + " was "
                                        + topBarTooltips + ".");
                assertStateTabManifest(shell, navigation);
                require(Instant.now().isBefore(deadline), "Smoke startup exceeded timeout.");
            });
        }
        openTempSqliteConnection();
    }

    @Test
    void preparesStoresBeforeWorkAndKeepsProductionCatalogReadLanesIndependent(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("startup-order.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
                StoragePreparedLane orderedLane = new StoragePreparedLane(databasePath);
                StoragePreparedLane creatureReadLane = new StoragePreparedLane(databasePath);
                StoragePreparedLane itemReadLane = new StoragePreparedLane(databasePath);
                try (AppBootstrap bootstrap = new AppBootstrap(
                        NoopDiagnostics.INSTANCE,
                        new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                        orderedLane,
                        creatureReadLane,
                        itemReadLane,
                        orderedLane,
                        orderedLane,
                        orderedLane,
                        orderedLane,
                        orderedLane,
                        orderedLane,
                        new JavaFxUiDispatcher(),
                        database)) {
                    AppShell shell = createShellOnFx(bootstrap);
                    Stage activeStage = publishActive(bootstrap, shell);
                    runOnFx(() -> {
                    require(shell.getScene() != null, "CoreReady shell has no qualified Scene");
                    require(orderedLane.executions() > 0, "Expected explicitly started service work.");
                    require(creatureReadLane.executions() == 0 && itemReadLane.executions() == 0,
                            "inactive Catalog providers performed startup reads");

                    shell.navigateTo(new ContributionKey("catalog"));
                    shell.applyCss();
                    shell.layout();
                    ToggleButton items = shell.lookupAll(".catalog-section-button").stream()
                            .filter(ToggleButton.class::isInstance)
                            .map(ToggleButton.class::cast)
                            .filter(button -> "Katalogbereich Items".equals(button.getAccessibleText()))
                            .findFirst()
                            .orElseThrow(() -> new AssertionError("Items Catalog section missing"));
                    items.fire();
                    });
                    waitForCondition(() -> creatureReadLane.executions() >= 2);
                    waitForCondition(() -> itemReadLane.executions() >= 2);
                    runOnFx(activeStage::close);
                }
        }
    }

    @Test
    void productionJavaFxStartReturnsWhilePreparationIsBlockedThenPublishesCoreReadyShell(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("async-startup.sqlite");
        GateSerialLane lane = new GateSerialLane();
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                lane,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                new JavaFxUiDispatcher(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE));
        SaltMarcherApp application = new SaltMarcherApp(bootstrap);
        AtomicReference<Stage> stage = new AtomicReference<>();

        runOnFx(() -> {
            Stage window = new Stage();
            stage.set(window);
            application.start(window);
            require(window.isShowing(), "start must show a neutral loading window immediately");
            require(!(window.getScene().getRoot() instanceof AppShell),
                    "blocked preparation published a shell from start()");
        });
        require(lane.awaitBlocked(), "owned startup lane did not receive preparation work");
        lane.release();
        waitForFxCondition(() -> stage.get().getScene().getRoot() instanceof AppShell);

        assertEquals(CampaignRuntime.State.ACTIVE, bootstrap.campaignRuntimeForTesting().state());
        SceneMutationResult created = await(bootstrap.campaignRuntimeForTesting()
                .components().scene().application().execute(new SceneCommand.Create("CoreReady durable")));
        assertEquals(SceneMutationResult.Status.SUCCESS, created.status());

        runOnFx(() -> {
            application.stop();
            stage.get().close();
        });
        await(bootstrap.termination());
        try (CampaignRuntime reopened = openRuntime(databasePath)) {
            assertTrue(await(reopened.foundationReadiness()).foundationPrepared());
            assertTrue(reopened.components().scene().model().current().scenes().stream()
                    .anyMatch(scene -> "CoreReady durable".equals(scene.title())));
        }
    }

    @Test
    void unavailableSessionGenerationIsVisibleAndDisabledWhileManualPlannerRemainsUsable(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("generation-degraded.sqlite");
        try (CampaignRuntime initial = openRuntime(databasePath)) {
            assertTrue(await(initial.foundationReadiness()).foundationPrepared());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "UPDATE sm_schema_versions SET version = 999 WHERE owner = 'session-generation'")) {
            assertEquals(1, statement.executeUpdate());
        }

        try (AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                new JavaFxUiDispatcher(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE))) {
            AppShell shell = createShellOnFx(bootstrap);
            Stage activeStage = publishActive(bootstrap, shell);
            var generationFailure = await(bootstrap.campaignRuntimeForTesting()
                    .components().generation().draft(null));
            assertEquals(GenerationStatus.STORAGE_FAILURE, generationFailure.status());
            assertTrue(generationFailure.draft().isEmpty());
            bootstrap.campaignRuntimeForTesting().components().session().application()
                    .createSession(new SessionPlannerCatalogCommand.CreateSessionCommand("Manual durable"));
            runOnFx(() -> {
                shell.navigateTo(new ContributionKey("session-planner"));
                shell.applyCss();
                shell.layout();
                Label status = (Label) shell.lookup(".session-planner-generation-status");
                require(status != null && status.isVisible()
                                && status.getText().contains("nicht verfügbar"),
                        "generation degradation must be visible in the production shell");
                Button generate = shell.lookupAll(".button").stream()
                        .filter(Button.class::isInstance)
                        .map(Button.class::cast)
                        .filter(button -> "Generieren".equals(button.getText()))
                        .findFirst().orElseThrow();
                require(generate.isDisabled(), "generation action must be disabled while its store is unavailable");
                Button manualCreate = shell.lookupAll(".button").stream()
                        .filter(Button.class::isInstance)
                        .map(Button.class::cast)
                        .filter(button -> "Neu".equals(button.getText()))
                        .findFirst().orElseThrow();
                require(!manualCreate.isDisabled(), "manual Session Planner creation must remain usable");
            });
            runOnFx(activeStage::close);
        }
        try (CampaignRuntime reopened = openRuntime(databasePath)) {
            assertTrue(await(reopened.foundationReadiness()).foundationPrepared());
            reopened.components().session().application().initialize();
            assertTrue(reopened.components().session().workspaceModel().current().catalog().sessions().stream()
                    .anyMatch(session -> "Manual durable".equals(session.displayName())));
        }
    }

    @Test
    void preparedShellQualificationRejectsActualUnboundShellAndCompletesTerminalStage(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        try (CampaignRuntime runtime = openRuntime(
                temporaryDirectory.resolve("qualification-rejected.sqlite"))) {
            assertTrue(await(runtime.foundationReadiness()).foundationPrepared());
            runOnFx(() -> {
                AppShell unbound = new AppShell(NoopDiagnostics.INSTANCE);
                Scene candidate = new Scene(unbound, 1_150, 700);
                unbound.applyCss();
                unbound.layout();
                assertThrows(IllegalStateException.class,
                        () -> runtime.prepareBoundShell(unbound, candidate));
            });
            assertTrue(runtime.preparedReadiness().toCompletableFuture().isCompletedExceptionally());
            assertEquals(CampaignRuntime.State.FAILED, runtime.state());
        }
    }

    @Test
    void preparedCandidateRejectsMutationUntilVisibleActivationAtomicallyReopensAdmission(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("prepared-admission.sqlite");
        try (AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                new JavaFxUiDispatcher(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE))) {
            AppShell shell = createShellOnFx(bootstrap);
            CampaignRuntime runtime = bootstrap.campaignRuntimeForTesting();
            CampaignRuntime.PreparedReadiness prepared = await(runtime.preparedReadiness());
            assertTrue(prepared.ready());
            assertTrue(prepared.survivors().focusedSceneReadable());
            assertTrue(prepared.survivors().encounterStateReadable());
            assertTrue(prepared.survivors().partyReadable());
            assertTrue(prepared.survivors().travelPositionsReadable());
            assertTrue(prepared.persistenceWriteRollbackVerified());
            assertEquals(CampaignRuntime.State.PREPARED, runtime.state());
            assertTrue(shell.isDisabled());
            assertEquals(SceneMutationResult.Status.STORAGE_ERROR,
                    await(runtime.components().scene().application().execute(
                            new SceneCommand.Create("Must not persist while prepared"))).status());

            Stage stage = publishActive(bootstrap, shell);
            assertEquals(CampaignRuntime.State.ACTIVE, runtime.state());
            assertFalse(shell.isDisabled());
            assertEquals(SceneMutationResult.Status.SUCCESS,
                    await(runtime.components().scene().application().execute(
                            new SceneCommand.Create("Persists after activation"))).status());
            runOnFx(stage::close);
        }

        try (CampaignRuntime reopened = openRuntime(databasePath)) {
            assertTrue(await(reopened.foundationReadiness()).foundationPrepared());
            assertFalse(reopened.components().scene().model().current().scenes().stream()
                    .anyMatch(scene -> "Must not persist while prepared".equals(scene.title())));
            assertTrue(reopened.components().scene().model().current().scenes().stream()
                    .anyMatch(scene -> "Persists after activation".equals(scene.title())));
        }
    }

    @Test
    void lockedWriteProbeRejectsPreparedPublicationAndNeverOpensAdmission(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("write-probe-locked.sqlite");
        try (CampaignRuntime initial = openRuntime(databasePath)) {
            assertTrue(await(initial.foundationReadiness()).foundationPrepared());
        }
        try (var lock = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var lockStatement = lock.createStatement()) {
            lockStatement.execute("BEGIN IMMEDIATE");
            CountDownLatch probeStarted = new CountDownLatch(1);
            platform.execution.ExecutionLane signalledProbeLane = new platform.execution.ExecutionLane() {
                @Override
                public void execute(Runnable work) {
                    probeStarted.countDown();
                    work.run();
                }

                @Override
                public void close() {
                }
            };
            AppBootstrap bootstrap = new AppBootstrap(
                    NoopDiagnostics.INSTANCE,
                    new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    signalledProbeLane,
                    new JavaFxUiDispatcher(),
                    new SqliteDatabase(
                            temporaryDirectory.resolve("write-probe-installation.sqlite"),
                            NoopDiagnostics.INSTANCE),
                    new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE));
            try {
                java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
                runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
                    if (failure == null) {
                        shell.complete(value);
                    } else {
                        shell.completeExceptionally(failure);
                    }
                }));
                assertTrue(probeStarted.await(10, TimeUnit.SECONDS));
                Thread.sleep(750L);
                assertFalse(shell.isDone(), "write probe must still be waiting on the held SQL lock");
                java.util.concurrent.CompletableFuture<Void> pulse = new java.util.concurrent.CompletableFuture<>();
                runOnFx(() -> pulse.complete(null));
                pulse.get(2, TimeUnit.SECONDS);
                assertFalse(shell.isDone(), "background write probe must not block the JavaFX pulse");
                assertThrows(java.util.concurrent.ExecutionException.class, () -> await(shell));
                assertThrows(IllegalStateException.class, bootstrap::campaignRuntimeForTesting);
            } finally {
                lockStatement.execute("ROLLBACK");
                bootstrap.close();
            }
        }
        try (CampaignRuntime reopened = openRuntime(databasePath)) {
            assertTrue(await(reopened.foundationReadiness()).foundationPrepared());
            assertFalse(reopened.preparedReadiness().toCompletableFuture().isDone());
        }
    }

    @Test
    void closeAtomicallyClaimsPreparingRuntimeAtExactShellHandoff(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("shell-handoff-close.sqlite");
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                new JavaFxUiDispatcher(),
                database);
        CountDownLatch handoffEntered = new CountDownLatch(1);
        CountDownLatch releaseHandoff = new CountDownLatch(1);
        bootstrap.installShellHandoffGateForTesting(() -> {
            handoffEntered.countDown();
            try {
                releaseHandoff.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(failure);
            }
        });
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure == null) {
                shell.complete(value);
            } else {
                shell.completeExceptionally(failure);
            }
        }));
        assertTrue(handoffEntered.await(30, TimeUnit.SECONDS));
        java.util.concurrent.CompletableFuture<Void> close =
                java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        waitForCondition(bootstrap::preparatoryUiRevokedForTesting);
        assertFalse(bootstrap.closeClaimedForTesting(),
                "close must drain the running handoff before claiming its final owner");
        assertFalse(bootstrap.termination().toCompletableFuture().isDone(),
                "termination must await settlement of the claimed shell handoff");
        releaseHandoff.countDown();

        close.get(30, TimeUnit.SECONDS);
        await(bootstrap.termination());
        assertTrue(shell.isCompletedExceptionally());
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void closeDrainsComposeBeforeClaimWhenCandidateOwnerHasNotYetBeenStaged(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("pre-stage-close.sqlite");
        ReplayableTrackedJavaFxDispatcher dispatcher = new ReplayableTrackedJavaFxDispatcher();
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
        CountDownLatch candidateOwned = new CountDownLatch(1);
        CountDownLatch releaseStage = new CountDownLatch(1);
        java.util.List<String> closeOrder = new java.util.concurrent.CopyOnWriteArrayList<>();
        bootstrap.installCampaignCloseObserverForTesting(closeOrder::add);
        bootstrap.installPreStageGateForTesting(() -> {
            candidateOwned.countDown();
            try {
                releaseStage.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError(failure);
            }
        });
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure == null) {
                shell.complete(value);
            } else {
                shell.completeExceptionally(failure);
            }
        }));
        candidateOwned.await();

        var close = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        waitForCondition(bootstrap::preparatoryUiRevokedForTesting);
        assertFalse(bootstrap.closeClaimedForTesting());
        assertFalse(close.isDone());
        releaseStage.countDown();

        close.join();
        assertEquals(List.of("catalog", "runtime"), closeOrder);
        assertTrue(shell.isCompletedExceptionally());
        assertThrows(java.sql.SQLException.class, database::prepare);
        runOnFx(dispatcher::replayTracked);
        assertEquals(List.of("catalog", "runtime"), closeOrder);
        assertThrows(IllegalStateException.class, bootstrap::campaignRuntimeForTesting);
    }

    @Test
    void closeIntentBetweenClosedRecheckAndPublishRejectsShellBeforeTermination(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("pre-publish-close.sqlite");
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                new JavaFxUiDispatcher(),
                database);
        CountDownLatch publishReady = new CountDownLatch(1);
        CountDownLatch releasePublish = new CountDownLatch(1);
        java.util.List<String> closeOrder = new java.util.concurrent.CopyOnWriteArrayList<>();
        java.util.List<String> completionOrder = new java.util.concurrent.CopyOnWriteArrayList<>();
        bootstrap.installCampaignCloseObserverForTesting(closeOrder::add);
        bootstrap.installPrePublishGateForTesting(() -> {
            publishReady.countDown();
            try {
                releasePublish.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError(failure);
            }
        });
        AtomicReference<java.util.concurrent.CompletableFuture<AppShell>> shell = new AtomicReference<>();
        runOnFx(() -> shell.set(bootstrap.createShellAsync().toCompletableFuture()));
        shell.get().whenComplete((ignored, failure) -> completionOrder.add("creation"));
        bootstrap.termination().whenComplete((ignored, failure) -> completionOrder.add("termination"));
        publishReady.await();

        var close = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        waitForCondition(bootstrap::preparatoryUiRevokedForTesting);
        assertFalse(bootstrap.closeClaimedForTesting());
        releasePublish.countDown();

        close.join();
        assertTrue(shell.get().isCompletedExceptionally());
        assertEquals(List.of("creation", "termination"), completionOrder);
        assertEquals(List.of("catalog", "runtime"), closeOrder);
        assertThrows(java.sql.SQLException.class, database::prepare);
        assertThrows(IllegalStateException.class, bootstrap::campaignRuntimeForTesting);
    }

    @Test
    void closeCancelsQueuedPostDrainFinishAndReleasesCandidateCatalogAndRuntime(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("queued-post-drain-close.sqlite");
        QueuedTrackedJavaFxDispatcher dispatcher = new QueuedTrackedJavaFxDispatcher();
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure == null) {
                shell.complete(value);
            } else {
                shell.completeExceptionally(failure);
            }
        }));
        dispatcher.firstTrackedAccepted.join();
        runOnFx(dispatcher::runNextTracked);
        dispatcher.secondTrackedAccepted.join();

        assertFalse(shell.isDone());
        bootstrap.close();

        assertTrue(shell.isCompletedExceptionally());
        assertTrue(bootstrap.termination().toCompletableFuture().isDone());
        runOnFx(dispatcher::runNextTracked);
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void closeDuringPostDrainDelegateReturnGapClosesCatalogBeforeRuntime(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("post-drain-return-gap.sqlite");
        ReturnGapTrackedJavaFxDispatcher dispatcher = new ReturnGapTrackedJavaFxDispatcher(2);
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
        java.util.List<String> closeOrder = new java.util.concurrent.CopyOnWriteArrayList<>();
        bootstrap.installCampaignCloseObserverForTesting(closeOrder::add);
        bootstrap.installPostDrainSchedulerForTesting(work -> {
            Thread thread = new Thread(work, "post-drain-submit-gap");
            thread.setDaemon(true);
            thread.start();
        });
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure == null) {
                shell.complete(value);
            } else {
                shell.completeExceptionally(failure);
            }
        }));
        dispatcher.returnGapAccepted.await();

        var close = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        while (!bootstrap.closeClaimedForTesting()) {
            Thread.onSpinWait();
        }
        close.join();

        assertEquals(List.of("catalog", "runtime"), closeOrder);
        assertTrue(shell.isCompletedExceptionally());
        assertThrows(java.sql.SQLException.class, database::prepare);
        dispatcher.releaseReturn.countDown();
        runOnFx(dispatcher::runStaleAcceptedUpdate);
    }

    @Test
    void closeCancelsQueuedVisibleActivationAndCompletesActivationStage(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("queued-activation-close.sqlite");
        QueuedTrackedJavaFxDispatcher dispatcher = new QueuedTrackedJavaFxDispatcher();
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure == null) {
                shell.complete(value);
            } else {
                shell.completeExceptionally(failure);
            }
        }));
        dispatcher.firstTrackedAccepted.join();
        runOnFx(dispatcher::runNextTracked);
        dispatcher.secondTrackedAccepted.join();
        runOnFx(dispatcher::runNextTracked);
        AppShell prepared = await(shell);
        AtomicReference<Stage> window = new AtomicReference<>();
        java.util.concurrent.CompletableFuture<Void> activation = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> {
            Stage stage = new Stage();
            window.set(stage);
            stage.setScene(new Scene(new Pane(), 1_150, 700));
            stage.show();
            bootstrap.publishAndActivateShell(prepared, () -> stage.setScene(prepared.getScene()))
                    .whenComplete((ignored, failure) -> {
                        if (failure == null) {
                            activation.complete(null);
                        } else {
                            activation.completeExceptionally(failure);
                        }
                    });
        });
        dispatcher.thirdTrackedAccepted.join();

        assertFalse(activation.isDone());
        bootstrap.close();

        assertTrue(activation.isCompletedExceptionally());
        runOnFx(dispatcher::runNextTracked);
        runOnFx(window.get()::close);
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void activationFailurePrecedesTerminationDuringDelegateReturnGap(
            @TempDir Path temporaryDirectory
    ) throws Exception {
        Path databasePath = temporaryDirectory.resolve("activation-return-gap.sqlite");
        ReturnGapTrackedJavaFxDispatcher dispatcher = new ReturnGapTrackedJavaFxDispatcher(3);
        SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                dispatcher,
                database);
        java.util.List<String> completionOrder = new java.util.concurrent.CopyOnWriteArrayList<>();
        AtomicReference<java.util.concurrent.CompletionStage<Void>> activationStage = new AtomicReference<>();
        bootstrap.installActivationStageObserverForTesting(stage -> {
            activationStage.set(stage);
            stage.whenComplete((ignored, failure) -> completionOrder.add("activation"));
        });
        bootstrap.termination().whenComplete((ignored, failure) -> completionOrder.add("termination"));
        AppShell prepared = createShellOnFx(bootstrap);
        AtomicReference<Stage> window = new AtomicReference<>();
        java.util.concurrent.CompletableFuture<Void> publicationReturned =
                new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> {
            Stage stage = new Stage();
            window.set(stage);
            stage.setScene(new Scene(new Pane(), 1_150, 700));
            stage.show();
            Platform.runLater(() -> {
                bootstrap.publishAndActivateShell(prepared, () -> stage.setScene(prepared.getScene()));
                publicationReturned.complete(null);
            });
        });
        dispatcher.returnGapAccepted.await();

        var close = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        close.join();

        assertTrue(activationStage.get().toCompletableFuture().isCompletedExceptionally());
        assertEquals(List.of("activation", "termination"), completionOrder);
        assertThrows(java.sql.SQLException.class, database::prepare);
        dispatcher.releaseReturn.countDown();
        publicationReturned.join();
        runOnFx(dispatcher::runStaleAcceptedUpdate);
        runOnFx(window.get()::close);
    }

    private static CampaignRuntime openRuntime(Path databasePath) {
        InstallationRuntime installation = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE,
                new SqliteDatabase(
                        databasePath.resolveSibling(databasePath.getFileName() + ".installation.sqlite"),
                        NoopDiagnostics.INSTANCE));
        CampaignRuntime runtime = CampaignRuntime.open(
                NoopDiagnostics.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                installation.references(),
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE));
        runtime.quiescence().whenComplete((ignored, failure) -> installation.close());
        return runtime;
    }

    private static <T> T await(java.util.concurrent.CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static void waitForFxCondition(java.util.function.BooleanSupplier condition) throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        while (Instant.now().isBefore(deadline)) {
            AtomicReference<Boolean> satisfied = new AtomicReference<>(false);
            runOnFx(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            Thread.sleep(20L);
        }
        throw new IllegalStateException("Timed out waiting for JavaFX shell publication");
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        if (Platform.isFxApplicationThread()) {
            action.run();
            return;
        }
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                completed.countDown();
            }
        });
        if (!completed.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX smoke startup work.");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new IllegalStateException("JavaFX smoke startup work failed.", thrown);
        }
    }

    private static AppShell createShellOnFx(AppBootstrap bootstrap) throws Exception {
        java.util.concurrent.CompletableFuture<AppShell> shell = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> bootstrap.createShellAsync().whenComplete((value, failure) -> {
            if (failure != null) {
                shell.completeExceptionally(failure);
            } else {
                shell.complete(value);
            }
        }));
        return await(shell);
    }

    private static Stage publishActive(AppBootstrap bootstrap, AppShell shell) throws Exception {
        AtomicReference<Stage> stage = new AtomicReference<>();
        java.util.concurrent.CompletableFuture<Void> activated = new java.util.concurrent.CompletableFuture<>();
        runOnFx(() -> {
            Stage window = new Stage();
            stage.set(window);
            window.setScene(new Scene(new Pane(), 1_150, 700));
            window.show();
            bootstrap.publishAndActivateShell(shell, () -> window.setScene(shell.getScene()))
                    .whenComplete((ignored, failure) -> {
                        if (failure == null) {
                            activated.complete(null);
                        } else {
                            activated.completeExceptionally(failure);
                        }
                    });
        });
        await(activated);
        return stage.get();
    }

    private static void waitForCondition(java.util.function.BooleanSupplier condition) throws Exception {
        Instant deadline = Instant.now().plus(TIMEOUT);
        while (Instant.now().isBefore(deadline)) {
            if (condition.getAsBoolean()) {
                return;
            }
            Thread.sleep(20L);
        }
        throw new IllegalStateException("Timed out waiting for asynchronous startup work");
    }

    private static List<ToggleButton> navigationButtons(AppShell shell) {
        require(shell.lookup(".nav-sidebar") instanceof Pane, "Expected public navigation sidebar surface.");
        Pane sidebar = (Pane) shell.lookup(".nav-sidebar");
        return sidebar.getChildrenUnmodifiable().stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
    }

    private static void assertStateTabManifest(AppShell shell, List<ToggleButton> navigation) {
        require(navigation.stream().anyMatch(button -> "Katalog".equals(button.getAccessibleText())),
                "Katalog navigation entry missing.");
        shell.navigateTo(new ContributionKey("catalog"));
        shell.applyCss();
        shell.layout();
        List<String> stateTabs = shell.lookupAll(".scene-tab").stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .sorted(Comparator.comparingDouble(button ->
                        button.localToScene(button.getBoundsInLocal()).getMinX()))
                .map(ToggleButton::getText)
                .toList();
        require(stateTabs.equals(List.of("Encounter", "Reise")),
                "Expected exact explicit state-tab manifest in shell order, but was " + stateTabs + ".");
    }

    private static void openTempSqliteConnection() throws Exception {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        require(xdgDataHome != null && !xdgDataHome.isBlank(), "XDG_DATA_HOME must point at a temp dir.");
        Path database = Path.of(xdgDataHome, "salt-marcher", "game.db").toAbsolutePath().normalize();
        Files.createDirectories(database.getParent());
        try (SqliteDatabase lifecycle = new SqliteDatabase(database, NoopDiagnostics.INSTANCE);
             var connection = TestFeatureStores.store(
                     lifecycle, FeatureStoreDefinition.of("smoke")).openConnection();
             var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("PRAGMA integrity_check")) {
                require(result.next() && "ok".equalsIgnoreCase(result.getString(1)), "SQLite integrity check failed.");
            }
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException(message);
        }
    }

    private static final class StoragePreparedLane implements ExecutionLane {

        private static final Set<String> EXPECTED_OWNERS = Set.of(
                "campaign-registry",
                "creatures",
                "dungeon",
                "encounter",
                "encounter-table",
                "hex",
                "items",
                "party",
                "scene",
                "session-generation",
                "session-planner",
                "world-planner");

        private final Path databasePath;
        private final java.util.concurrent.atomic.AtomicInteger executions =
                new java.util.concurrent.atomic.AtomicInteger();
        private final ExecutorService executor = Executors.newSingleThreadExecutor();

        private StoragePreparedLane(Path databasePath) {
            this.databasePath = databasePath;
        }

        @Override
        public void execute(Runnable work) {
            executor.execute(() -> {
                assertAllStoresPrepared();
                executions.incrementAndGet();
                work.run();
            });
        }

        private int executions() {
            return executions.get();
        }

        private void assertAllStoresPrepared() {
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement();
                    var result = statement.executeQuery("SELECT owner FROM sm_schema_versions")) {
                java.util.HashSet<String> actual = new java.util.HashSet<>();
                while (result.next()) {
                    actual.add(result.getString(1));
                }
                require(
                        actual.equals(EXPECTED_OWNERS),
                        "Service work started before all feature stores were prepared: " + actual);
            } catch (java.sql.SQLException exception) {
                throw new IllegalStateException("Service work started before storage preparation.", exception);
            }
        }

        @Override
        public void close() {
            executor.shutdown();
            try {
                require(executor.awaitTermination(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS),
                        "storage proof lane did not terminate");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(exception);
            }
        }
    }

    private static final class GateSerialLane implements ExecutionLane {

        private final CountDownLatch blocked = new CountDownLatch(1);
        private final CountDownLatch released = new CountDownLatch(1);
        private final ExecutorService executor = Executors.newSingleThreadExecutor();

        @Override
        public void execute(Runnable work) {
            executor.execute(() -> {
                blocked.countDown();
                try {
                    released.await();
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    return;
                }
                work.run();
            });
        }

        private boolean awaitBlocked() throws InterruptedException {
            return blocked.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        }

        private void release() {
            released.countDown();
        }

        @Override
        public void close() {
            released.countDown();
            executor.shutdown();
            try {
                require(executor.awaitTermination(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS),
                        "startup lane did not terminate");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted closing startup lane", exception);
            }
        }
    }

    private static final class QueuedTrackedJavaFxDispatcher implements platform.ui.UiDispatcher {
        private final JavaFxUiDispatcher delegate = new JavaFxUiDispatcher();
        private final java.util.ArrayDeque<Runnable> tracked = new java.util.ArrayDeque<>();
        private final java.util.concurrent.CompletableFuture<Void> firstTrackedAccepted =
                new java.util.concurrent.CompletableFuture<>();
        private final java.util.concurrent.CompletableFuture<Void> secondTrackedAccepted =
                new java.util.concurrent.CompletableFuture<>();
        private final java.util.concurrent.CompletableFuture<Void> thirdTrackedAccepted =
                new java.util.concurrent.CompletableFuture<>();
        private int trackedCount;

        @Override
        public void dispatch(Runnable update) {
            if (!isTrackedSubmission()) {
                delegate.dispatch(update);
                return;
            }
            synchronized (this) {
                tracked.addLast(update);
                trackedCount++;
                if (trackedCount == 1) {
                    firstTrackedAccepted.complete(null);
                } else if (trackedCount == 2) {
                    secondTrackedAccepted.complete(null);
                } else if (trackedCount == 3) {
                    thirdTrackedAccepted.complete(null);
                }
            }
        }

        synchronized void runNextTracked() {
            tracked.removeFirst().run();
        }

        private static boolean isTrackedSubmission() {
            return StackWalker.getInstance().walk(frames -> frames.anyMatch(frame ->
                    frame.getClassName().equals(RevocableUiDispatcher.class.getName())
                            && frame.getMethodName().equals("dispatchTracked")));
        }
    }

    private static final class ReplayableTrackedJavaFxDispatcher implements platform.ui.UiDispatcher {
        private final JavaFxUiDispatcher delegate = new JavaFxUiDispatcher();
        private volatile Runnable tracked;

        @Override
        public void dispatch(Runnable update) {
            if (isTrackedSubmission()) {
                tracked = update;
            }
            delegate.dispatch(update);
        }

        void replayTracked() {
            tracked.run();
        }

        private static boolean isTrackedSubmission() {
            return StackWalker.getInstance().walk(frames -> frames.anyMatch(frame ->
                    frame.getClassName().equals(RevocableUiDispatcher.class.getName())
                            && frame.getMethodName().equals("dispatchTracked")));
        }
    }

    private static final class ReturnGapTrackedJavaFxDispatcher implements platform.ui.UiDispatcher {
        private final JavaFxUiDispatcher delegate = new JavaFxUiDispatcher();
        private final int gapAtTrackedSubmission;
        private final CountDownLatch returnGapAccepted = new CountDownLatch(1);
        private final CountDownLatch releaseReturn = new CountDownLatch(1);
        private int trackedCount;
        private volatile Runnable staleAcceptedUpdate;

        private ReturnGapTrackedJavaFxDispatcher(int gapAtTrackedSubmission) {
            this.gapAtTrackedSubmission = gapAtTrackedSubmission;
        }

        @Override
        public synchronized void dispatch(Runnable update) {
            if (!isTrackedSubmission()) {
                delegate.dispatch(update);
                return;
            }
            trackedCount++;
            if (trackedCount != gapAtTrackedSubmission) {
                delegate.dispatch(update);
                return;
            }
            staleAcceptedUpdate = update;
            returnGapAccepted.countDown();
            try {
                releaseReturn.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                throw new AssertionError(failure);
            }
        }

        void runStaleAcceptedUpdate() {
            staleAcceptedUpdate.run();
        }

        private static boolean isTrackedSubmission() {
            return StackWalker.getInstance().walk(frames -> frames.anyMatch(frame ->
                    frame.getClassName().equals(RevocableUiDispatcher.class.getName())
                            && frame.getMethodName().equals("dispatchTracked")));
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
