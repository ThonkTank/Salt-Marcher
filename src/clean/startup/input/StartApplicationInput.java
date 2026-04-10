package clean.startup.input;

import javafx.scene.Parent;
import javafx.stage.Stage;

public record StartApplicationInput(
        Stage primaryStage,
        String applicationTitle,
        Parent root
) {
}
