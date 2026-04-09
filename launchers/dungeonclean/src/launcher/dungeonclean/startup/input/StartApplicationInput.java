package launcher.dungeonclean.startup.input;

import javafx.application.Preloader;
import javafx.stage.Stage;

import java.util.function.Consumer;

public record StartApplicationInput(
        Stage primaryStage,
        Consumer<ShowMainStageInput> showMainStage,
        Consumer<Preloader.PreloaderNotification> notifyPreloader
) {
}
