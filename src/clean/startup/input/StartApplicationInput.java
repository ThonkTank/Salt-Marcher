package clean.startup.input;

import javafx.stage.Stage;
import javafx.scene.layout.VBox;

@SuppressWarnings("unused")
public record StartApplicationInput(
        Stage primaryStage,
        String applicationTitle,
        VBox root
) {
}
