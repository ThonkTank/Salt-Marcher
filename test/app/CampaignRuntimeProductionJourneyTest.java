package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignId;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.EncounterStateSnapshot;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.hex.api.CreateHexMapCommand;
import features.hex.api.MoveHexPartyTokenCommand;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationStatus;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.SetPartyMembershipCommand;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
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
    private static final int WARM_SWITCH_WARMUPS = 5;
    private static final int WARM_SWITCH_SAMPLES = 100;
    private static final long ALPHA_CREATURE_ID = 9_101L;
    private static final long BETA_CREATURE_ID = 9_102L;

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
        VisibleCampaignTruth alphaTruth;
        VisibleCampaignTruth betaTruth;

        ProductionHostHarness host = new ProductionHostHarness();
        try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, host));
            seedEncounterCreatureFixtures(installationPath);
            host.attach(coordinator);
            awaitFxCondition(() -> campaignNameField(host.window()) != null
                    && !campaignNameField(host.window()).isDisabled());

            submitCampaignName(host.window(), "Alpha");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            alphaId = coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            assertUsableEmptyPrimaryScene(host.window(), "Alpha", "Alpha empty primary note");
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Alpha desk", 31L, 301L);
            alphaTruth = seedVisibleCampaignTruth(
                    coordinator.activeRuntimeForTesting(), "Alpha desk",
                    ALPHA_CREATURE_ID, "Alpha Sentinel", 17, 3, 1, -1);
            assertVisibleCampaignTruth(host.window(), alphaTruth, null);
            javafx.scene.Parent alphaRoot = currentRoot(host.window());

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
            assertUsableEmptyPrimaryScene(host.window(), "Beta", "Beta empty primary note");
            mutateAndAssert(coordinator.activeRuntimeForTesting(), "Beta desk", 32L, 302L);
            betaTruth = seedVisibleCampaignTruth(
                    coordinator.activeRuntimeForTesting(), "Beta desk",
                    BETA_CREATURE_ID, "Beta Ravager", 7, 5, -1, 1);
            assertRootReplaced(host.window(), alphaRoot);
            assertVisibleCampaignTruth(host.window(), betaTruth, alphaTruth);
            javafx.scene.Parent betaRoot = currentRoot(host.window());

            openCampaignDeskWithKeyboard(host.window(), host.production);
            awaitFxCondition(() -> campaignRow(host.window(), "Alpha") != null
                    && campaignRow(host.window(), "Beta") != null);
            runOnFx(() -> campaignRow(host.window(), "Alpha").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().id().equals(alphaId));
            assertRootReplaced(host.window(), betaRoot);
            assertVisibleCampaignTruth(host.window(), alphaTruth, betaTruth);
            long focusedSceneId = coordinator.activeRuntimeForTesting().components()
                    .scene().model().current().focusedSceneId();
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application()
                            .execute(new SceneCommand.UpdateDetails(
                                    focusedSceneId, "Alpha desk next mutation", ""))).status());
            alphaTruth = alphaTruth.withSceneTitle("Alpha desk next mutation");
            openCampaignDeskWithKeyboard(host.window(), host.production);
            awaitFxCondition(() -> campaignRow(host.window(), "Beta") != null);
            runOnFx(() -> campaignRow(host.window(), "Beta").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().name().equals("Beta"));
            assertVisibleCampaignTruth(host.window(), betaTruth, alphaTruth);
        }
        host.closeWindow();

        ProductionHostHarness restartedHost = new ProductionHostHarness();
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHost));
            restartedHost.attachAndResume(coordinator);
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().name().equals("Beta"));
            assertVisibleCampaignTruth(restartedHost.window(), betaTruth, alphaTruth);
            openCampaignDeskWithKeyboard(restartedHost.window(), restartedHost.production);
            awaitFxCondition(() -> campaignRow(restartedHost.window(), "Alpha") != null
                    && campaignRow(restartedHost.window(), "Beta") != null);
            runOnFx(() -> campaignRow(restartedHost.window(), "Alpha").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().id().equals(alphaId));
            assertVisibleCampaignTruth(restartedHost.window(), alphaTruth, betaTruth);
            assertTrue(coordinator.activeRuntimeForTesting().components().scene().model().current()
                    .scenes().stream().anyMatch(scene ->
                            "Alpha desk next mutation".equals(scene.title())));
            coordinator.activeRuntimeForTesting().components().encounter().application().applyState(
                    ApplyEncounterStateCommand.mutateHitPoints(
                            alphaTruth.encounterCombatantId(), 1, false));
            alphaTruth = alphaTruth.withCurrentHp(alphaTruth.currentHp() - 1);
            VisibleCampaignTruth expectedAfterRestartMutation = alphaTruth;
            awaitCondition(() -> combatCard(
                    coordinator.activeRuntimeForTesting(), expectedAfterRestartMutation.encounterName())
                    .map(card -> card.currentHp() == expectedAfterRestartMutation.currentHp())
                    .orElse(false));
            assertVisibleCampaignTruth(restartedHost.window(), alphaTruth, betaTruth);
        }
        restartedHost.closeWindow();
    }

    @Test
    void warmCampaignSwitchCurrentProfilePrequalificationStaysWithinCanonicalBudget()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("campaign-warm-switch-prequalification");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        ProductionHostHarness host = new ProductionHostHarness();
        try {
            try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
                CampaignActivationCoordinator coordinator = await(
                        bootstrap.openCampaignActivationAsync(campaignRoot, host));
                host.attach(coordinator);
                awaitFxCondition(() -> campaignNameField(host.window()) != null
                        && !campaignNameField(host.window()).isDisabled());

            submitCampaignName(host.window(), "Latency Alpha");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            CampaignId alphaId = coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            String alphaNote = "Latency Alpha initial";
            assertUsableEmptyPrimaryScene(host.window(), "Latency Alpha", alphaNote);

            openCampaignDeskWithKeyboard(host.window(), host.production);
            awaitFxCondition(() -> campaignNameField(host.window()) != null
                    && !campaignNameField(host.window()).isDisabled());
            submitCampaignName(host.window(), "Latency Beta");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE
                    && coordinator.snapshot().durableActivation().orElseThrow()
                            .campaign().orElseThrow().name().equals("Latency Beta"));
            CampaignId betaId = coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            String betaNote = "Latency Beta initial";
            assertUsableEmptyPrimaryScene(host.window(), "Latency Beta", betaNote);

            List<WarmSwitchSample> toAlphaSamples = new java.util.ArrayList<>();
            List<WarmSwitchSample> toBetaSamples = new java.util.ArrayList<>();
            java.util.Set<CampaignRuntime> observedRuntimes =
                    java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
            observedRuntimes.add(coordinator.activeRuntimeForTesting());
            int totalPairs = WARM_SWITCH_WARMUPS + WARM_SWITCH_SAMPLES;
            for (int index = 0; index < totalPairs; index++) {
                String nextAlphaNote = "Latency Alpha sample " + index;
                WarmSwitchSample toAlpha = measureWarmSwitchAndMutation(
                        coordinator, host, alphaId, "Latency Alpha", alphaNote, betaNote, nextAlphaNote);
                observedRuntimes.add(coordinator.activeRuntimeForTesting());
                alphaNote = nextAlphaNote;

                String nextBetaNote = "Latency Beta sample " + index;
                WarmSwitchSample toBeta = measureWarmSwitchAndMutation(
                        coordinator, host, betaId, "Latency Beta", betaNote, alphaNote, nextBetaNote);
                observedRuntimes.add(coordinator.activeRuntimeForTesting());
                betaNote = nextBetaNote;

                if (index >= WARM_SWITCH_WARMUPS) {
                    toAlphaSamples.add(toAlpha);
                    toBetaSamples.add(toBeta);
                }
            }

            assertEquals(WARM_SWITCH_SAMPLES, toAlphaSamples.size());
            assertEquals(WARM_SWITCH_SAMPLES, toBetaSamples.size());
            assertEquals(2, observedRuntimes.size(),
                    "the real production journey must retain exactly the two alternating runtimes");
            assertTrue(campaignRuntimeThreadCount() <= 60,
                    () -> "bounded active-plus-parked runtime threads: "
                            + campaignRuntimeThreadCount());
            String summary = warmSwitchSummary(toAlphaSamples, toBetaSamples);
            System.out.println(summary);
            assertTrue(p95(toAlphaSamples, WarmSwitchSample::readyAndMutationNanos)
                                <= Duration.ofSeconds(1).toNanos()
                                && p95(toBetaSamples, WarmSwitchSample::readyAndMutationNanos)
                                        <= Duration.ofSeconds(1).toNanos()
                                && p95(toAlphaSamples, WarmSwitchSample::handlerNanos)
                                        <= Duration.ofMillis(100).toNanos()
                                && p95(toBetaSamples, WarmSwitchSample::handlerNanos)
                                        <= Duration.ofMillis(100).toNanos(),
                        summary);
            }
        } finally {
            host.closeWindow();
        }
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
        seedEncounterCreatureFixtures(installationPath);
        submitCampaignName(firstWindow, "Auto resume");
        awaitActiveRuntime(firstBootstrap);
        assertUsableEmptyPrimaryScene(firstWindow, "Auto resume", "Auto resume empty primary note");
        mutateAndAssert(firstBootstrap.campaignRuntimeForTesting(), "Auto resume", 41L, 401L);
        VisibleCampaignTruth visibleTruth = seedVisibleCampaignTruth(
                firstBootstrap.campaignRuntimeForTesting(), "Auto resume",
                ALPHA_CREATURE_ID, "Alpha Sentinel", 13, 4, 2, -1);
        assertVisibleCampaignTruth(firstWindow, visibleTruth, null);
        stopApplication(firstApplication, firstBootstrap, firstWindow);

        AppBootstrap restartedBootstrap = bootstrapAt(installationPath);
        SaltMarcherApp restartedApplication = new SaltMarcherApp(
                restartedBootstrap, campaignRoot);
        Stage restartedWindow = startApplication(restartedApplication);
        awaitShellWithoutInteractiveDesk(restartedWindow);
        awaitActiveRuntime(restartedBootstrap);

        assertEquals(1, restartedApplication.campaignHostForTesting()
                .startupResumeAttemptsForTesting());
        assertVisibleCampaignTruth(restartedWindow, visibleTruth, null);
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
            AppShell alphaShell = publisher.visibleCampaignRoot();

            var stale = await(coordinator.create("Stale", 0L));
            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION, stale.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(alpha.durableActivation(), coordinator.snapshot().durableActivation());
            assertSame(alphaShell, publisher.visibleCampaignRoot(),
                    "definite pre-commit rejection keeps the attached production shell");
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
            AppShell retainedBetaShell = publisher.lastSwitchedShell();
            assertEquals(2L, coordinator.snapshot().durableActivation().orElseThrow().generation());
            assertEquals(
                    SceneMutationResult.Status.STORAGE_ERROR,
                    await(alphaComponents.scene().application().execute(
                            new SceneCommand.Create("Prior authority must stay revoked"))).status());

            var recovered = await(coordinator.recoverDurableActive());
            assertEquals(CampaignActivationCoordinator.Status.RESUMED, recovered.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertSame(retainedBetaShell, publisher.visibleCampaignRoot(),
                    "confirmed durable recovery must republish the exact retained shell");
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application().execute(
                            new SceneCommand.Create("Roll-forward mutation"))).status());
            publisher.closeWindow();
        }
    }

    @Test
    void productionCandidateContainedTimeoutsRestoreOnlyTheRootActuallyLost()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("production-contained-context");
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrap(caseRoot.resolve("installation.sqlite"));
        try (bootstrap) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(caseRoot.resolve("campaigns"), host));
            host.attach(coordinator);
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status());
            bootstrap.installCampaignActivationPhaseTimeoutForTesting(Duration.ofSeconds(2));
            AppShell attachedAlpha = host.visibleCampaignRoot();
            CampaignId alphaId = alpha.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            java.util.Map<javafx.scene.input.KeyCombination, Runnable> alphaAccelerators =
                    acceleratorSnapshot(host.window());

            CompletableFuture<Void> preparationSettlement = new CompletableFuture<>();
            coordinator.installNextPreparationSettlementForTesting(preparationSettlement);
            openCampaignDeskWithKeyboard(host.window(), host.production);
            submitCampaignName(host.window(), "Late preparation");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED);
            awaitFxCondition(host::recoveryVisible);
            assertTrue(host.production.deskVisibleForTesting(),
                    "the real DeskHost action path must contain the unresolved transition");
            assertTrue(host.production.containedRecoveryVisibleForTesting());
            assertSame(attachedAlpha, host.production.retainedCampaignShellForTesting());
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators, acceleratorSnapshot(host.window()));
            awaitFxCondition(() -> campaignRow(host.window(), "Alpha") != null);
            javafx.scene.control.Button retainedAlpha = campaignRow(host.window(), "Alpha");
            assertTrue(retainedAlpha != null);
            assertFalse(retainedAlpha.isDisabled());
            assertTrue(retainedAlpha.getAccessibleText().contains("Gesunde aktuelle Kampagne"));
            preparationSettlement.complete(null);
            awaitFxCondition(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen") != null);
            runOnFx(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            assertSame(attachedAlpha, host.visibleCampaignRoot(),
                    "DeskHost handleResult and recover must restore the exact retained shell");
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators, acceleratorSnapshot(host.window()));

            CompletableFuture<Void> successfulDrainSettlement = new CompletableFuture<>();
            coordinator.installNextPriorDrainSettlementForTesting(successfulDrainSettlement);
            openCampaignDeskWithKeyboard(host.window(), host.production);
            submitCampaignName(host.window(), "Late successful drain");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED);
            awaitFxCondition(host.production::containedRecoveryVisibleForTesting);
            assertSame(attachedAlpha, host.production.retainedCampaignShellForTesting());
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators, acceleratorSnapshot(host.window()));
            successfulDrainSettlement.complete(null);
            awaitFxCondition(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen") != null);
            runOnFx(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            assertSame(attachedAlpha, host.visibleCampaignRoot(),
                    "late successful drain resumes the same attached production shell");
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators, acceleratorSnapshot(host.window()));

            CompletableFuture<Void> failedDrainSettlement = new CompletableFuture<>();
            coordinator.installNextPriorDrainSettlementForTesting(failedDrainSettlement);
            openCampaignDeskWithKeyboard(host.window(), host.production);
            submitCampaignName(host.window(), "Late failed drain");
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED);
            awaitFxCondition(host.production::containedRecoveryVisibleForTesting);
            assertSame(attachedAlpha, host.production.retainedCampaignShellForTesting());
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators, acceleratorSnapshot(host.window()));
            failedDrainSettlement.completeExceptionally(
                    new IllegalStateException("injected terminal drain failure"));
            awaitFxCondition(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen") != null);
            runOnFx(() -> presentedButton(
                    host.window(), "Kampagnenwechsel erneut prüfen").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED);
            awaitFxCondition(() -> host.recoveryVisible()
                    && !host.production.containedRecoveryVisibleForTesting());
            assertTrue(host.production.retainedCampaignShellForTesting() == null,
                    "unsafe production prior is detached behind the recovery root");
            runOnFx(() -> presentedButton(
                    host.window(), "Aktuelle Kampagne erneut öffnen").fire());
            awaitCondition(() -> coordinator.snapshot().phase()
                    == CampaignActivationCoordinator.Phase.ACTIVE);
            assertNotSame(attachedAlpha, host.visibleCampaignRoot(),
                    "unsafe prior must cold-rebuild instead of being republished");
            assertEquals(alphaId, host.production.retainedCampaignIdForTesting());
            assertEquals(alphaAccelerators.keySet(), acceleratorSnapshot(host.window()).keySet());
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application()
                            .execute(new SceneCommand.Create("Cold rebuilt after late drain failure")))
                            .status());
        } finally {
            host.closeWindow();
        }
    }

    @Test
    void timedOutPublishedRootIsReleasedBeforeRecoveryAndNextHealthySwitchHasCleanCss()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("published-root-cancellation");
        ProductionHostHarness publisher = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrap(caseRoot.resolve("installation.sqlite"));
        bootstrap.installCampaignActivationPhaseTimeoutForTesting(Duration.ofSeconds(5));
        List<LogRecord> candidateCssWarnings = java.util.Collections.synchronizedList(
                new java.util.ArrayList<>());
        Handler warningCapture = candidateCssWarningCapture(candidateCssWarnings);
        Logger cssLogger = Logger.getLogger("javafx.scene.CssStyleHelper");
        cssLogger.addHandler(warningCapture);
        try (bootstrap) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(
                            caseRoot.resolve("campaigns"), publisher));
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status());
            CampaignId alphaId = alpha.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            CampaignDeskHost.RootReadinessAttempt alphaReadiness =
                    publisher.lastReadinessAttempt();
            assertTrue(candidateCssWarnings.isEmpty(), () ->
                    "production candidate emitted JavaFX CSS conversion warnings: "
                            + candidateCssWarnings);

            publisher.hideOnNextReadiness();
            var timedOut = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, timedOut.status());
            assertTrue(publisher.recoveryVisible(),
                    "timeout after whole-root replacement must publish recovery");
            CampaignDeskHost.RootReadinessAttempt revoked = publisher.lastReadinessAttempt();
            assertNotSame(alphaReadiness, revoked,
                    "fault must reach the Beta production publication gate");
            assertTrue(revoked.completion().toCompletableFuture().isCompletedExceptionally());
            assertFalse(revoked.retainsPublishedRoot(),
                    "terminal readiness must release the detached Campaign graph");
            int terminalPulses = revoked.pulseObservations();
            publisher.showWindow();
            awaitFxPulses(3);
            assertEquals(terminalPulses, revoked.pulseObservations(),
                    "revoked AnimationTimer must do no later pulse work");
            await(revoked.cancel());

            var rolledForward = await(coordinator.recoverDurableActive());
            assertEquals(CampaignActivationCoordinator.Status.RESUMED, rolledForward.status(),
                    "post-commit timeout must first restore the durable Beta truth");
            long recoveryGeneration = rolledForward.durableActivation().orElseThrow().generation();
            var recovered = await(coordinator.switchTo(alphaId, recoveryGeneration));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, recovered.status(),
                    "a normal healthy switch follows durable roll-forward recovery");
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(coordinator.activeRuntimeForTesting().components().scene().application()
                            .execute(new SceneCommand.Create("Healthy after readiness timeout")))
                            .status());
            assertTrue(candidateCssWarnings.isEmpty(), () ->
                    "healthy production candidate emitted JavaFX CSS conversion warnings: "
                            + candidateCssWarnings);
            publisher.closeWindow();
        } finally {
            cssLogger.removeHandler(warningCapture);
            warningCapture.close();
            publisher.closeWindow();
        }
    }

    @Test
    void publicationTimeoutLateTerminalClosesAndResumesDurableFocusedScene()
            throws Exception {
        runOnFx(() -> { });
        long runtimeThreadsBefore = campaignRuntimeThreadCount();
        assertPublicationCloseResumePositiveControl();
        System.out.println("B1 close-resume positive-control=PASS");
        assertPublicationCloseResumePreCommitNegativeControl();
        System.out.println("B1 close-resume pre-commit-negative-control=PASS");

        Path caseRoot = temporaryDirectory.resolve("publication-close-resume");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        String alphaMarker = "Alpha stale publication marker";
        String betaMarker = "Beta focused resume marker";
        String betaEdit = "Beta acknowledged after resume";
        CampaignId betaId;
        Path betaPath;
        long betaGeneration;

        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator coordinator = await(
                bootstrap.openCampaignActivationAsync(campaignRoot, host));
        host.attach(coordinator);
        awaitFxCondition(() -> campaignNameField(host.window()) != null
                && !campaignNameField(host.window()).isDisabled());

        submitCampaignName(host.window(), "Alpha");
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE);
        assertUsableEmptyPrimaryScene(host.window(), "Alpha", alphaMarker);
        CampaignId alphaId = coordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id();

        openCampaignDeskWithKeyboard(host.window(), host.production);
        submitCampaignName(host.window(), "Beta");
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE);
        assertUsableEmptyPrimaryScene(host.window(), "Beta", betaMarker);
        betaId = coordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id();
        betaPath = coordinator.snapshot().campaignPath().orElseThrow();
        betaGeneration = coordinator.snapshot().durableActivation().orElseThrow().generation();
        CampaignRuntime lateBetaRuntime = coordinator.activeRuntimeForTesting();

        openCampaignDeskWithKeyboard(host.window(), host.production);
        awaitFxCondition(() -> campaignRow(host.window(), "Alpha") != null
                && !campaignRow(host.window(), "Alpha").isDisabled());
        runOnFx(() -> campaignRow(host.window(), "Alpha").fire());
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE
                && coordinator.snapshot().durableActivation().orElseThrow().campaign()
                        .map(campaign -> alphaId.equals(campaign.id())).orElse(false));
        assertFocusedSceneNotes(host.window(), alphaMarker, betaMarker);

        bootstrap.installCampaignActivationPhaseTimeoutForTesting(Duration.ofSeconds(2));
        host.holdNextReadinessTerminal();
        openCampaignDeskWithKeyboard(host.window(), host.production);
        awaitFxCondition(() -> campaignRow(host.window(), "Beta") != null
                && !campaignRow(host.window(), "Beta").isDisabled());
        runOnFx(() -> campaignRow(host.window(), "Beta").fire());
        host.awaitHeldReadinessReady();
        int recoveryBefore = host.recoveryPublications();
        int switchesAfterFaultPublication = host.campaignPublications();
        host.blockActivationDispatchUntilRecovery();
        host.releaseHeldReadinessTerminal();

        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED);
        awaitFxCondition(host::recoveryVisible);
        runOnFx(() -> { });
        assertEquals(recoveryBefore + 1, host.recoveryPublications(),
                "timeout must replace the published Beta root with recovery exactly once");
        assertEquals(switchesAfterFaultPublication, host.campaignPublications(),
                "revoked late terminal must not publish another Campaign root");
        runOnFx(() -> assertFalse(host.window().getScene().getRoot() instanceof AppShell,
                "late terminal must leave recovery authoritative"));
        assertEquals(
                SceneMutationResult.Status.STORAGE_ERROR,
                await(lateBetaRuntime.components().scene().application().execute(
                        new SceneCommand.Create("Revoked late Beta mutation"))).status(),
                "revoked late candidate must accept zero mutations");
        assertEquals(betaId, coordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id());
        assertEquals(betaPath, coordinator.snapshot().campaignPath().orElseThrow());

        long closeStarted = System.nanoTime();
        bootstrap.close();
        long closeNanos = System.nanoTime() - closeStarted;
        assertTrue(closeNanos <= Duration.ofSeconds(10).toNanos(),
                () -> "normal close exceeded 10 s: " + formatMillis(closeNanos));
        assertTrue(bootstrap.termination().toCompletableFuture().isDone());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());
        host.closeWindow();

        ProductionHostHarness resumedHost = new ProductionHostHarness();
        AppBootstrap resumedBootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator resumedCoordinator = await(
                resumedBootstrap.openCampaignActivationAsync(campaignRoot, resumedHost));
        resumedHost.attachAndResume(resumedCoordinator);
        assertEquals(1, resumedHost.startupResumeAttempts());
        assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                resumedCoordinator.snapshot().phase());
        assertEquals(betaId, resumedCoordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id());
        assertEquals(betaGeneration, resumedCoordinator.snapshot().durableActivation()
                .orElseThrow().generation());
        assertEquals(betaPath, resumedCoordinator.snapshot().campaignPath().orElseThrow());
        assertSafeAttachedShell(resumedHost.window());
        assertFocusedSceneNotes(resumedHost.window(), betaMarker, alphaMarker);
        editFocusedSceneThroughUi(resumedHost.window(), betaEdit);
        closeBootstrapAndWindow(resumedBootstrap, resumedHost);

        ProductionHostHarness readbackHost = new ProductionHostHarness();
        AppBootstrap readbackBootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator readbackCoordinator = await(
                readbackBootstrap.openCampaignActivationAsync(campaignRoot, readbackHost));
        readbackHost.attachAndResume(readbackCoordinator);
        assertEquals(1, readbackHost.startupResumeAttempts());
        assertEquals(betaId, readbackCoordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id());
        assertEquals(betaPath, readbackCoordinator.snapshot().campaignPath().orElseThrow());
        assertSafeAttachedShell(readbackHost.window());
        assertFocusedSceneNotes(readbackHost.window(), betaEdit, alphaMarker);
        closeBootstrapAndWindow(readbackBootstrap, readbackHost);

        awaitCondition(() -> campaignRuntimeThreadCount() <= runtimeThreadsBefore);
        System.out.println("B1 close-resume deciding-metrics=PASS close="
                + formatMillis(closeNanos)
                + " recovery-replacements=1 late-publications=0 late-mutations=0"
                + " startup-resume-attempts=1 durable-readback=exact");
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
            Path alphaWal = alphaPath.resolveSibling(alphaPath.getFileName() + "-wal");
            Path alphaShm = alphaPath.resolveSibling(alphaPath.getFileName() + "-shm");
            Path alphaJournal = alphaPath.resolveSibling(alphaPath.getFileName() + "-journal");
            try (var external = DriverManager.getConnection("jdbc:sqlite:" + alphaPath)) {
                external.createStatement().execute("DROP TABLE scene_running_scene");
            }
            byte[] damaged = Files.readAllBytes(alphaPath);
            assertFalse(Files.exists(alphaWal), "damage setup closed without a WAL sidecar");
            assertFalse(Files.exists(alphaShm), "damage setup closed without a SHM sidecar");
            assertFalse(Files.exists(alphaJournal),
                    "damage setup closed without a rollback-journal sidecar");

            var switched = await(coordinator.switchTo(
                    alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(), 2L));

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED, switched.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(beta.durableActivation(), coordinator.snapshot().durableActivation());
            assertEquals(betaRuntime, coordinator.activeRuntimeForTesting());
            assertArrayEquals(damaged, Files.readAllBytes(alphaPath));
            assertFalse(Files.exists(alphaWal), "PARKED validation must not create a WAL");
            assertFalse(Files.exists(alphaShm), "PARKED validation must not create SHM");
            assertFalse(Files.exists(alphaJournal),
                    "PARKED validation must not create a rollback journal");
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(betaRuntime.components().scene().application().execute(
                            new SceneCommand.Create("Prior stays writable"))).status());
            host.closeWindow();
        }
    }

    @Test
    void coldCampaignCandidateRejectsManifestOwnerTriggerBeforeSourceWrite()
            throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("cold-candidate-owner-trigger");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        CampaignId alphaId;
        Path alphaPath;
        CampaignActivation betaActivation;

        ProductionHostHarness seedHost = new ProductionHostHarness();
        try (AppBootstrap seed = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    seed.openCampaignActivationAsync(campaignRoot, seedHost));
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status());
            alphaId = alpha.durableActivation().orElseThrow().campaign().orElseThrow().id();
            alphaPath = alpha.campaignPath().orElseThrow();
            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            betaActivation = beta.durableActivation().orElseThrow();
            seedHost.closeWindow();
        }

        try (var external = DriverManager.getConnection("jdbc:sqlite:" + alphaPath)) {
            external.createStatement().execute(
                    "CREATE TRIGGER unrelated_scene_probe AFTER INSERT ON scene_running_scene "
                            + "BEGIN SELECT NEW.scene_id; END");
        }
        byte[] malformedCandidate = Files.readAllBytes(alphaPath);
        assertCampaignSidecarsAbsent(alphaPath);

        ProductionHostHarness restartedHost = new ProductionHostHarness();
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHost));
            assertEquals(
                    CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.resumeDurableActive()).status());
            CampaignRuntime betaRuntime = coordinator.activeRuntimeForTesting();

            var rejected = await(coordinator.switchTo(alphaId, betaActivation.generation()));

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED, rejected.status());
            assertEquals(betaActivation, coordinator.snapshot().durableActivation().orElseThrow());
            assertEquals(betaRuntime, coordinator.activeRuntimeForTesting());
            assertArrayEquals(malformedCandidate, Files.readAllBytes(alphaPath));
            assertCampaignSidecarsAbsent(alphaPath);
            assertEquals(
                    SceneMutationResult.Status.SUCCESS,
                    await(betaRuntime.components().scene().application().execute(
                            new SceneCommand.Create("Prior remains authoritative"))).status());
            restartedHost.closeWindow();
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
        CountDownLatch lateCleanupEntered = new CountDownLatch(1);
        CountDownLatch releaseLateCleanup = new CountDownLatch(1);
        bootstrap.installCampaignCloseObserverForTesting(part -> {
            if (!"runtime".equals(part)) {
                return;
            }
            int attempt = runtimeCloseAttempts.incrementAndGet();
            if (attempt <= 4) {
                throw new IllegalStateException("injected synchronous terminal close failure");
            }
            if (attempt == 5) {
                lateCleanupEntered.countDown();
                try {
                    if (!releaseLateCleanup.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("timed out releasing automatic late cleanup");
                    }
                } catch (InterruptedException interruption) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("automatic late cleanup was interrupted", interruption);
                }
            }
        });
        CampaignActivationCoordinator coordinator = await(bootstrap.openCampaignActivationAsync(
                caseRoot.resolve("campaigns"), host));
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Alpha", 0L)).status());

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);
        assertTrue(lateCleanupEntered.await(5, TimeUnit.SECONDS));
        try {
            assertTrue(bootstrap.campaignActivationRetainedForTesting());
        } finally {
            releaseLateCleanup.countDown();
        }
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

    private void assertPublicationCloseResumePositiveControl() throws Exception {
        Path caseRoot = temporaryDirectory.resolve("publication-close-resume-positive");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        String betaMarker = "Positive Beta focused marker";
        String betaEdit = "Positive Beta acknowledged edit";
        CampaignId betaId;
        Path betaPath;

        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator coordinator = await(
                bootstrap.openCampaignActivationAsync(campaignRoot, host));
        host.attach(coordinator);
        awaitFxCondition(() -> campaignNameField(host.window()) != null
                && !campaignNameField(host.window()).isDisabled());
        submitCampaignName(host.window(), "Positive Alpha");
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE);
        assertUsableEmptyPrimaryScene(
                host.window(), "Positive Alpha", "Positive Alpha marker");
        CampaignId alphaId = coordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id();

        openCampaignDeskWithKeyboard(host.window(), host.production);
        submitCampaignName(host.window(), "Positive Beta");
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE);
        assertUsableEmptyPrimaryScene(host.window(), "Positive Beta", betaMarker);
        betaId = coordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id();
        betaPath = coordinator.snapshot().campaignPath().orElseThrow();

        openCampaignDeskWithKeyboard(host.window(), host.production);
        awaitFxCondition(() -> campaignRow(host.window(), "Positive Alpha") != null);
        runOnFx(() -> campaignRow(host.window(), "Positive Alpha").fire());
        awaitCondition(() -> coordinator.snapshot().durableActivation().orElseThrow().campaign()
                .map(campaign -> alphaId.equals(campaign.id())).orElse(false));
        openCampaignDeskWithKeyboard(host.window(), host.production);
        awaitFxCondition(() -> campaignRow(host.window(), "Positive Beta") != null);
        runOnFx(() -> campaignRow(host.window(), "Positive Beta").fire());
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE
                && coordinator.snapshot().durableActivation().orElseThrow().campaign()
                        .map(campaign -> betaId.equals(campaign.id())).orElse(false));
        assertSafeAttachedShell(host.window());
        assertFocusedSceneNotes(host.window(), betaMarker, "Positive Alpha marker");
        editFocusedSceneThroughUi(host.window(), betaEdit);
        closeBootstrapAndWindow(bootstrap, host);

        ProductionHostHarness resumedHost = new ProductionHostHarness();
        AppBootstrap resumedBootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator resumedCoordinator = await(
                resumedBootstrap.openCampaignActivationAsync(campaignRoot, resumedHost));
        resumedHost.attachAndResume(resumedCoordinator);
        assertEquals(1, resumedHost.startupResumeAttempts());
        assertEquals(betaId, resumedCoordinator.snapshot().durableActivation().orElseThrow()
                .campaign().orElseThrow().id());
        assertEquals(betaPath, resumedCoordinator.snapshot().campaignPath().orElseThrow());
        assertSafeAttachedShell(resumedHost.window());
        assertFocusedSceneNotes(resumedHost.window(), betaEdit, "Positive Alpha marker");
        closeBootstrapAndWindow(resumedBootstrap, resumedHost);
    }

    private void assertPublicationCloseResumePreCommitNegativeControl() throws Exception {
        Path caseRoot = temporaryDirectory.resolve("publication-close-resume-negative");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");
        String alphaMarker = "Negative Alpha remains authoritative";
        String alphaEdit = "Negative Alpha remains writable";
        ProductionHostHarness host = new ProductionHostHarness();
        AppBootstrap bootstrap = bootstrapAt(installationPath);
        CampaignActivationCoordinator coordinator = await(
                bootstrap.openCampaignActivationAsync(campaignRoot, host));
        host.attach(coordinator);
        awaitFxCondition(() -> campaignNameField(host.window()) != null
                && !campaignNameField(host.window()).isDisabled());
        submitCampaignName(host.window(), "Negative Alpha");
        awaitCondition(() -> coordinator.snapshot().phase()
                == CampaignActivationCoordinator.Phase.ACTIVE);
        assertUsableEmptyPrimaryScene(host.window(), "Negative Alpha", alphaMarker);
        CampaignActivation durableAlpha = coordinator.snapshot().durableActivation().orElseThrow();
        AppShell alphaShell = host.visibleCampaignRoot();

        CampaignActivationCoordinator.Result rejected = await(
                coordinator.create("Rejected before commit", 0L));
        assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION, rejected.status());
        assertEquals(durableAlpha, coordinator.snapshot().durableActivation().orElseThrow());
        assertSame(alphaShell, host.visibleCampaignRoot());
        editFocusedSceneThroughUi(host.window(), alphaEdit);
        assertEquals(durableAlpha.campaign().orElseThrow().id(),
                coordinator.snapshot().durableActivation().orElseThrow()
                        .campaign().orElseThrow().id());
        closeBootstrapAndWindow(bootstrap, host);
    }

    private static void assertSafeAttachedShell(Stage stage) throws Exception {
        awaitFxCondition(() -> stage.isShowing()
                && stage.getScene() != null
                && stage.getScene().getRoot() instanceof AppShell);
        runOnFx(() -> {
            javafx.scene.Parent root = stage.getScene().getRoot();
            root.applyCss();
            root.layout();
            javafx.geometry.Bounds screen = root.localToScreen(root.getBoundsInLocal());
            assertTrue(root instanceof AppShell);
            assertSame(stage.getScene(), root.getScene());
            assertSame(stage, root.getScene().getWindow());
            assertTrue(root.getLayoutBounds().getWidth() > 0.0);
            assertTrue(root.getLayoutBounds().getHeight() > 0.0);
            assertTrue(screen != null && screen.getWidth() > 0.0 && screen.getHeight() > 0.0);
        });
    }

    private static void assertFocusedSceneNotes(
            Stage stage,
            String expected,
            String forbidden
    ) throws Exception {
        fireNavigation(stage, "Szenen");
        awaitFxCondition(() -> presentedTextArea(stage, "Szenennotizen") != null
                && expected.equals(presentedTextArea(stage, "Szenennotizen").getText()));
        runOnFx(() -> assertNotEquals(
                forbidden, presentedTextArea(stage, "Szenennotizen").getText()));
    }

    private static void editFocusedSceneThroughUi(Stage stage, String notes) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        fireNavigation(stage, "Szenen");
        awaitFxConditionUntil(() -> presentedTextArea(stage, "Szenennotizen") != null
                && presentedButton(stage, "Szene speichern") != null, deadline);
        runOnFxUntil(deadline, () -> {
            presentedTextArea(stage, "Szenennotizen").setText(notes);
            presentedButton(stage, "Szene speichern").fire();
        });
        awaitFxConditionUntil(() -> presentedTextArea(stage, "Szenennotizen") != null
                && notes.equals(presentedTextArea(stage, "Szenennotizen").getText())
                && presentedText(stage, "Szene aktualisiert."), deadline);
    }

    private static void closeBootstrapAndWindow(
            AppBootstrap bootstrap,
            ProductionHostHarness host
    ) throws Exception {
        bootstrap.close();
        assertTrue(bootstrap.termination().toCompletableFuture().isDone());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        host.closeWindow();
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
                new CharacterDraft(marker + " Guide", marker, 3, 14, 16)));
        runtime.components().party().application().setMembership(
                new SetPartyMembershipCommand(1L, MembershipState.ACTIVE));
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

    private static void seedEncounterCreatureFixtures(Path installationPath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (java.sql.Connection connection = java.sql.DriverManager.getConnection(
                        "jdbc:sqlite:" + installationPath);
                java.sql.Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT OR IGNORE INTO creatures (
                        id, name, size, creature_type, alignment, cr, xp, hp, ac, initiative_bonus
                    ) VALUES (
                        9101, 'Alpha Sentinel', 'Medium', 'Construct', 'Neutral', '1',
                        200, 17, 13, 2
                    )
                    """);
            statement.executeUpdate("""
                    INSERT OR IGNORE INTO creatures (
                        id, name, size, creature_type, alignment, cr, xp, hp, ac, initiative_bonus
                    ) VALUES (
                        9102, 'Beta Ravager', 'Large', 'Beast', 'Unaligned', '2',
                        450, 23, 15, 4
                    )
                    """);
        }
    }

    private static void assertUsableEmptyPrimaryScene(
            Stage stage,
            String campaignName,
            String noteMarker
    ) throws Exception {
        awaitFxCondition(() -> !stage.getScene().getRoot().isDisabled()
                && ("SaltMarcher – " + campaignName).equals(stage.getTitle()));
        fireNavigation(stage, "Szenen");
        awaitFxCondition(() -> presentedText(stage, "Standardszene · Standard")
                && presentedTextFieldWithValue(stage, "Standardszene") != null
                && presentedText(stage, "Keine aktiven PCs.")
                && presentedText(stage, "📍 Kein Ort gesetzt")
                && presentedTextArea(stage, "Szenennotizen") != null
                && presentedButton(stage, "Szene speichern") != null);
        runOnFx(() -> {
            assertEquals(1L, presentedTextCount(stage, "Standardszene · Standard"));
            assertEquals("", presentedTextArea(stage, "Szenennotizen").getText());
            assertTrue(stage.getScene().getRoot().lookupAll(".button").stream()
                    .filter(javafx.scene.control.Button.class::isInstance)
                    .map(javafx.scene.control.Button.class::cast)
                    .filter(button -> "Löschen".equals(button.getText()))
                    .noneMatch(button -> presented(stage, button)));
            javafx.scene.control.TextArea notes = presentedTextArea(stage, "Szenennotizen");
            notes.setText(noteMarker);
            presentedButton(stage, "Szene speichern").fire();
        });
        awaitFxCondition(() -> presentedTextArea(stage, "Szenennotizen") != null
                && noteMarker.equals(presentedTextArea(stage, "Szenennotizen").getText())
                && presentedText(stage, "Szene aktualisiert."));
    }

    private static WarmSwitchSample measureWarmSwitchAndMutation(
            CampaignActivationCoordinator coordinator,
            ProductionHostHarness host,
            CampaignId targetId,
            String targetName,
            String expectedNote,
            String forbiddenNote,
            String nextNote
    ) throws Exception {
        Stage stage = host.window();
        Scene stableScene = stage.getScene();
        javafx.scene.Parent previousRoot = currentRoot(stage);
        openCampaignDeskWithKeyboard(stage, host.production);
        awaitFxCondition(() -> campaignRow(stage, targetName) != null
                && !campaignRow(stage, targetName).isDisabled());
        AtomicReference<Long> startedNanos = new AtomicReference<>();
        AtomicReference<Long> deadlineNanos = new AtomicReference<>();
        AtomicReference<Long> handlerNanos = new AtomicReference<>();
        runOnFx(() -> {
            long started = System.nanoTime();
            startedNanos.set(started);
            deadlineNanos.set(started + Duration.ofSeconds(10).toNanos());
            campaignRow(stage, targetName).fire();
            handlerNanos.set(System.nanoTime() - started);
        });
        long hardDeadlineNanos = deadlineNanos.get();
        awaitCampaignActiveWithinHardTimeout(
                coordinator, targetId, targetName, nextNote, hardDeadlineNanos);
        long activationNanos = System.nanoTime() - startedNanos.get();
        runOnFxUntil(hardDeadlineNanos, () -> assertSame(stableScene, stage.getScene(),
                "Campaign switching must retain the installation-owned JavaFX Scene"));
        assertRootReplaced(stage, previousRoot, hardDeadlineNanos);
        awaitFxConditionUntil(() -> !stage.getScene().getRoot().isDisabled()
                && ("SaltMarcher – " + targetName).equals(stage.getTitle()),
                hardDeadlineNanos);
        awaitFxConditionUntil(() -> stage.getScene().getRoot() instanceof AppShell shell
                && shell.activeLeftBarTab()
                        .map(key -> "runtime-scenes".equals(key.value()))
                        .orElse(false)
                && presentedTextArea(stage, "Szenennotizen") != null
                && expectedNote.equals(presentedTextArea(stage, "Szenennotizen").getText())
                && !forbiddenNote.equals(presentedTextArea(stage, "Szenennotizen").getText()),
                hardDeadlineNanos);
        long visibleReadyNanos = System.nanoTime() - startedNanos.get();

        long revisionBeforeMutation = coordinator.activeRuntimeForTesting().components()
                .scene().model().current().revision();
        runOnFxUntil(hardDeadlineNanos, () -> {
            presentedTextArea(stage, "Szenennotizen").setText(nextNote);
            presentedButton(stage, "Szene speichern").fire();
        });
        awaitConditionUntil(() -> {
            var snapshot = coordinator.activeRuntimeForTesting().components().scene().model().current();
            return snapshot.revision() > revisionBeforeMutation
                    && snapshot.scenes().stream()
                            .filter(features.scene.api.SceneSnapshot.SceneEntry::focused)
                            .anyMatch(scene -> nextNote.equals(scene.notes()));
        }, hardDeadlineNanos);
        awaitFxConditionUntil(() -> presentedTextArea(stage, "Szenennotizen") != null
                && nextNote.equals(presentedTextArea(stage, "Szenennotizen").getText())
                && presentedText(stage, "Szene aktualisiert."), hardDeadlineNanos);
        long readyAndMutationNanos = System.nanoTime() - startedNanos.get();
        assertTrue(readyAndMutationNanos <= Duration.ofSeconds(10).toNanos(),
                () -> targetName + " exceeded hard timeout: " + formatMillis(readyAndMutationNanos));
        return new WarmSwitchSample(
                handlerNanos.get(), activationNanos, visibleReadyNanos, readyAndMutationNanos);
    }

    private static long p95(
            List<WarmSwitchSample> samples,
            java.util.function.ToLongFunction<WarmSwitchSample> measurement
    ) {
        List<Long> ordered = samples.stream().mapToLong(measurement).sorted().boxed().toList();
        if (ordered.size() != WARM_SWITCH_SAMPLES) {
            throw new IllegalArgumentException("warm-switch population must contain exactly 100 samples");
        }
        return ordered.get(94);
    }

    private static String warmSwitchSummary(
            List<WarmSwitchSample> toAlpha,
            List<WarmSwitchSample> toBeta
    ) {
        return "current-profile p95: Beta->Alpha " + warmSwitchDirectionSummary(toAlpha)
                + "; Alpha->Beta " + warmSwitchDirectionSummary(toBeta);
    }

    private static String warmSwitchDirectionSummary(List<WarmSwitchSample> samples) {
        return "handler=" + formatMillis(p95(samples, WarmSwitchSample::handlerNanos))
                + ", activation=" + formatMillis(p95(samples, WarmSwitchSample::activationNanos))
                + ", visible=" + formatMillis(p95(samples, WarmSwitchSample::visibleReadyNanos))
                + ", visible-to-durable-mutation=" + formatMillis(p95(
                        samples,
                        sample -> sample.readyAndMutationNanos() - sample.visibleReadyNanos()))
                + ", total=" + formatMillis(p95(samples, WarmSwitchSample::readyAndMutationNanos));
    }

    private static String formatMillis(long nanos) {
        return String.format(java.util.Locale.ROOT, "%.3f ms", nanos / 1_000_000.0);
    }

    private static long campaignRuntimeThreadCount() {
        return Thread.getAllStackTraces().keySet().stream()
                .map(Thread::getName)
                .filter(name -> name.equals("salt-marcher-runtime")
                        || name.equals("salt-marcher-campaign-closure")
                        || name.startsWith("campaign-creatures-read-")
                        || name.startsWith("campaign-items-read-")
                        || name.startsWith("campaign-session-generation-")
                        || name.startsWith("campaign-encounter-generated-")
                        || name.startsWith("campaign-session-preparation-"))
                .count();
    }

    private static void awaitCampaignActiveWithinHardTimeout(
            CampaignActivationCoordinator coordinator,
            CampaignId targetId,
            String targetName,
            String sampleMarker,
            long deadline
    ) {
        while (System.nanoTime() < deadline) {
            var snapshot = coordinator.snapshot();
            if (snapshot.phase() == CampaignActivationCoordinator.Phase.ACTIVE
                    && snapshot.durableActivation().flatMap(
                            features.campaign.api.CampaignActivation::campaign)
                            .map(campaign -> targetId.equals(campaign.id()))
                            .orElse(false)) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Warm switch hard timeout: target=" + targetName
                + ", sample=" + sampleMarker + ", snapshot=" + coordinator.snapshot());
    }

    private static VisibleCampaignTruth seedVisibleCampaignTruth(
            CampaignRuntime runtime,
            String marker,
            long creatureId,
            String creatureName,
            int creatureInitiative,
            int damage,
            int q,
            int r
    ) throws Exception {
        String sceneTitle = marker + " Scene";
        String routeName = marker + " visible Route";
        awaitCondition(() -> !runtime.components().party().activeParty().current().members().isEmpty());
        long memberId = runtime.components().party().activeParty().current().members().getFirst().id();
        long focusedSceneId = runtime.components().scene().model().current().focusedSceneId();
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(runtime.components().scene().application().execute(
                        new SceneCommand.AssignPc(focusedSceneId, memberId))).status());

        runtime.components().encounter().application().applyState(
                ApplyEncounterStateCommand.addCreature(creatureId));
        awaitCondition(() -> runtime.components().encounter().state().current()
                .builderPane().rosterCards().stream()
                .anyMatch(card -> creatureId == card.creatureId()));
        runtime.components().encounter().application().applyState(
                ApplyEncounterStateCommand.openInitiative());
        awaitCondition(() -> runtime.components().encounter().state().current().activeMode()
                == EncounterStateSnapshot.Mode.INITIATIVE);
        List<EncounterStateSnapshot.InitiativeRow> initiativeRows = runtime.components()
                .encounter().state().current().initiativePane().rows();
        runtime.components().encounter().application().applyState(
                ApplyEncounterStateCommand.confirmInitiative(
                        initiativeRows.stream().map(
                                EncounterStateSnapshot.InitiativeRow::combatantId).toList(),
                        initiativeRows.stream().map(row -> row.displayLabel().startsWith(creatureName)
                                ? creatureInitiative : 10).toList()));
        awaitCondition(() -> runtime.components().encounter().state().current().activeMode()
                == EncounterStateSnapshot.Mode.COMBAT);
        EncounterStateSnapshot.CombatCard encounterCard = combatCard(runtime, creatureName)
                .orElseThrow();
        runtime.components().encounter().application().applyState(
                ApplyEncounterStateCommand.mutateHitPoints(
                        encounterCard.combatantId(), damage, false));
        int expectedHp = encounterCard.maxHp() - damage;
        awaitCondition(() -> combatCard(runtime, creatureName)
                .map(card -> card.currentHp() == expectedHp).orElse(false));
        EncounterStateSnapshot.CombatCard finalEncounterCard = combatCard(runtime, creatureName)
                .orElseThrow();

        runtime.components().hex().editor().createMap(new CreateHexMapCommand(routeName, 4));
        awaitCondition(() -> runtime.components().hex().editorModel().current().selectedMap()
                .filter(map -> routeName.equals(map.displayName()))
                .isPresent());
        long mapId = runtime.components().hex().editorModel().current().selectedMap()
                .orElseThrow().mapId().value();
        runtime.components().hex().travel().movePartyToken(
                new MoveHexPartyTokenCommand(mapId, q, r, List.of(memberId)));
        String visibleRoute = routeName + " " + q + "," + r;
        awaitCondition(() -> {
            var context = runtime.components().travel().model().current();
            return visibleRoute.equals(context.mapName())
                    && "Hex-Reise".equals(contextLabel(context.kind()));
        });
        return new VisibleCampaignTruth(
                sceneTitle,
                finalEncounterCard.combatantId(),
                creatureName,
                finalEncounterCard.currentHp(),
                finalEncounterCard.maxHp(),
                finalEncounterCard.initiativeValue(),
                visibleRoute);
    }

    private static java.util.Optional<EncounterStateSnapshot.CombatCard> combatCard(
            CampaignRuntime runtime,
            String creatureName
    ) {
        return runtime.components().encounter().state().current().combatPane().combatCards().stream()
                .filter(card -> creatureName.equals(card.displayName()))
                .findFirst();
    }

    private static String contextLabel(features.travel.api.TravelContextKind kind) {
        return kind == features.travel.api.TravelContextKind.HEX ? "Hex-Reise" : "";
    }

    private static void assertVisibleCampaignTruth(
            Stage stage,
            VisibleCampaignTruth expected,
            VisibleCampaignTruth forbidden
    ) throws Exception {
        awaitFxCondition(() -> !stage.getScene().getRoot().isDisabled());
        runOnFx(() -> assertFalse(stage.getScene().getRoot().isDisabled(),
                "the committed Campaign shell must be keyboard-operable"));
        fireNavigation(stage, "Szenen");
        awaitFxCondition(() -> presentedTextFieldWithValue(stage, expected.sceneTitle()) != null);
        runOnFx(() -> {
            assertTrue(presentedTextFieldWithValue(stage, expected.sceneTitle()) != null);
            if (forbidden != null) {
                assertFalse(presentedText(stage, forbidden.sceneTitle()));
            }
        });

        fireStateTab(stage, "Reise");
        awaitFxCondition(() -> presentedText(stage, expected.visibleRoute())
                && presentedText(stage, "Hex-Reise"));
        runOnFx(() -> {
            assertTrue(presentedText(stage, expected.visibleRoute()));
            assertTrue(presentedText(stage, "Hex-Reise"));
            if (forbidden != null) {
                assertFalse(presentedText(stage, forbidden.visibleRoute()));
            }
        });

        fireStateTab(stage, "Encounter");
        awaitFxCondition(() -> presented(
                stage, stage.getScene().lookup(".encounter-combat-card-list")));
        awaitFxCondition(() -> presentedStyledText(
                stage, ".combat-name", expected.encounterName()));
        awaitFxCondition(() -> presentedAccessibleNode(
                stage, ".progress-meter-combat", expected.hpAccessibleText()));
        awaitFxCondition(() -> presentedStyledText(
                stage, ".init-badge", "Init " + expected.encounterInitiative()));
        awaitFxCondition(() -> presentedText(stage, "Runde 1"));
        runOnFx(() -> {
            assertTrue(presentedStyledText(stage, ".combat-name", expected.encounterName()));
            assertTrue(presentedAccessibleNode(
                    stage, ".progress-meter-combat", expected.hpAccessibleText()));
            assertTrue(presentedStyledText(
                    stage, ".init-badge", "Init " + expected.encounterInitiative()));
            if (forbidden != null) {
                assertFalse(presentedStyledText(stage, ".combat-name", forbidden.encounterName()));
                assertFalse(presentedAccessibleNode(
                        stage, ".progress-meter-combat", forbidden.hpAccessibleText()));
            }
        });
    }

    private static void fireNavigation(Stage stage, String accessibleText) throws Exception {
        awaitFxCondition(() -> presentedToggle(stage, ".nav-btn", accessibleText, null) != null);
        runOnFx(() -> presentedToggle(stage, ".nav-btn", accessibleText, null).fire());
    }

    private static void fireStateTab(Stage stage, String text) throws Exception {
        awaitFxCondition(() -> presentedToggle(stage, ".scene-tab", null, text) != null);
        runOnFx(() -> presentedToggle(stage, ".scene-tab", null, text).fire());
    }

    private static boolean presentedStyledText(Stage stage, String selector, String text) {
        return styledNodes(stage, selector).stream()
                .filter(javafx.scene.control.Labeled.class::isInstance)
                .map(javafx.scene.control.Labeled.class::cast)
                .anyMatch(node -> text.equals(node.getText()) && presented(stage, node));
    }

    private static boolean presentedAccessibleNode(
            Stage stage,
            String selector,
            String accessibleText
    ) {
        return styledNodes(stage, selector).stream()
                .anyMatch(node -> accessibleText.equals(node.getAccessibleText())
                        && presented(stage, node));
    }

    private static javafx.scene.control.ToggleButton presentedToggle(
            Stage stage,
            String selector,
            String accessibleText,
            String text
    ) {
        return styledNodes(stage, selector).stream()
                .filter(javafx.scene.control.ToggleButton.class::isInstance)
                .map(javafx.scene.control.ToggleButton.class::cast)
                .filter(button -> accessibleText == null
                        || accessibleText.equals(button.getAccessibleText()))
                .filter(button -> text == null || text.equals(button.getText()))
                .filter(button -> !button.isDisabled())
                .filter(button -> presented(stage, button))
                .findFirst().orElse(null);
    }

    private static javafx.scene.control.TextField presentedTextField(
            Stage stage,
            String accessibleText
    ) {
        return styledNodes(stage, ".text-field").stream()
                .filter(javafx.scene.control.TextField.class::isInstance)
                .map(javafx.scene.control.TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .filter(field -> presented(stage, field))
                .findFirst().orElse(null);
    }

    private static javafx.scene.control.TextField presentedTextFieldWithValue(
            Stage stage,
            String value
    ) {
        return styledNodes(stage, ".text-field").stream()
                .filter(javafx.scene.control.TextField.class::isInstance)
                .map(javafx.scene.control.TextField.class::cast)
                .filter(field -> value.equals(field.getText()))
                .filter(field -> presented(stage, field))
                .findFirst().orElse(null);
    }

    private static javafx.scene.control.TextArea presentedTextArea(
            Stage stage,
            String promptText
    ) {
        return styledNodes(stage, ".text-area").stream()
                .filter(javafx.scene.control.TextArea.class::isInstance)
                .map(javafx.scene.control.TextArea.class::cast)
                .filter(area -> promptText.equals(area.getPromptText()))
                .filter(area -> presented(stage, area))
                .findFirst().orElse(null);
    }

    private static javafx.scene.control.Button presentedButton(Stage stage, String text) {
        return styledNodes(stage, ".button").stream()
                .filter(javafx.scene.control.Button.class::isInstance)
                .map(javafx.scene.control.Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(button -> !button.isDisabled())
                .filter(button -> presented(stage, button))
                .findFirst().orElse(null);
    }

    private static boolean presentedText(Stage stage, String text) {
        return styledNodes(stage, ".label").stream()
                .filter(javafx.scene.control.Label.class::isInstance)
                .map(javafx.scene.control.Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()) && presented(stage, label));
    }

    private static long presentedTextCount(Stage stage, String text) {
        return styledNodes(stage, ".label").stream()
                .filter(javafx.scene.control.Label.class::isInstance)
                .map(javafx.scene.control.Label.class::cast)
                .filter(label -> text.equals(label.getText()) && presented(stage, label))
                .count();
    }

    private static List<javafx.scene.Node> styledNodes(Stage stage, String selector) {
        if (selector == null || selector.length() < 2 || selector.charAt(0) != '.') {
            throw new IllegalArgumentException("Only one style-class selector is supported");
        }
        String styleClass = selector.substring(1);
        List<javafx.scene.Node> matching = new java.util.ArrayList<>();
        java.util.ArrayDeque<javafx.scene.Node> pending = new java.util.ArrayDeque<>();
        pending.add(stage.getScene().getRoot());
        while (!pending.isEmpty()) {
            javafx.scene.Node node = pending.removeFirst();
            if (node.getStyleClass().contains(styleClass)) {
                matching.add(node);
            }
            if (node instanceof javafx.scene.Parent parent) {
                pending.addAll(parent.getChildrenUnmodifiable());
            }
        }
        return matching;
    }

    private static boolean presented(Stage stage, javafx.scene.Node node) {
        if (node == null || node.getScene() != stage.getScene()) {
            return false;
        }
        for (javafx.scene.Node current = node; current != null; current = current.getParent()) {
            if (!current.isVisible()) {
                return false;
            }
        }
        return true;
    }

    private static javafx.scene.Parent currentRoot(Stage stage) throws Exception {
        AtomicReference<javafx.scene.Parent> root = new AtomicReference<>();
        runOnFx(() -> root.set(stage.getScene().getRoot()));
        return root.get();
    }

    private static void assertRootReplaced(Stage stage, javafx.scene.Parent previousRoot)
            throws Exception {
        runOnFx(() -> {
            assertNotSame(previousRoot, stage.getScene().getRoot());
            assertTrue(previousRoot.getScene() == null
                            || previousRoot.getScene().getWindow() == null,
                    "the prior Campaign root must be detached from the active Stage");
        });
    }

    private static void assertRootReplaced(
            Stage stage,
            javafx.scene.Parent previousRoot,
            long deadlineNanos
    ) throws Exception {
        runOnFxUntil(deadlineNanos, () -> {
            assertNotSame(previousRoot, stage.getScene().getRoot());
            assertTrue(previousRoot.getScene() == null
                            || previousRoot.getScene().getWindow() == null,
                    "the prior Campaign root must be detached from the active Stage");
        });
    }

    private record VisibleCampaignTruth(
            String sceneTitle,
            String encounterCombatantId,
            String encounterName,
            int currentHp,
            int maximumHp,
            int encounterInitiative,
            String visibleRoute
    ) {
        private VisibleCampaignTruth withSceneTitle(String nextSceneTitle) {
            return new VisibleCampaignTruth(
                    nextSceneTitle,
                    encounterCombatantId,
                    encounterName,
                    currentHp,
                    maximumHp,
                    encounterInitiative,
                    visibleRoute);
        }

        private VisibleCampaignTruth withCurrentHp(int nextCurrentHp) {
            return new VisibleCampaignTruth(
                    sceneTitle,
                    encounterCombatantId,
                    encounterName,
                    nextCurrentHp,
                    maximumHp,
                    encounterInitiative,
                    visibleRoute);
        }

        private String hpAccessibleText() {
            return encounterName + " HP " + currentHp + " / " + maximumHp;
        }
    }

    private record WarmSwitchSample(
            long handlerNanos,
            long activationNanos,
            long visibleReadyNanos,
            long readyAndMutationNanos
    ) { }

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static Handler candidateCssWarningCapture(List<LogRecord> warnings) {
        return new Handler() {
            @Override
            public void publish(LogRecord record) {
                String message = record.getMessage();
                if (record.getLevel().intValue() >= Level.WARNING.intValue()
                        && message != null
                        && message.contains("while converting value")
                        && message.contains("salt-marcher.css")) {
                    warnings.add(record);
                }
            }

            @Override
            public void flush() { }

            @Override
            public void close() { }
        };
    }

    private static void awaitFxPulses(int requestedPulses) throws Exception {
        CountDownLatch observed = new CountDownLatch(1);
        runOnFx(() -> new javafx.animation.AnimationTimer() {
            private int pulses;

            @Override
            public void handle(long now) {
                pulses++;
                if (pulses >= requestedPulses) {
                    stop();
                    observed.countDown();
                } else {
                    Platform.requestNextPulse();
                }
            }
        }.start());
        assertTrue(observed.await(5, TimeUnit.SECONDS),
                "JavaFX did not deliver the requested verification pulses");
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

    private static void runOnFxUntil(long deadlineNanos, ThrowingRunnable action)
            throws Exception {
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
        long remaining = deadlineNanos - System.nanoTime();
        if (remaining <= 0L || !completed.await(remaining, TimeUnit.NANOSECONDS)) {
            throw new AssertionError("Warm switch hard timeout waiting for JavaFX work");
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
        });
        awaitFxCondition(stage::isFocused);
        runOnFx(() -> {
            fireKey(stage.getScene().getRoot(), javafx.scene.input.KeyCode.K, true);
        });
        awaitFxCondition(campaignHost::deskVisibleForTesting);
        awaitFxCondition(() -> campaignNameField(stage) != null
                && !campaignNameField(stage).isDisabled());
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

    private static void assertCampaignSidecarsAbsent(Path campaignPath) {
        assertFalse(Files.exists(campaignPath.resolveSibling(campaignPath.getFileName() + "-wal")));
        assertFalse(Files.exists(campaignPath.resolveSibling(campaignPath.getFileName() + "-shm")));
        assertFalse(Files.exists(
                campaignPath.resolveSibling(campaignPath.getFileName() + "-journal")));
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

    private static void awaitFxConditionUntil(
            java.util.function.BooleanSupplier condition,
            long deadlineNanos
    ) throws Exception {
        while (System.nanoTime() < deadlineNanos) {
            AtomicBoolean satisfied = new AtomicBoolean();
            runOnFxUntil(deadlineNanos, () -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Warm switch hard timeout waiting for JavaFX condition");
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

    private static java.util.Map<javafx.scene.input.KeyCombination, Runnable> acceleratorSnapshot(
            Stage stage
    ) throws Exception {
        AtomicReference<java.util.Map<javafx.scene.input.KeyCombination, Runnable>> snapshot =
                new AtomicReference<>();
        runOnFx(() -> snapshot.set(java.util.Map.copyOf(stage.getScene().getAccelerators())));
        return snapshot.get();
    }

    private static void awaitConditionUntil(
            java.util.function.BooleanSupplier condition,
            long deadlineNanos
    ) {
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() >= deadlineNanos) {
                throw new AssertionError("Warm switch hard timeout waiting for condition");
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
    }

    private static final class ProductionHostHarness
            implements CampaignActivationCoordinator.SwitchingHost {

        private final Stage window;
        private final CampaignDeskHost production;
        private final AtomicBoolean hideOnNextReadiness = new AtomicBoolean();
        private final AtomicBoolean holdNextReadinessTerminal = new AtomicBoolean();
        private final AtomicReference<CampaignDeskHost.RootReadinessAttempt> lastReadiness =
                new AtomicReference<>();
        private final AtomicReference<HeldReadinessAttempt> heldReadiness =
                new AtomicReference<>();
        private final AtomicReference<AppShell> lastSwitchedShell = new AtomicReference<>();
        private final AtomicReference<CountDownLatch> blockedFxRelease = new AtomicReference<>();
        private final AtomicInteger campaignPublications = new AtomicInteger();
        private final AtomicInteger recoveryPublications = new AtomicInteger();

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

        private void attachAndResume(CampaignActivationCoordinator coordinator) throws Exception {
            AtomicReference<CompletionStage<Void>> ready = new AtomicReference<>();
            runOnFx(() -> ready.set(production.attachAndResume(coordinator)));
            await(ready.get());
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
            lastSwitchedShell.set(shell);
            campaignPublications.incrementAndGet();
            return production.switchCampaign(campaign, generation, shell);
        }

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                features.campaign.api.CampaignSnapshot campaign,
                long generation,
                CampaignActivationCoordinator.PublicationSurface surface
        ) {
            lastSwitchedShell.set(java.util.Objects.requireNonNull(surface.shell()));
            campaignPublications.incrementAndGet();
            return production.switchCampaign(campaign, generation, surface);
        }

        @Override
        public CompletionStage<Void> showRecovery(
                java.util.Optional<features.campaign.api.CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType
        ) {
            recoveryPublications.incrementAndGet();
            CountDownLatch release = blockedFxRelease.getAndSet(null);
            if (release != null) {
                release.countDown();
            }
            return production.showRecovery(durableActivation, failureType);
        }

        @Override
        public CampaignActivationCoordinator.PublishedRootReadinessAttempt awaitPublishedRootReady(
                AppShell shell
        ) {
            if (hideOnNextReadiness.compareAndSet(true, false)) {
                window.hide();
            }
            CampaignDeskHost.RootReadinessAttempt readiness =
                    (CampaignDeskHost.RootReadinessAttempt)
                            production.awaitPublishedRootReady(shell);
            lastReadiness.set(readiness);
            if (holdNextReadinessTerminal.compareAndSet(true, false)) {
                HeldReadinessAttempt held = new HeldReadinessAttempt(readiness);
                heldReadiness.set(held);
                return held;
            }
            return readiness;
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

        void hideOnNextReadiness() {
            hideOnNextReadiness.set(true);
        }

        void holdNextReadinessTerminal() {
            holdNextReadinessTerminal.set(true);
        }

        void awaitHeldReadinessReady() throws Exception {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            HeldReadinessAttempt held;
            while ((held = heldReadiness.get()) == null && System.nanoTime() < deadline) {
                java.util.concurrent.locks.LockSupport.parkNanos(
                        TimeUnit.MILLISECONDS.toNanos(5));
            }
            if (held == null) {
                throw new AssertionError("No held readiness attempt was observed");
            }
            assertTrue(held.productionReady.await(10, TimeUnit.SECONDS),
                    "production published-root readiness did not become ready");
        }

        void blockActivationDispatchUntilRecovery() throws Exception {
            CountDownLatch entered = new CountDownLatch(1);
            CountDownLatch release = new CountDownLatch(1);
            if (!blockedFxRelease.compareAndSet(null, release)) {
                throw new IllegalStateException("JavaFX activation dispatch is already blocked");
            }
            Platform.runLater(() -> {
                entered.countDown();
                boolean interrupted = false;
                for (;;) {
                    try {
                        release.await();
                        break;
                    } catch (InterruptedException failure) {
                        interrupted = true;
                    }
                }
                if (interrupted) {
                    Thread.currentThread().interrupt();
                }
            });
            assertTrue(entered.await(10, TimeUnit.SECONDS),
                    "JavaFX activation terminal blocker did not start");
        }

        void releaseHeldReadinessTerminal() {
            java.util.Objects.requireNonNull(
                    heldReadiness.get(), "No held readiness attempt was observed")
                    .release();
        }

        int campaignPublications() {
            return campaignPublications.get();
        }

        int recoveryPublications() {
            return recoveryPublications.get();
        }

        int startupResumeAttempts() {
            return production.startupResumeAttemptsForTesting();
        }

        CampaignDeskHost.RootReadinessAttempt lastReadinessAttempt() {
            return java.util.Objects.requireNonNull(
                    lastReadiness.get(), "No published-root readiness was observed");
        }

        AppShell lastSwitchedShell() {
            return java.util.Objects.requireNonNull(lastSwitchedShell.get());
        }

        AppShell visibleCampaignRoot() throws Exception {
            awaitFxCondition(() -> window.getScene() != null
                    && window.getScene().getRoot() instanceof AppShell);
            AtomicReference<AppShell> root = new AtomicReference<>();
            runOnFx(() -> root.set((AppShell) window.getScene().getRoot()));
            return java.util.Objects.requireNonNull(root.get());
        }

        void showWindow() throws Exception {
            runOnFx(window::show);
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

        private static final class HeldReadinessAttempt
                implements CampaignActivationCoordinator.PublishedRootReadinessAttempt {
            private final CampaignDeskHost.RootReadinessAttempt delegate;
            private final CompletableFuture<Void> terminal = new CompletableFuture<>();
            private final CountDownLatch productionReady = new CountDownLatch(1);

            private HeldReadinessAttempt(CampaignDeskHost.RootReadinessAttempt delegate) {
                this.delegate = java.util.Objects.requireNonNull(delegate, "delegate");
                delegate.completion().whenComplete((ignored, failure) -> {
                    if (failure == null) {
                        productionReady.countDown();
                    } else {
                        terminal.completeExceptionally(failure);
                    }
                });
            }

            @Override
            public CompletionStage<Void> completion() {
                return terminal;
            }

            @Override
            public CompletionStage<Void> cancel() {
                return delegate.cancel();
            }

            private void release() {
                terminal.complete(null);
            }
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private enum StoreDamage { MISSING, TRUNCATED, DAMAGED, SYMBOLIC }
}
