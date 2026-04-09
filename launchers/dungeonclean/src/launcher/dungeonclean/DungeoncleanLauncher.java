package launcher.dungeonclean;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.world.dungeonclean.DungeoncleanObject;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.stage.Stage;
import ui.async.UiErrorReporter;
import ui.bootstrap.preloader.PreloaderObject;
import ui.shell.AppShell;
import ui.shell.ViewId;

import java.util.logging.Level;
import java.util.logging.Logger;

public final class DungeoncleanLauncher extends Application {

    private static final Logger LOGGER = Logger.getLogger(DungeoncleanLauncher.class.getName());
    private static final String STARTUP_ERROR_TITLE = "Start fehlgeschlagen";
    private static final String STARTUP_ERROR_TEXT = "Salt Marcher konnte nicht gestartet werden.";

    @Override
    public void start(Stage primaryStage) {
        Platform.setImplicitExit(false);
        Task<Void> startupTask = new Task<>() {
            @Override
            protected Void call() {
                DatabaseManager.setupDatabase();
                logDatabaseState();
                return null;
            }
        };
        startupTask.setOnSucceeded(event -> {
            try {
                showMainStage(primaryStage);
            } catch (RuntimeException exception) {
                handleStartupFailure(exception);
            }
        });
        startupTask.setOnFailed(event -> handleStartupFailure(startupTask.getException()));
        Thread startupThread = new Thread(startupTask, "sm-startup");
        startupThread.setDaemon(false);
        startupThread.start();
    }

    private void showMainStage(Stage primaryStage) {
        AppShell shell = new AppShell();
        DungeoncleanObject dungeoncleanObject = new DungeoncleanObject();
        var views = dungeoncleanObject.views(new features.world.dungeonclean.input.ViewsInput(null));

        shell.registerView(ViewId.DUNGEON_EDITOR, views.dungeonCleanView());

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        shell.navigateTo(ViewId.DUNGEON_EDITOR);

        primaryStage.setTitle("Salt Marcher");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();
        Platform.setImplicitExit(true);
        notifyPreloader(new PreloaderObject.AppReadyNotification());
    }

    private void handleStartupFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("DungeoncleanLauncher.start()", throwable);
        notifyPreloader(new Preloader.StateChangeNotification(
                Preloader.StateChangeNotification.Type.BEFORE_START));

        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle(STARTUP_ERROR_TITLE);
        alert.setHeaderText(STARTUP_ERROR_TEXT);
        alert.setContentText(throwable == null ? "Unbekannter Fehler beim Start." : throwable.getMessage());
        alert.showAndWait();

        Platform.exit();
    }

    private static void logDatabaseState() {
        CreatureCatalogService.ServiceResult<Integer> countResult = CreatureCatalogService.countAll();
        if (!countResult.isOk()) {
            LOGGER.log(Level.INFO, "Database check unavailable (DB access failed).");
        } else if (countResult.value() == 0) {
            LOGGER.log(Level.INFO, "Database is empty. Run ./scripts/crawl.sh to populate monster data.");
        } else {
            LOGGER.log(Level.INFO, "Database ready: {0} creatures loaded.", countResult.value());
        }
    }

    public static void main(String[] args) {
        launch(DungeoncleanLauncher.class, args);
    }
}
