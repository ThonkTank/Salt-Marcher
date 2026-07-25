package app;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.stage.Stage;
import platform.persistence.SqliteDatabase;

/**
 * Desktop entrypoint for the new SaltMarcher shell.
 */
public final class SaltMarcherApp extends Application {

    private AppBootstrap bootstrap;
    private java.nio.file.Path campaignRoot;
    private CampaignDeskHost campaignHost;

    public SaltMarcherApp() {
    }

    SaltMarcherApp(AppBootstrap bootstrap) {
        this(bootstrap, defaultCampaignRoot());
    }

    SaltMarcherApp(AppBootstrap bootstrap, java.nio.file.Path campaignRoot) {
        this.bootstrap = java.util.Objects.requireNonNull(bootstrap, "bootstrap");
        this.campaignRoot = java.util.Objects.requireNonNull(campaignRoot, "campaignRoot")
                .toAbsolutePath().normalize();
    }

    @Override
    public void start(Stage primaryStage) {
        Platform.setImplicitExit(true);

        if (bootstrap == null) {
            bootstrap = new AppBootstrap();
        }
        primaryStage.setTitle("SaltMarcher");
        DesktopWindowIcons.applyTo(primaryStage);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        campaignHost = new CampaignDeskHost(primaryStage);
        campaignHost.showInitialLoading();
        primaryStage.show();
        if (campaignRoot == null) {
            campaignRoot = defaultCampaignRoot();
        }
        bootstrap.openCampaignActivationAsync(campaignRoot, campaignHost)
                .whenComplete((coordinator, failure) -> {
            Runnable publication = () -> {
                if (failure != null) {
                    campaignHost.showStartupFailure();
                    return;
                }
                campaignHost.attachAndResume(coordinator).whenComplete((ignored, resumeFailure) -> {
                    Runnable ready = () -> {
                        if (resumeFailure != null) {
                            campaignHost.showStartupFailure();
                            return;
                        }
                        notifyPreloader(new SaltMarcherPreloader.AppReadyNotification());
                        notifyPreloader(new javafx.application.Preloader.StateChangeNotification(
                                javafx.application.Preloader.StateChangeNotification.Type.BEFORE_START));
                    };
                    if (Platform.isFxApplicationThread()) {
                        ready.run();
                    } else {
                        Platform.runLater(ready);
                    }
                });
            };
            if (Platform.isFxApplicationThread()) {
                publication.run();
            } else {
                Platform.runLater(publication);
            }
        });
    }

    public static void main(String[] args) {
        launch(args);
    }

    private static java.nio.file.Path defaultCampaignRoot() {
        return SqliteDatabase.resolveDatabasePath(AppBootstrap.INSTALLATION_DATABASE_FILE_NAME)
                .resolveSibling("campaigns");
    }

    CampaignDeskHost campaignHostForTesting() {
        return java.util.Objects.requireNonNull(campaignHost, "Application has not started");
    }

    @Override
    public void stop() {
        if (bootstrap != null) {
            bootstrap.close();
        }
    }
}
