package launcher.dungeonclean.startup;

import database.DatabaseManager;
import features.appshell.async.input.ComposeAsyncInput;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.scene.control.Alert;
import launcher.dungeonclean.startup.input.ShowMainStageInput;
import launcher.dungeonclean.startup.input.StartApplicationInput;
import ui.bootstrap.preloader.PreloaderObject;

public final class StartupObject {

    private static final String STARTUP_ERROR_TITLE = "Start fehlgeschlagen";
    private static final String STARTUP_ERROR_TEXT = "Salt Marcher konnte nicht gestartet werden.";
    private final ComposeAsyncInput.AsyncInput async;

    public StartupObject(ComposeAsyncInput.AsyncInput async) {
        this.async = java.util.Objects.requireNonNull(async, "async");
    }

    public void start(StartApplicationInput input) {
        Platform.setImplicitExit(false);
        async.submitBackground().accept(new ComposeAsyncInput.SubmitBackgroundInput(
                "StartupObject.start()",
                () -> {
                    DatabaseManager.setupDatabase();
                    return null;
                },
                () -> showMainStage(input),
                throwable -> handleStartupFailure(input, throwable),
                null));
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
        async.reportBackgroundFailure().accept(new ComposeAsyncInput.ReportBackgroundFailureInput(
                "StartupObject.start()",
                throwable));
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
