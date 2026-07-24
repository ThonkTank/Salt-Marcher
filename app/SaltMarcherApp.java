package app;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;
import shell.host.AppShell;

/**
 * Desktop entrypoint for the new SaltMarcher shell.
 */
public final class SaltMarcherApp extends Application {

    private AppBootstrap bootstrap;

    public SaltMarcherApp() {
    }

    SaltMarcherApp(AppBootstrap bootstrap) {
        this.bootstrap = java.util.Objects.requireNonNull(bootstrap, "bootstrap");
    }

    @Override
    public void start(Stage primaryStage) {
        Platform.setImplicitExit(true);

        if (bootstrap == null) {
            bootstrap = new AppBootstrap();
        }
        Label loading = new Label("SaltMarcher wird vorbereitet …");
        loading.setAccessibleText("SaltMarcher wird vorbereitet");
        Scene scene = new Scene(new StackPane(loading), 1150, 700);
        scene.getStylesheets().add(SaltMarcherApp.class.getResource("/salt-marcher.css").toExternalForm());

        primaryStage.setTitle("SaltMarcher");
        DesktopWindowIcons.applyTo(primaryStage);
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();
        bootstrap.createShellAsync().whenComplete((shell, failure) -> {
            Runnable publication = () -> {
                if (failure != null) {
                    loading.setText("SaltMarcher konnte nicht gestartet werden.");
                    loading.setAccessibleText("SaltMarcher Start fehlgeschlagen");
                    return;
                }
                bootstrap.publishAndActivateShell(shell, () -> {
                    primaryStage.setScene(java.util.Objects.requireNonNull(
                            shell.getScene(), "Prepared shell must retain its qualified Scene"));
                    shell.applyCss();
                    shell.layout();
                }).whenComplete((ignored, activationFailure) -> {
                    if (activationFailure != null) {
                        throw new IllegalStateException("Prepared shell activation failed", activationFailure);
                    }
                    notifyPreloader(new SaltMarcherPreloader.AppReadyNotification());
                    notifyPreloader(new Preloader.StateChangeNotification(
                            Preloader.StateChangeNotification.Type.BEFORE_START));
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

    @Override
    public void stop() {
        if (bootstrap != null) {
            bootstrap.close();
        }
    }
}
