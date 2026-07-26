package app;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javafx.stage.Stage;
import org.junit.jupiter.api.Test;
import platform.persistence.SqliteDatabase;

/** Production-default startup proof for the one supported Campaign activation route. */
@org.junit.jupiter.api.Tag("ui")
public final class SmokeStartupTest {

    private static final String FORMER_MIXED_DATABASE_FILE_NAME = "game.db";

    @Test
    void defaultStartupUsesInstallationStoreAndNeverOpensFormerMixedStore() throws Exception {
        Path installationPath = SqliteDatabase.resolveDatabasePath(
                AppBootstrap.INSTALLATION_DATABASE_FILE_NAME);
        Path formerMixedStore = SqliteDatabase.resolveDatabasePath(
                FORMER_MIXED_DATABASE_FILE_NAME);
        Path campaignRoot = installationPath.resolveSibling("campaigns");
        assertTrue(installationPath.startsWith(Path.of("build").toAbsolutePath().normalize()),
                "default startup proof must stay inside Gradle's isolated data root");
        assertFalse(installationPath.equals(formerMixedStore));

        byte[] sentinel = "not-a-sqlite-legacy-sentinel".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        Files.createDirectories(formerMixedStore.getParent());
        Files.write(formerMixedStore, sentinel);

        AtomicReference<Stage> stage = new AtomicReference<>();
        AtomicReference<CampaignDeskHost> host = new AtomicReference<>();
        runOnFx(() -> {
            Stage window = new Stage();
            CampaignDeskHost campaignHost = new CampaignDeskHost(window);
            campaignHost.showInitialLoading();
            window.show();
            stage.set(window);
            host.set(campaignHost);
        });

        try {
            try (AppBootstrap bootstrap = new AppBootstrap()) {
                CampaignActivationCoordinator coordinator = bootstrap.openCampaignActivationAsync(
                        campaignRoot, host.get()).toCompletableFuture().get(
                                30, TimeUnit.SECONDS);
                runOnFx(() -> host.get().attach(coordinator));
                coordinator.resumeDurableActive().toCompletableFuture().get(30, TimeUnit.SECONDS);
                CampaignActivationCoordinator.Result created = coordinator.create(
                        "Fresh Campaign", 0L).toCompletableFuture().get(30, TimeUnit.SECONDS);
                assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, created.status());
                assertTrue(Files.isRegularFile(created.campaignPath().orElseThrow()));
            }
        } finally {
            if (stage.get() != null) {
                runOnFx(stage.get()::close);
            }
        }

        assertTrue(Files.isRegularFile(installationPath));
        assertArrayEquals(sentinel, Files.readAllBytes(formerMixedStore),
                "production default startup must not open or rewrite the former mixed store");
    }

    private static void runOnFx(Runnable action) throws Exception {
        java.util.concurrent.CountDownLatch complete = new java.util.concurrent.CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                action.run();
            } catch (Throwable thrown) {
                failure.set(thrown);
            } finally {
                complete.countDown();
            }
        });
        assertTrue(complete.await(30, TimeUnit.SECONDS), "JavaFX action timed out");
        if (failure.get() != null) {
            throw new AssertionError(failure.get());
        }
    }
}
