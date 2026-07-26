package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

final class AppBootstrapLifecycleTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void closeDrainsAcceptedCampaignStartupThenClosesItsLateCoordinator() throws Exception {
        platform.execution.SerialExecutionLane startup =
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE);
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("campaign-handoff-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                startup,
                DirectUiDispatcher.INSTANCE,
                installation);
        java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        bootstrap.installCampaignStartupGateForTesting(() -> {
            entered.countDown();
            try {
                release.await();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
        });
        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("campaign-handoff-root"),
                new CampaignActivationCoordinator.SwitchingHost() {
                    @Override
                    public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                            features.campaign.api.CampaignSnapshot campaign,
                            long generation,
                            shell.host.AppShell shell
                    ) {
                        return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
                    }

                    @Override
                    public java.util.concurrent.CompletionStage<Void> showRecovery(
                            java.util.Optional<features.campaign.api.CampaignActivation> activation,
                            Class<? extends Throwable> failureType
                    ) {
                        return java.util.concurrent.CompletableFuture.completedFuture(null);
                    }
                }).toCompletableFuture();
        assertTrue(entered.await(5, java.util.concurrent.TimeUnit.SECONDS));

        var closing = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        assertFalse(bootstrap.termination().toCompletableFuture().isDone());
        release.countDown();

        closing.get(5, java.util.concurrent.TimeUnit.SECONDS);
        assertTrue(opened.isCompletedExceptionally());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());
        assertThrows(java.sql.SQLException.class, installation::prepare);
    }

    @Test
    void closeClaimDuringCoordinatorHandoffClosesLocalOwnersAndFailsOpenFuture()
            throws Exception {
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("coordinator-handoff-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectUiDispatcher.INSTANCE,
                installation);
        java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        bootstrap.installCampaignCoordinatorHandoffGateForTesting(() -> {
            entered.countDown();
            try {
                release.await();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
        });
        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("coordinator-handoff-root"),
                noOpSwitchingHost()).toCompletableFuture();
        assertTrue(entered.await(5, java.util.concurrent.TimeUnit.SECONDS));

        var closing = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        long closeClaimDeadline = System.nanoTime()
                + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
        while (!bootstrap.closeRequestedForTesting() && System.nanoTime() < closeClaimDeadline) {
            Thread.onSpinWait();
        }
        assertTrue(bootstrap.closeRequestedForTesting());
        release.countDown();
        closing.get(5, java.util.concurrent.TimeUnit.SECONDS);

        assertTrue(opened.isCompletedExceptionally());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());
        assertThrows(java.sql.SQLException.class, installation::prepare);
    }

    @Test
    void neverReturningAcceptedStartupHasBoundedSingleStopAndLateCompletionIsContained()
            throws Exception {
        platform.execution.SerialExecutionLane startup =
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE);
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("bounded-startup-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                startup,
                DirectUiDispatcher.INSTANCE,
                installation);
        bootstrap.installStartupShutdownTimeoutForTesting(java.time.Duration.ofMillis(100));
        java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean release = new java.util.concurrent.atomic.AtomicBoolean();
        java.util.concurrent.atomic.AtomicInteger coordinatorHandoffs =
                new java.util.concurrent.atomic.AtomicInteger();
        bootstrap.installCampaignStartupGateForTesting(() -> {
            entered.countDown();
            while (!release.get()) {
                java.util.concurrent.locks.LockSupport.parkNanos(
                        java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(5));
                Thread.interrupted();
            }
        });
        bootstrap.installCampaignCoordinatorHandoffGateForTesting(
                coordinatorHandoffs::incrementAndGet);
        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("bounded-startup-root"),
                noOpSwitchingHost()).toCompletableFuture();
        assertTrue(entered.await(5, java.util.concurrent.TimeUnit.SECONDS));

        long started = System.nanoTime();
        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);
        long elapsedMillis = java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(
                System.nanoTime() - started);

        assertTrue(elapsedMillis < 2_000L, "terminal startup shutdown must be bounded");
        assertTrue(opened.isCompletedExceptionally());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertEquals(0, coordinatorHandoffs.get());
        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, bootstrap::close);
        release.set(true);
        long terminationDeadline = System.nanoTime()
                + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
        while ((!startup.terminated() || !bootstrap.closeExecutorTerminatedForTesting())
                && System.nanoTime() < terminationDeadline) {
            Thread.onSpinWait();
        }
        assertTrue(startup.terminated());
        assertTrue(bootstrap.closeExecutorTerminatedForTesting());
        assertEquals(0, coordinatorHandoffs.get(),
                "late startup completion must not publish a coordinator");
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertThrows(java.sql.SQLException.class, installation::prepare);
    }

    @Test
    void campaignStartupGateErrorSettlesAcceptedFutureWithoutCreatingOwners() throws Exception {
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("startup-gate-error-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectUiDispatcher.INSTANCE,
                installation);
        AssertionError injected = new AssertionError("injected startup gate error");
        bootstrap.installCampaignStartupGateForTesting(() -> { throw injected; });

        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("startup-gate-error-root"),
                noOpSwitchingHost()).toCompletableFuture();
        java.util.concurrent.ExecutionException reported = org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.ExecutionException.class,
                () -> opened.get(5, java.util.concurrent.TimeUnit.SECONDS));

        assertEquals(injected, reported.getCause());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertEquals(0, bootstrap.installationRuntimeCloseClaimsForTesting());
        bootstrap.close();
        assertThrows(java.sql.SQLException.class, installation::prepare);
    }

    @Test
    void coordinatorHandoffErrorClosesLocalInstallationExactlyOnce() throws Exception {
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("handoff-error-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectUiDispatcher.INSTANCE,
                installation);
        AssertionError injected = new AssertionError("injected coordinator handoff error");
        bootstrap.installCampaignCoordinatorHandoffGateForTesting(() -> { throw injected; });

        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("handoff-error-root"),
                noOpSwitchingHost()).toCompletableFuture();
        java.util.concurrent.ExecutionException reported = org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.ExecutionException.class,
                () -> opened.get(5, java.util.concurrent.TimeUnit.SECONDS));

        assertEquals(injected, reported.getCause());
        assertFalse(bootstrap.installationRuntimeRetainedForTesting());
        assertFalse(bootstrap.campaignActivationRetainedForTesting());
        assertEquals(1, bootstrap.installationRuntimeCloseClaimsForTesting());
        assertThrows(java.sql.SQLException.class, installation::prepare);
        bootstrap.close();
        assertEquals(1, bootstrap.installationRuntimeCloseClaimsForTesting());
    }

    @Test
    void singleCloseRetainsTimedOutInstallationUntilRegistrySettlementThenCleansItLocally()
            throws Exception {
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("late-registry-installation.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new platform.execution.SerialExecutionLane(NoopDiagnostics.INSTANCE),
                DirectUiDispatcher.INSTANCE,
                installation);
        bootstrap.installInstallationShutdownTimeoutForTesting(
                java.time.Duration.ofMillis(100));
        bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("late-registry-campaigns"),
                noOpSwitchingHost()).toCompletableFuture().get(
                        5, java.util.concurrent.TimeUnit.SECONDS);
        java.util.concurrent.CountDownLatch registryEntered =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean releaseRegistry =
                new java.util.concurrent.atomic.AtomicBoolean();
        bootstrap.runInstallationRegistryTaskForTesting(() -> {
            registryEntered.countDown();
            while (!releaseRegistry.get()) {
                java.util.concurrent.locks.LockSupport.parkNanos(
                        java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(5));
                Thread.interrupted();
            }
        });
        assertTrue(registryEntered.await(5, java.util.concurrent.TimeUnit.SECONDS));

        long started = System.nanoTime();
        assertThrows(java.util.concurrent.CompletionException.class, bootstrap::close);
        long elapsedMillis = java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(
                System.nanoTime() - started);

        assertTrue(elapsedMillis < 2_000L, "single stop must remain bounded");
        assertTrue(bootstrap.termination().toCompletableFuture().isCompletedExceptionally());
        AppBootstrap.InstallationOwnershipSnapshot retained =
                bootstrap.installationOwnershipForTesting();
        assertTrue(retained.runtimeRetained());
        assertFalse(retained.resourcesClosed());
        assertTrue(bootstrap.closeExecutorShutdownForTesting());
        assertEquals(1, bootstrap.installationRuntimeCloseClaimsForTesting());

        releaseRegistry.set(true);
        java.util.concurrent.atomic.AtomicBoolean incoherentOwnershipObserved =
                new java.util.concurrent.atomic.AtomicBoolean();
        long cleanupDeadline = System.nanoTime()
                + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
        while (bootstrap.installationRuntimeRetainedForTesting()
                && System.nanoTime() < cleanupDeadline) {
            AppBootstrap.InstallationOwnershipSnapshot observed =
                    bootstrap.installationOwnershipForTesting();
            if (observed.runtimeRetained() == observed.resourcesClosed()) {
                incoherentOwnershipObserved.set(true);
            }
            Thread.onSpinWait();
        }
        AppBootstrap.InstallationOwnershipSnapshot closed =
                bootstrap.installationOwnershipForTesting();
        assertFalse(incoherentOwnershipObserved.get(),
                "ownership must transition atomically from retained/open to cleared/closed");
        assertFalse(closed.runtimeRetained());
        assertTrue(closed.resourcesClosed());
        assertEquals(2, bootstrap.installationRuntimeCloseClaimsForTesting());
        assertTrue(bootstrap.termination().toCompletableFuture().isCompletedExceptionally(),
                "late cleanup must not rewrite the bounded terminal failure");
        assertThrows(java.sql.SQLException.class, installation::prepare);
    }

    @Test
    void rawInstallationCloseClaimLosesAtomicallyToLateRuntimePublication() throws Exception {
        DetachedStartupLane startup = new DetachedStartupLane();
        SqliteDatabase installation = new SqliteDatabase(
                temporaryDirectory.resolve("installation-claim-race.sqlite"),
                NoopDiagnostics.INSTANCE);
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                startup,
                DirectUiDispatcher.INSTANCE,
                installation);
        java.util.concurrent.CountDownLatch beforeAcquire =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch allowAcquire =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch runtimePublished =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch allowStartupToObserveClose =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch rawCloseObservedEmpty =
                new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch allowRawClaim =
                new java.util.concurrent.CountDownLatch(1);
        bootstrap.installPreInstallationAcquireGateForTesting(() -> {
            beforeAcquire.countDown();
            awaitLatch(allowAcquire);
        });
        bootstrap.installPostInstallationAcquireGateForTesting(() -> {
            runtimePublished.countDown();
            awaitLatch(allowStartupToObserveClose);
        });
        bootstrap.installInstallationRawCloseClaimGateForTesting(() -> {
            rawCloseObservedEmpty.countDown();
            awaitLatch(allowRawClaim);
        });
        var opened = bootstrap.openCampaignActivationAsync(
                temporaryDirectory.resolve("installation-claim-race-campaigns"),
                noOpSwitchingHost()).toCompletableFuture();
        assertTrue(beforeAcquire.await(5, java.util.concurrent.TimeUnit.SECONDS));

        var closing = java.util.concurrent.CompletableFuture.runAsync(bootstrap::close);
        assertTrue(rawCloseObservedEmpty.await(5, java.util.concurrent.TimeUnit.SECONDS));
        allowAcquire.countDown();
        assertTrue(runtimePublished.await(5, java.util.concurrent.TimeUnit.SECONDS));

        allowRawClaim.countDown();
        closing.get(5, java.util.concurrent.TimeUnit.SECONDS);
        AppBootstrap.InstallationOwnershipSnapshot closed =
                bootstrap.installationOwnershipForTesting();
        assertFalse(closed.runtimeRetained());
        assertTrue(closed.resourcesClosed());
        assertEquals(1, bootstrap.installationRuntimeCloseClaimsForTesting());
        assertThrows(java.sql.SQLException.class, installation::prepare);

        allowStartupToObserveClose.countDown();
        assertThrows(java.util.concurrent.ExecutionException.class,
                () -> opened.get(5, java.util.concurrent.TimeUnit.SECONDS));
    }

    private static CampaignActivationCoordinator.SwitchingHost noOpSwitchingHost() {
        return new CampaignActivationCoordinator.SwitchingHost() {
            @Override
            public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                    features.campaign.api.CampaignSnapshot campaign,
                    long generation,
                    shell.host.AppShell shell
            ) {
                return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
            }

            @Override
            public java.util.concurrent.CompletionStage<Void> showRecovery(
                    java.util.Optional<features.campaign.api.CampaignActivation> activation,
                    Class<? extends Throwable> failureType
            ) {
                return java.util.concurrent.CompletableFuture.completedFuture(null);
            }
        };
    }

    private static void awaitLatch(java.util.concurrent.CountDownLatch latch) {
        try {
            if (!latch.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new AssertionError("latch timed out");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError(interrupted);
        }
    }

    private static final class DetachedStartupLane implements ExecutionLane {
        @Override
        public void execute(Runnable work) {
            Thread worker = new Thread(work, "detached-startup-test");
            worker.setDaemon(true);
            worker.start();
        }

        @Override
        public void close() {
        }
    }
}
