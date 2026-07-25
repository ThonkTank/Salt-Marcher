package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignPointerCommitResult;
import features.creatures.api.CreatureLookupStatus;
import features.items.adapter.sqlite.SqliteItemCatalogAdapter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

final class InstallationCampaignLifetimeTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    @TempDir
    Path temporaryDirectory;

    @Test
    void installationReferencesOutliveCampaignsAndCampaignStoresRemainPhysicallyIsolated()
            throws Exception {
        Path installationPath = temporaryDirectory.resolve("installation.sqlite");
        Path alphaPath = temporaryDirectory.resolve("alpha.sqlite");
        Path betaPath = temporaryDirectory.resolve("beta.sqlite");

        try (InstallationRuntime installation = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE,
                new SqliteDatabase(installationPath, NoopDiagnostics.INSTANCE))) {
            InstallationRuntime.SharedReferences shared = installation.references();

            try (CampaignRuntime alpha = open(alphaPath, shared);
                    CampaignRuntime beta = open(betaPath, shared)) {
                await(alpha.foundationReadiness());
                await(beta.foundationReadiness());

                assertNotEquals(installationPath, alphaPath);
                assertNotEquals(alphaPath, betaPath);
                assertTrue(Files.isRegularFile(installationPath));
                assertTrue(Files.isRegularFile(alphaPath));
                assertTrue(Files.isRegularFile(betaPath));
                assertTrue(hasTable(installationPath, "campaign_registry_campaigns"));
                assertTrue(hasTable(installationPath, "creatures"));
                assertTrue(hasTable(installationPath, "items_catalog_entries"));
                assertFalse(hasTable(installationPath, "scene_running_scene"));
                assertTrue(hasTable(alphaPath, "scene_running_scene"));
                assertFalse(hasTable(alphaPath, "campaign_registry_campaigns"));
                assertFalse(hasTable(alphaPath, "creatures"));
                assertFalse(hasTable(alphaPath, "items_catalog_entries"));

                assertNotSame(alpha.components().creatures(), beta.components().creatures());
                assertNotSame(alpha.components().items(), beta.components().items());

                alpha.close();
                assertEquals(
                        CreatureLookupStatus.NOT_FOUND,
                        beta.components().creatures().references().find(Long.MAX_VALUE).status());
                assertEquals(CampaignListResult.Status.SUCCESS, await(installation.campaigns().list()).status());
            }

            updatePrimarySceneTitle(alphaPath, "Alpha Scene");
            try (CampaignRuntime alpha = open(alphaPath, shared);
                    CampaignRuntime beta = open(betaPath, shared)) {
                await(alpha.foundationReadiness());
                await(beta.foundationReadiness());
                assertEquals("Alpha Scene", primarySceneTitle(alpha));
                assertNotEquals("Alpha Scene", primarySceneTitle(beta));
            }

            try (CampaignRuntime referenceProbe = open(
                    temporaryDirectory.resolve("reference-probe.sqlite"), shared)) {
                await(referenceProbe.foundationReadiness());
                assertEquals(
                        CreatureLookupStatus.NOT_FOUND,
                        referenceProbe.components().creatures().references().find(Long.MAX_VALUE).status());
                assertDoesNotThrow(() -> new SqliteItemCatalogAdapter(shared.items()).isAvailable());
            }
            assertEquals(CampaignListResult.Status.SUCCESS, await(installation.campaigns().list()).status());
        }
    }

    @Test
    void terminalShutdownTimesOutInStoppingAndRetryClosesAfterRegistryWorkSettles()
            throws Exception {
        SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("bounded-installation-close.sqlite"),
                NoopDiagnostics.INSTANCE);
        InstallationRuntime installation = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE, database, Duration.ofMillis(50));
        java.util.concurrent.CountDownLatch running = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        installation.runRegistryTaskForTesting(() -> {
            running.countDown();
            boolean done = false;
            while (!done) {
                try {
                    release.await();
                    done = true;
                } catch (InterruptedException ignored) {
                    // Synthetic native dependency that ignores Java interruption.
                }
            }
        });
        assertTrue(running.await(5, TimeUnit.SECONDS));

        assertThrows(IllegalStateException.class, installation::close);
        assertTrue(installation.stoppingForTesting());
        assertThrows(IllegalStateException.class, installation::campaigns);

        release.countDown();
        installation.close();
        assertThrows(java.sql.SQLException.class, database::prepare);
    }

    @Test
    void realLockedRegistryCommitIsInterruptedOrTimesOutBoundedlyAndRestartIsCoherent()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("locked-registry-close.sqlite");
        InstallationRuntime installation = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE,
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE),
                Duration.ofMillis(250));
        CampaignId target = new CampaignId(
                java.util.UUID.fromString("33000000-0000-0000-0000-000000000001"));
        CompletionStage<CampaignPointerCommitResult> commit;
        boolean firstCloseSucceeded = false;
        try (var lock = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = lock.createStatement()) {
            statement.execute("BEGIN EXCLUSIVE");
            commit = installation.campaigns().registerAndCommitActivePointer(
                    target, "Locked target", 0L);
            awaitRegistryOperation(installation);

            long started = System.nanoTime();
            try {
                installation.close();
                firstCloseSucceeded = true;
            } catch (IllegalStateException boundedTimeout) {
                assertTrue(installation.stoppingForTesting());
            }
            assertTrue(System.nanoTime() - started < TimeUnit.SECONDS.toNanos(2),
                    "terminal installation close must remain bounded");
            statement.execute("ROLLBACK");
        }

        CampaignPointerCommitResult result = await(commit);
        assertEquals(CampaignPointerCommitResult.Status.STORAGE_ERROR, result.status());
        if (!firstCloseSucceeded) {
            installation.close();
        }

        try (InstallationRuntime restarted = InstallationRuntime.open(
                NoopDiagnostics.INSTANCE,
                new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE))) {
            var durable = await(restarted.campaigns().active()).activation().orElseThrow();
            assertTrue(durable.campaign().isEmpty()
                    || durable.campaign().orElseThrow().id().equals(target));
        }
    }

    private static CampaignRuntime open(
            Path campaignPath,
            InstallationRuntime.SharedReferences references) {
        return CampaignRuntime.open(
                NoopDiagnostics.INSTANCE,
                lane(),
                lane(),
                lane(),
                lane(),
                lane(),
                lane(),
                lane(),
                lane(),
                lane(),
                DirectUiDispatcher.INSTANCE,
                references,
                new SqliteDatabase(campaignPath, NoopDiagnostics.INSTANCE));
    }

    private static SerialExecutionLane lane() {
        return new SerialExecutionLane(NoopDiagnostics.INSTANCE);
    }

    private static String primarySceneTitle(CampaignRuntime runtime) {
        return runtime.components().scene().model().current().scenes().getFirst().title();
    }

    private static void updatePrimarySceneTitle(Path databasePath, String title) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "UPDATE scene_running_scene SET title = ? WHERE scene_id = 1")) {
            statement.setString(1, title);
            assertEquals(1, statement.executeUpdate());
        }
    }

    private static boolean hasTable(Path databasePath, String table) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static void awaitRegistryOperation(InstallationRuntime installation) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            if (installation.registryOperationActiveForTesting()) {
                return;
            }
            Thread.onSpinWait();
        }
        throw new AssertionError("registry operation did not reach SQLite");
    }
}
