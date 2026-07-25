package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignId;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationStatus;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.layout.Pane;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.JavaFxUiDispatcher;
import shell.host.AppShell;

@org.junit.jupiter.api.Tag("ui")
public final class CampaignRuntimeProductionJourneyTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    @TempDir
    Path temporaryDirectory;

    @AfterAll
    static void shutdownFx() throws Exception {
        runOnFx(testsupport.JavaFxRuntime::shutdown);
    }

    @Test
    void nameOnlyCampaignsSwitchWholeProductionGraphsAndRestartExactDurablePath()
            throws Exception {
        runOnFx(() -> { });
        Path installationPath = temporaryDirectory.resolve("installation.sqlite");
        Path campaignRoot = temporaryDirectory.resolve("campaigns");
        CampaignId alphaId;
        CampaignId betaId;
        Path betaPath;

        ProductionHostHarness firstPublisher = new ProductionHostHarness();
        try (AppBootstrap bootstrap = bootstrap(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, firstPublisher));

            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status(), alpha::toString);
            firstPublisher.pulseActiveLayout();
            alphaId = alpha.durableActivation().orElseThrow().campaign().orElseThrow().id();
            Path alphaPath = alpha.campaignPath().orElseThrow();
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Alpha", 11L, 101L);

            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            betaId = beta.durableActivation().orElseThrow().campaign().orElseThrow().id();
            betaPath = beta.campaignPath().orElseThrow();
            assertNotEquals(alphaId, betaId);
            assertNotEquals(alphaPath, betaPath);
            assertTrue(Files.isRegularFile(alphaPath));
            assertTrue(Files.isRegularFile(betaPath));
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Beta", 22L, 202L);

            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(alphaId, 2L)).status());
            assertCampaignState(coordinator.activeRuntimeForTesting(), "Alpha", 11L, 101L);

            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(betaId, 3L)).status());
            assertCampaignState(coordinator.activeRuntimeForTesting(), "Beta", 22L, 202L);
            assertEquals(betaPath, coordinator.snapshot().campaignPath().orElseThrow());
            firstPublisher.closeWindow();
        }

        ProductionHostHarness restartedPublisher = new ProductionHostHarness();
        try (AppBootstrap restarted = bootstrap(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedPublisher));
            var resumed = await(coordinator.resumeDurableActive());

            assertEquals(CampaignActivationCoordinator.Status.RESUMED, resumed.status());
            assertEquals(betaId, resumed.durableActivation().orElseThrow().campaign().orElseThrow().id());
            assertEquals(betaPath, resumed.campaignPath().orElseThrow());
            assertCampaignState(coordinator.activeRuntimeForTesting(), "Beta", 22L, 202L);

            SceneMutationResult next = await(coordinator.activeRuntimeForTesting()
                    .components().scene().application().execute(
                            new SceneCommand.Create("Beta next durable mutation")));
            assertEquals(SceneMutationResult.Status.SUCCESS, next.status());
            assertTrue(coordinator.activeRuntimeForTesting().components().scene().model().current()
                    .scenes().stream().anyMatch(scene ->
                            "Beta next durable mutation".equals(scene.title())));
            restartedPublisher.closeWindow();
        }
    }

    @Test
    void campaignDeskCreatesListsAndImmediatelySwitchesWholeProductionCampaigns()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("campaign-desk-production");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        CampaignId alphaId;

        ProductionHostHarness host = new ProductionHostHarness();
        try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, host));
            host.attach(coordinator);
            awaitFxCondition(() -> campaignNameField(host.window()) != null
                    && !campaignNameField(host.window()).isDisabled());

            submitCampaignName(host.window(), "Alpha");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            alphaId = coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Alpha desk", 31L, 301L);

            openCampaignDeskWithKeyboard(host.window(), host.production);
            awaitFxCondition(() -> campaignNameField(host.window()) != null
                    && !campaignNameField(host.window()).isDisabled());
            assertEquals("", campaignNameField(host.window()).getText(),
                    "confirmed activation clears the create name only after success");
            submitCampaignName(host.window(), "Beta");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().name().equals("Beta"));
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Beta desk", 32L, 302L);

            openCampaignDeskWithKeyboard(host.window(), host.production);
            awaitFxCondition(() -> campaignRow(host.window(), "Alpha") != null
                    && campaignRow(host.window(), "Beta") != null);
            runOnFx(() -> campaignRow(host.window(), "Alpha").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().id().equals(alphaId));
            assertCampaignState(coordinator.activeRuntimeForTesting(), "Alpha desk", 31L, 301L);
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application()
                            .execute(new SceneCommand.Create("Alpha desk next mutation"))).status());
        }
        host.closeWindow();

        ProductionHostHarness restartedHost = new ProductionHostHarness();
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHost));
            restartedHost.attach(coordinator);
            awaitFxCondition(() -> campaignRow(restartedHost.window(), "Alpha") != null
                    && campaignRow(restartedHost.window(), "Beta") != null);
            runOnFx(() -> campaignRow(restartedHost.window(), "Alpha").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            assertTrue(coordinator.activeRuntimeForTesting().components().scene().model().current()
                    .scenes().stream().anyMatch(scene ->
                            "Alpha desk next mutation".equals(scene.title())));
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application()
                            .execute(new SceneCommand.Create("Restart next mutation"))).status());
        }
        restartedHost.closeWindow();
    }

    @Test
    void saltMarcherAppResumesDurableCampaignExactlyOnceBeforeInteractiveDesk()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("app-auto-resume");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");

        AppBootstrap firstBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp firstApplication = new SaltMarcherApp(firstBootstrap, campaignRoot);
        Stage firstWindow = startApplication(firstApplication);
        awaitFxCondition(() -> campaignNameField(firstWindow) != null
                && !campaignNameField(firstWindow).isDisabled());
        assertEquals(1, firstApplication.campaignHostForTesting()
                .startupResumeAttemptsForTesting());
        submitCampaignName(firstWindow, "Auto resume");
        awaitActiveRuntime(firstBootstrap);
        mutateAndAssert(firstBootstrap.campaignRuntimeForTesting(), "Auto resume", 41L, 401L);
        stopApplication(firstApplication, firstBootstrap, firstWindow);

        AppBootstrap restartedBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp restartedApplication = new SaltMarcherApp(
                restartedBootstrap, campaignRoot);
        Stage restartedWindow = startApplication(restartedApplication);
        awaitShellWithoutInteractiveDesk(restartedWindow);
        awaitActiveRuntime(restartedBootstrap);

        assertEquals(1, restartedApplication.campaignHostForTesting()
                .startupResumeAttemptsForTesting());
        assertCampaignState(
                restartedBootstrap.campaignRuntimeForTesting(), "Auto resume", 41L, 401L);
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(restartedBootstrap.campaignRuntimeForTesting().components().scene()
                        .application().execute(
                                new SceneCommand.Create("Automatic resume next mutation"))).status());
        stopApplication(restartedApplication, restartedBootstrap, restartedWindow);
    }

    @Test
    void saltMarcherAppAutomaticallyShowsRecoveryForDamagedDurableCampaignWithoutMutation()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("app-damaged-auto-recovery");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");

        AppBootstrap firstBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp firstApplication = new SaltMarcherApp(firstBootstrap, campaignRoot);
        Stage firstWindow = startApplication(firstApplication);
        awaitFxCondition(() -> campaignNameField(firstWindow) != null
                && !campaignNameField(firstWindow).isDisabled());
        submitCampaignName(firstWindow, "Damaged resume");
        awaitActiveRuntime(firstBootstrap);
        Path campaignPath;
        try (var paths = Files.walk(campaignRoot)) {
            campaignPath = paths.filter(path -> "campaign.sqlite".equals(
                            String.valueOf(path.getFileName())))
                    .findFirst().orElseThrow();
        }
        stopApplication(firstApplication, firstBootstrap, firstWindow);

        byte[] damaged = "damaged-durable-campaign".getBytes(
                java.nio.charset.StandardCharsets.UTF_8);
        Files.write(campaignPath, damaged);
        AppBootstrap restartedBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp restartedApplication = new SaltMarcherApp(
                restartedBootstrap, campaignRoot);
        Stage restartedWindow = startApplication(restartedApplication);
        awaitFxCondition(() -> restartedApplication.campaignHostForTesting()
                        .deskVisibleForTesting()
                && restartedWindow.getScene().getRoot().lookupAll(".button").stream()
                        .filter(javafx.scene.control.Button.class::isInstance)
                        .map(javafx.scene.control.Button.class::cast)
                        .anyMatch(button -> button.isVisible()
                                && "Aktuelle Kampagne erneut öffnen".equals(button.getText())));

        assertEquals(1, restartedApplication.campaignHostForTesting()
                .startupResumeAttemptsForTesting());
        assertArrayEquals(damaged, Files.readAllBytes(campaignPath));
        stopApplication(restartedApplication, restartedBootstrap, restartedWindow);
        assertArrayEquals(damaged, Files.readAllBytes(campaignPath));
    }

    @Test
    void recoveryCanOpenHealthyRegisteredCampaignWithoutTouchingDamagedBytes()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("app-recovery-alternative");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        Path healthyPath;
        Path damagedPath;

        ProductionHostHarness seedHost = new ProductionHostHarness();
        try (AppBootstrap seed = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    seed.openCampaignActivationAsync(campaignRoot, seedHost));
            CampaignActivationCoordinator.Result healthy = await(
                    coordinator.create("Healthy", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, healthy.status());
            healthyPath = healthy.campaignPath().orElseThrow();
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Healthy seed", 51L, 501L);

            CampaignActivationCoordinator.Result damaged = await(
                    coordinator.create("Damaged", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, damaged.status());
            damagedPath = damaged.campaignPath().orElseThrow();
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Damaged seed", 52L, 502L);
            seedHost.closeWindow();
        }

        byte[] damagedBytes = "damaged-campaign-must-remain-byte-exact".getBytes(
                java.nio.charset.StandardCharsets.UTF_8);
        Files.write(damagedPath, damagedBytes);
        byte[] healthyBeforeRecovery = Files.readAllBytes(healthyPath);

        AppBootstrap recoveryBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp recoveryApplication = new SaltMarcherApp(
                recoveryBootstrap, campaignRoot);
        Stage recoveryWindow = startApplication(recoveryApplication);
        awaitFxCondition(() -> campaignRow(recoveryWindow, "Healthy") != null
                && campaignRow(recoveryWindow, "Damaged") != null
                && campaignRow(recoveryWindow, "Damaged").isDisabled());
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        assertTrue(campaignRow(recoveryWindow, "Healthy").getAccessibleText()
                .contains("stattdessen öffnen"));

        runOnFx(() -> campaignRow(recoveryWindow, "Healthy").fire());
        awaitShellWithoutInteractiveDesk(recoveryWindow);
        awaitActiveRuntime(recoveryBootstrap);
        assertCampaignState(
                recoveryBootstrap.campaignRuntimeForTesting(), "Healthy seed", 51L, 501L);
        mutateExistingPartyAndAssert(
                recoveryBootstrap.campaignRuntimeForTesting(), "Healthy recovered", 53L, 503L);
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        assertFalse(java.util.Arrays.equals(
                healthyBeforeRecovery, Files.readAllBytes(healthyPath)));
        stopApplication(recoveryApplication, recoveryBootstrap, recoveryWindow);
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));

        AppBootstrap restartBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp restartApplication = new SaltMarcherApp(restartBootstrap, campaignRoot);
        Stage restartWindow = startApplication(restartApplication);
        awaitShellWithoutInteractiveDesk(restartWindow);
        awaitActiveRuntime(restartBootstrap);
        assertCampaignState(
                restartBootstrap.campaignRuntimeForTesting(), "Healthy recovered", 53L, 503L);
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        stopApplication(restartApplication, restartBootstrap, restartWindow);
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
    }

    @Test
    void saltMarcherAppFailsClosedAndVisibleWhenInstallationRegistryCannotOpen()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("app-registry-error");
        Files.createDirectories(caseRoot);
        Path installationPath = caseRoot.resolve("installation.sqlite");
        byte[] damagedRegistry = "not-a-sqlite-registry".getBytes(
                java.nio.charset.StandardCharsets.UTF_8);
        Files.write(installationPath, damagedRegistry);
        AppBootstrap bootstrap = bootstrapAt(installationPath);
        SaltMarcherApp application = new SaltMarcherApp(
                bootstrap, caseRoot.resolve("campaigns"));
        Stage window = startApplication(application);
        awaitFxCondition(() -> application.campaignHostForTesting().deskVisibleForTesting()
                && window.getScene().getRoot().lookup(".campaign-desk-status")
                        instanceof javafx.scene.control.Label status
                && status.getText().contains("konnte nicht vorbereitet"));

        assertEquals(0, application.campaignHostForTesting().startupResumeAttemptsForTesting());
        assertFalse(window.getScene().getRoot() instanceof AppShell);
        stopApplication(application, bootstrap, window);
    }

    @Test
    void stalePreCommitResumesPriorAndPostCommitFailureRequiresRollForward()
            throws Exception {
        runOnFx(() -> { });
        Path installationPath = temporaryDirectory.resolve("failure-installation.sqlite");
        ProductionHostHarness publisher = new ProductionHostHarness();
        try (AppBootstrap bootstrap = bootstrap(installationPath)) {
            CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                    temporaryDirectory.resolve("failure-campaigns"), publisher));
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status(), alpha::toString);
            CampaignRuntime alphaRuntime = coordinator.activeRuntimeForTesting();
            CampaignRuntime.Components alphaComponents = alphaRuntime.components();

            var stale = await(coordinator.create("Stale", 0L));
            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION, stale.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(alpha.durableActivation(), coordinator.snapshot().durableActivation());
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(alphaComponents.scene().application().execute(
                            new SceneCommand.Create("Prior resumed after stale commit"))).status());

            publisher.failAfterRootSwap();
            var postCommitFailure = await(coordinator.create("Beta", 1L));
            assertEquals(
                    CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    postCommitFailure.status());
            assertEquals(
                    CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                    coordinator.snapshot().phase());
            assertTrue(publisher.recoveryVisible(),
                    "failure after root swap must replace the partial Campaign root with recovery");
            assertEquals(2L, coordinator.snapshot().durableActivation().orElseThrow().generation());
            assertEquals(
                    SceneMutationResult.Status.STORAGE_ERROR,
                    await(alphaComponents.scene().application().execute(
                            new SceneCommand.Create("Prior authority must stay revoked"))).status());

            var recovered = await(coordinator.recoverDurableActive());
            assertEquals(CampaignActivationCoordinator.Status.RESUMED, recovered.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application().execute(
                            new SceneCommand.Create("Roll-forward mutation"))).status());
            publisher.closeWindow();
        }
    }

    @Test
    void restartNeverCreatesOrMutatesMissingTruncatedDamagedOrSymbolicCampaignStore()
            throws Exception {
        runOnFx(() -> { });
        for (StoreDamage damage : StoreDamage.values()) {
            Path caseRoot = temporaryDirectory.resolve("restart-" + damage.name().toLowerCase());
            Path installationPath = caseRoot.resolve("installation.sqlite");
            Path campaignRoot = caseRoot.resolve("campaigns");
            Path campaignPath;
            ProductionHostHarness initialHost = new ProductionHostHarness();
            try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
                CampaignActivationCoordinator coordinator = await(
                        bootstrap.openCampaignActivationAsync(campaignRoot, initialHost));
                var created = await(coordinator.create("Durable", 0L));
                assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, created.status());
                campaignPath = created.campaignPath().orElseThrow();
                initialHost.closeWindow();
            }

            byte[] damagedBytes = ("damaged-" + damage).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            Path preserved = caseRoot.resolve("preserved.sqlite");
            switch (damage) {
                case MISSING -> Files.move(campaignPath, preserved);
                case TRUNCATED -> Files.write(campaignPath, new byte[0]);
                case DAMAGED -> Files.write(campaignPath, damagedBytes);
                case SYMBOLIC -> {
                    Files.move(campaignPath, preserved);
                    Files.createSymbolicLink(campaignPath, preserved);
                }
            }

            ProductionHostHarness recoveryHost = new ProductionHostHarness();
            try (AppBootstrap restarted = bootstrapAt(installationPath)) {
                CampaignActivationCoordinator coordinator = await(
                        restarted.openCampaignActivationAsync(campaignRoot, recoveryHost));
                var resumed = await(coordinator.resumeDurableActive());
                assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, resumed.status(),
                        damage::name);
                assertTrue(recoveryHost.recoveryVisible(), damage::name);
                recoveryHost.closeWindow();
            }

            switch (damage) {
                case MISSING -> {
                    assertFalse(Files.exists(campaignPath));
                    assertTrue(Files.isRegularFile(preserved));
                }
                case TRUNCATED -> assertEquals(0L, Files.size(campaignPath));
                case DAMAGED -> assertArrayEquals(damagedBytes, Files.readAllBytes(campaignPath));
                case SYMBOLIC -> {
                    assertTrue(Files.isSymbolicLink(campaignPath));
                    assertTrue(Files.isRegularFile(preserved));
                }
            }
        }
    }

    @Test
    void switchingToDamagedExistingCampaignKeepsPriorActiveAndPreservesTargetBytes()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("damaged-switch");
        ProductionHostHarness host = new ProductionHostHarness();
        try (AppBootstrap bootstrap = bootstrapAt(caseRoot.resolve("installation.sqlite"))) {
            CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                    caseRoot.resolve("campaigns"), host));
            var alpha = await(coordinator.create("Alpha", 0L));
            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            CampaignRuntime betaRuntime = coordinator.activeRuntimeForTesting();
            Path alphaPath = alpha.campaignPath().orElseThrow();
            byte[] damaged = "damaged-switch-store".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            Files.write(alphaPath, damaged);

            var switched = await(coordinator.switchTo(
                    alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(), 2L));

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED, switched.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(beta.durableActivation(), coordinator.snapshot().durableActivation());
            assertEquals(betaRuntime, coordinator.activeRuntimeForTesting());
            assertArrayEquals(damaged, Files.readAllBytes(alphaPath));
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(betaRuntime.components().scene().application().execute(
                            new SceneCommand.Create("Prior stays writable"))).status());
            host.closeWindow();
        }
    }

    @Test
    void bootstrapRetriesCoordinatorCloseBeforeReleasingInstallationOwnership() throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("bootstrap-close-retry");
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(caseRoot.resolve("installation.sqlite"));
        AtomicInteger runtimeCloseFailures = new AtomicInteger();
        bootstrap.installCampaignCloseObserverForTesting(part -> {
            if ("runtime".equals(part) && runtimeCloseFailures.incrementAndGet() <= 2) {
                throw new IllegalStateException("injected bootstrap coordinator close failure");
            }
        });
        CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                caseRoot.resolve("campaigns"), host));
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Alpha", 0L)).status());

        bootstrap.close();
        assertTrue(bootstrap.termination().toCompletableFuture().isDone());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());
        assertEquals(3, runtimeCloseFailures.get());
        host.closeWindow();
    }

    @Test
    void bootstrapAutomaticallyRetriggersSynchronousTerminalCandidateCloseFailures()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("bootstrap-sync-close-retrigger");
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(caseRoot.resolve("installation.sqlite"));
        AtomicInteger runtimeCloseAttempts = new AtomicInteger();
        bootstrap.installCampaignCloseObserverForTesting(part -> {
            if ("runtime".equals(part) && runtimeCloseAttempts.incrementAndGet() <= 4) {
                throw new IllegalStateException("injected synchronous terminal close failure");
            }
        });
        CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                caseRoot.resolve("campaigns"), host));
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Alpha", 0L)).status());

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);
        assertTrue(bootstrap.campaignActivationRetainedForTesting());
        long cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (bootstrap.campaignActivationRetainedForTesting()
                && System.nanoTime() < cleanupDeadline) {
            Thread.onSpinWait();
        }

        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertEquals(5, runtimeCloseAttempts.get());
        assertTrue(bootstrap.termination().toCompletableFuture().isCompletedExceptionally(),
                "automatic late cleanup must not rewrite the bounded close result");
        host.closeWindow();
    }

    @Test
    void bootstrapRetainsFailedCoordinatorUntilRealCandidateSettlementThenCleansItLocally()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("bootstrap-close-permanent");
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(caseRoot.resolve("installation.sqlite"));
        AtomicBoolean permanentFailure = new AtomicBoolean(true);
        AtomicInteger runtimeCloseAttempts = new AtomicInteger();
        bootstrap.installCampaignCloseObserverForTesting(part -> {
            if ("runtime".equals(part)) {
                runtimeCloseAttempts.incrementAndGet();
                if (permanentFailure.get()) {
                    throw new IllegalStateException("injected permanent close failure");
                }
            }
        });
        CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                caseRoot.resolve("campaigns"), host));
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Alpha", 0L)).status());
        coordinator.installTerminalCloseTimeoutForTesting(Duration.ofMillis(100));
        CountDownLatch workflowEntered = new CountDownLatch(1);
        AtomicBoolean releaseWorkflow = new AtomicBoolean();
        coordinator.activeRuntimeForTesting().runWorkflowForTesting(() -> {
            workflowEntered.countDown();
            while (!releaseWorkflow.get()) {
                java.util.concurrent.locks.LockSupport.parkNanos(
                        TimeUnit.MILLISECONDS.toNanos(5));
                Thread.interrupted();
            }
        });
        assertTrue(workflowEntered.await(5, TimeUnit.SECONDS));

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);
        assertTrue(bootstrap.termination().toCompletableFuture().isCompletedExceptionally());
        assertTrue(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());

        permanentFailure.set(false);
        releaseWorkflow.set(true);
        long cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (bootstrap.campaignActivationRetainedForTesting()
                && System.nanoTime() < cleanupDeadline) {
            Thread.onSpinWait();
        }
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertEquals(2, runtimeCloseAttempts.get(),
                "one initial Candidate close and exactly one daemon retry own cleanup");
        assertTrue(bootstrap.termination().toCompletableFuture().isCompletedExceptionally(),
                "late cleanup must not rewrite the bounded terminal failure");
        host.closeWindow();
    }

    @Test
    void singleBootstrapStopInterruptsLockedCommitPreservesOrphanAndRestartsCoherently()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("locked-bootstrap-stop");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(installationPath);
        bootstrap.installCampaignActivationPhaseTimeoutForTesting(Duration.ofSeconds(15));
        bootstrap.installCampaignCommitTimeoutForTesting(Duration.ofMillis(500));
        CountDownLatch commitReady = new CountDownLatch(1);
        CountDownLatch allowCommit = new CountDownLatch(1);
        bootstrap.installCampaignPreCommitGateForTesting(() -> {
            commitReady.countDown();
            try {
                allowCommit.await();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
        });
        CampaignActivationCoordinator coordinator = await(
                bootstrap.openCampaignActivationAsync(campaignRoot, host));
        CampaignActivationCoordinator.Result timedOut;
        CompletionStage<CampaignActivationCoordinator.Result> creation =
                coordinator.create("Ambiguous shutdown target", 0L);
        assertTrue(commitReady.await(20, TimeUnit.SECONDS));
        try (var lock = java.sql.DriverManager.getConnection("jdbc:sqlite:" + installationPath);
                var statement = lock.createStatement()) {
            statement.execute("BEGIN EXCLUSIVE");
            allowCommit.countDown();
            awaitRegistryOperation(bootstrap);
            timedOut = await(creation);
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    timedOut.status());
            Path orphan = timedOut.campaignPath().orElseThrow();
            assertTrue(Files.isRegularFile(orphan));

            long closeStarted = System.nanoTime();
            bootstrap.close();
            assertTrue(System.nanoTime() - closeStarted < TimeUnit.SECONDS.toNanos(12),
                    "one terminal stop must not wait for the external SQLite lock");
            assertTrue(bootstrap.termination().toCompletableFuture().isDone());
            assertTrue(bootstrap.closeExecutorShutdownForTesting());
            assertFalse(bootstrap.installationRuntimeRetainedForTesting());
            assertTrue(Files.isRegularFile(orphan),
                    "ambiguous Campaign reservation is preserved during terminal shutdown");
            statement.execute("ROLLBACK");
        }

        ProductionHostHarness restartedHost = new ProductionHostHarness();
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator restartedCoordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHost));
            var resumed = await(restartedCoordinator.resumeDurableActive());
            assertTrue(resumed.status() == CampaignActivationCoordinator.Status.NO_ACTIVE_CAMPAIGN
                    || resumed.status() == CampaignActivationCoordinator.Status.RESUMED);
            if (resumed.status() == CampaignActivationCoordinator.Status.RESUMED) {
                assertEquals(timedOut.campaignPath(), resumed.campaignPath());
            }
            assertTrue(Files.isRegularFile(timedOut.campaignPath().orElseThrow()));
            restartedHost.closeWindow();
        }
        host.closeWindow();
    }

    private AppBootstrap bootstrap(Path installationPath) {
        return bootstrapAt(installationPath);
    }

    private static void awaitRegistryOperation(AppBootstrap bootstrap) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            if (bootstrap.installationRegistryOperationActiveForTesting()) {
                return;
            }
            Thread.onSpinWait();
        }
        throw new AssertionError("Campaign commit did not reach the installation registry");
    }

    private AppBootstrap bootstrapAt(Path installationPath) {
        return new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                new JavaFxUiDispatcher(),
                new SqliteDatabase(installationPath, NoopDiagnostics.INSTANCE));
    }

    private static void mutateAndAssert(
            CampaignRuntime runtime,
            String marker,
            long mapId,
            long tileId
    ) throws Exception {
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(runtime.components().scene().application().execute(
                        new SceneCommand.Create(marker + " Scene"))).status());

        CompletableFuture<Void> filterPublished = new CompletableFuture<>();
        Runnable unsubscribe = runtime.components().encounter().poolFilters().subscribe(filters -> {
            if (marker.equals(filters.nameQuery())) {
                filterPublished.complete(null);
            }
        });
        runtime.components().encounter().application().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(filters(marker)));
        await(filterPublished);
        unsubscribe.run();

        runtime.components().party().application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft(marker + " Guide", marker, 3, 14, 16),
                MembershipState.ACTIVE));
        var moved = await(runtime.components().party().application().moveCharacters(
                new MovePartyCharactersCommand(
                        List.of(1L),
                        new PartyOverworldTravelLocationSnapshot(mapId, tileId),
                        true)));
        assertEquals(MutationStatus.SUCCESS, moved.status());
        assertCampaignState(runtime, marker, mapId, tileId);
    }

    private static void mutateExistingPartyAndAssert(
            CampaignRuntime runtime,
            String marker,
            long mapId,
            long tileId
    ) throws Exception {
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(runtime.components().scene().application().execute(
                        new SceneCommand.Create(marker + " Scene"))).status());

        CompletableFuture<Void> filterPublished = new CompletableFuture<>();
        Runnable unsubscribe = runtime.components().encounter().poolFilters().subscribe(filters -> {
            if (marker.equals(filters.nameQuery())) {
                filterPublished.complete(null);
            }
        });
        runtime.components().encounter().application().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(filters(marker)));
        await(filterPublished);
        unsubscribe.run();

        var moved = await(runtime.components().party().application().moveCharacters(
                new MovePartyCharactersCommand(
                        List.of(1L),
                        new PartyOverworldTravelLocationSnapshot(mapId, tileId),
                        true)));
        assertEquals(MutationStatus.SUCCESS, moved.status());
        assertCampaignState(runtime, marker, mapId, tileId);
    }

    private static void assertCampaignState(
            CampaignRuntime runtime,
            String marker,
            long mapId,
            long tileId
    ) {
        assertTrue(runtime.components().scene().model().current().scenes().stream()
                .anyMatch(scene -> (marker + " Scene").equals(scene.title())));
        assertEquals(marker, runtime.components().encounter().poolFilters().current().nameQuery());
        var travel = runtime.components().party().travelPositions().current();
        assertEquals(List.of(1L), travel.partyTokenCharacterIds());
        var overworld = (PartyOverworldTravelLocationSnapshot) travel.partyTokenLocation();
        assertEquals(mapId, overworld.mapId());
        assertEquals(tileId, overworld.tileId());
    }

    private static EncounterPoolFilters filters(String marker) {
        return new EncounterPoolFilters(
                marker, "", "", List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), 0L);
    }

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
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
            throw new IllegalStateException("Timed out waiting for JavaFX work");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new IllegalStateException("JavaFX work failed", thrown);
        }
    }

    private static void submitCampaignName(Stage stage, String campaignName) throws Exception {
        runOnFx(() -> {
            javafx.scene.control.TextField name = campaignNameField(stage);
            assertTrue(name != null && !name.isDisabled());
            name.setText(campaignName);
            fireKey(name, javafx.scene.input.KeyCode.ENTER, false);
        });
    }

    private static Stage startApplication(SaltMarcherApp application) throws Exception {
        AtomicReference<Stage> window = new AtomicReference<>();
        runOnFx(() -> {
            Stage stage = new Stage();
            application.start(stage);
            Platform.setImplicitExit(false);
            window.set(stage);
        });
        return window.get();
    }

    private static void stopApplication(
            SaltMarcherApp application,
            AppBootstrap bootstrap,
            Stage window
    ) throws Exception {
        runOnFx(() -> {
            application.stop();
            window.close();
        });
        await(bootstrap.termination());
    }

    private static void awaitActiveRuntime(AppBootstrap bootstrap) {
        awaitCondition(() -> {
            try {
                return bootstrap.campaignRuntimeForTesting().state()
                        == CampaignRuntime.State.ACTIVE;
            } catch (IllegalStateException notActiveYet) {
                return false;
            }
        });
    }

    private static void awaitShellWithoutInteractiveDesk(Stage stage) throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            AtomicReference<Boolean> activeShell = new AtomicReference<>(false);
            AtomicReference<Boolean> interactiveDesk = new AtomicReference<>(false);
            runOnFx(() -> {
                activeShell.set(stage.getScene().getRoot() instanceof AppShell);
                javafx.scene.control.TextField name = campaignNameField(stage);
                interactiveDesk.set(name != null && !name.isDisabled());
            });
            assertFalse(interactiveDesk.get(),
                    "durable active Campaign exposed an interactive chooser before resume");
            if (activeShell.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for automatically resumed Campaign shell");
    }

    private static void openCampaignDeskWithKeyboard(
            Stage stage,
            CampaignDeskHost campaignHost
    ) throws Exception {
        runOnFx(() -> {
            assertTrue(stage.getScene().getRoot() instanceof AppShell,
                    "Alt+K starts from the active Campaign shell");
            javafx.scene.input.KeyCodeCombination shortcut =
                    new javafx.scene.input.KeyCodeCombination(
                            javafx.scene.input.KeyCode.K,
                            javafx.scene.input.KeyCombination.ALT_DOWN);
            assertTrue(stage.getScene().getAccelerators().containsKey(shortcut),
                    "active Campaign shell must expose Alt+K selector access");
            stage.requestFocus();
            javafx.scene.robot.Robot robot = new javafx.scene.robot.Robot();
            robot.keyPress(javafx.scene.input.KeyCode.ALT);
            robot.keyPress(javafx.scene.input.KeyCode.K);
            robot.keyRelease(javafx.scene.input.KeyCode.K);
            robot.keyRelease(javafx.scene.input.KeyCode.ALT);
        });
        awaitFxCondition(campaignHost::deskVisibleForTesting);
    }

    private static void fireKey(
            javafx.event.EventTarget target,
            javafx.scene.input.KeyCode code,
            boolean alt
    ) {
        javafx.event.Event.fireEvent(target, new javafx.scene.input.KeyEvent(
                javafx.scene.input.KeyEvent.KEY_PRESSED,
                "",
                "",
                code,
                false,
                false,
                alt,
                false));
        javafx.event.Event.fireEvent(target, new javafx.scene.input.KeyEvent(
                javafx.scene.input.KeyEvent.KEY_RELEASED,
                "",
                "",
                code,
                false,
                false,
                alt,
                false));
    }

    private static javafx.scene.control.TextField campaignNameField(Stage stage) {
        return stage.getScene().lookup(".campaign-desk-name")
                instanceof javafx.scene.control.TextField field ? field : null;
    }

    private static javafx.scene.control.Button campaignRow(Stage stage, String campaignName) {
        return stage.getScene().getRoot().lookupAll(".campaign-desk-row").stream()
                .filter(javafx.scene.control.Button.class::isInstance)
                .map(javafx.scene.control.Button.class::cast)
                .filter(button -> button.getAccessibleText() != null
                        && button.getAccessibleText().contains(campaignName))
                .findFirst()
                .orElse(null);
    }

    private static void awaitFxCondition(java.util.function.BooleanSupplier condition)
            throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            AtomicBoolean satisfied = new AtomicBoolean();
            runOnFx(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for JavaFX condition");
    }

    private static void awaitCondition(java.util.function.BooleanSupplier condition) {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() >= deadline) {
                throw new AssertionError("Timed out waiting for condition");
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
    }

    private static final class ProductionHostHarness
            implements CampaignActivationCoordinator.SwitchingHost {

        private final Stage window;
        private final CampaignDeskHost production;

        private ProductionHostHarness() throws Exception {
            AtomicReference<Stage> stage = new AtomicReference<>();
            AtomicReference<CampaignDeskHost> host = new AtomicReference<>();
            runOnFx(() -> {
                Stage created = new Stage();
                CampaignDeskHost owner = new CampaignDeskHost(created);
                owner.showInitialLoading();
                created.show();
                stage.set(created);
                host.set(owner);
            });
            window = stage.get();
            production = host.get();
        }

        private void attach(CampaignActivationCoordinator coordinator) throws Exception {
            runOnFx(() -> production.attach(coordinator));
        }

        private Stage window() {
            return window;
        }

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                features.campaign.api.CampaignSnapshot campaign,
                long generation,
                AppShell shell
        ) {
            return production.switchCampaign(campaign, generation, shell);
        }

        @Override
        public CompletionStage<Void> showRecovery(
                java.util.Optional<features.campaign.api.CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType
        ) {
            return production.showRecovery(durableActivation, failureType);
        }

        @Override
        public void installSelectorAccess(AppShell shell) {
            production.installSelectorAccess(shell);
        }

        void failAfterRootSwap() {
            production.failAfterRootSwapForTesting();
        }

        boolean recoveryVisible() {
            return production.recoveryVisibleForTesting();
        }

        void pulseActiveLayout() throws Exception {
            runOnFx(() -> {
                window.getScene().getRoot().applyCss();
                window.getScene().getRoot().layout();
            });
        }

        void closeWindow() throws Exception {
            runOnFx(window::close);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private enum StoreDamage { MISSING, TRUNCATED, DAMAGED, SYMBOLIC }
}
