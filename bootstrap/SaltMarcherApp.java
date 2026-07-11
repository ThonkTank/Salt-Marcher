package bootstrap;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.scene.Scene;
import javafx.stage.Stage;
import shell.host.AppShell;

/**
 * Desktop entrypoint for the new SaltMarcher shell.
 */
public final class SaltMarcherApp extends Application {

    @Override
    public void start(Stage primaryStage) {
        Platform.setImplicitExit(true);

        AppShell shell = new AppBootstrap().createShell();
        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(SaltMarcherApp.class.getResource("/salt-marcher.css").toExternalForm());

        primaryStage.setTitle("SaltMarcher");
        DesktopWindowIcons.applyTo(primaryStage);
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();

        notifyPreloader(new SaltMarcherPreloader.AppReadyNotification());
        notifyPreloader(new Preloader.StateChangeNotification(
                Preloader.StateChangeNotification.Type.BEFORE_START));
    }

    public static void main(String[] args) {
        launch(args);
    }
}
