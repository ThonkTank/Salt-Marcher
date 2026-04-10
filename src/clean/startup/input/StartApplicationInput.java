package clean.startup.input;

import clean.navigation.input.ComposeNavigationInput;
import javafx.stage.Stage;

@SuppressWarnings("unused")
public record StartApplicationInput(
        Stage primaryStage,
        String applicationTitle,
        java.util.List<ComposeNavigationInput.SurfaceInput> surfaces,
        String initialSurfaceId
) {
}
