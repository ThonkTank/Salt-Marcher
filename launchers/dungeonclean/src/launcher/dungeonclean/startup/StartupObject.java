package launcher.dungeonclean.startup;

import database.DatabaseManager;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.concurrent.Task;
import javafx.scene.control.Alert;
import launcher.dungeonclean.startup.input.ShowMainStageInput;
import launcher.dungeonclean.startup.input.StartApplicationInput;
import ui.async.UiErrorReporter;
import ui.bootstrap.preloader.PreloaderObject;

public final class StartupObject {

    private static final String STARTUP_ERROR_TITLE = "Start fehlgeschlagen";
    private static final String STARTUP_ERROR_TEXT = "Salt Marcher konnte nicht gestartet werden.";

    public void start(StartApplicationInput input) {
        Platform.setImplicitExit(false);
        Task<Void> startupTask = new Task<>() {
            @Override
            protected Void call() {
                DatabaseManager.setupDatabase();
                return null;
            }
        };
        startupTask.setOnSucceeded(event -> showMainStage(input));
        startupTask.setOnFailed(event -> handleStartupFailure(input, startupTask.getException()));
        Thread startupThread = new Thread(startupTask, "sm-startup");
        startupThread.setDaemon(false);
        startupThread.start();
    }

    private void showMainStage(StartApplicationInput input) {
        try {
            input.showMainStage().accept(new ShowMainStageInput(input.primaryStage()));
            Platform.setImplicitExit(true);
            input.notifyPreloader().accept(new PreloaderObject.AppReadyNotification());
        } catch (RuntimeException exception) {
            handleStartupFailure(input, exception);
        }
    }

    private void handleStartupFailure(StartApplicationInput input, Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("StartupObject.start()", throwable);
        input.notifyPreloader().accept(new Preloader.StateChangeNotification(
                Preloader.StateChangeNotification.Type.BEFORE_START));

        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle(STARTUP_ERROR_TITLE);
        alert.setHeaderText(STARTUP_ERROR_TEXT);
        alert.setContentText(throwable == null ? "Unbekannter Fehler beim Start." : throwable.getMessage());
        alert.showAndWait();

        Platform.exit();
    }
}
