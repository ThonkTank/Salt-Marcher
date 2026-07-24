package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignListResult;
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
}
