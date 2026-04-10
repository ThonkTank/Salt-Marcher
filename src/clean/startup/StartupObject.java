package clean.startup;

import clean.startup.input.StartApplicationInput;
import javafx.scene.Scene;

/**
 * Startup owner for the clean application shell and stage presentation.
 */
@SuppressWarnings("unused")
public final class StartupObject {

    public StartApplicationInput startApplication(StartApplicationInput input) {
        if (input == null) {
            throw new NullPointerException("input");
        }
        showStage(input);
        return input;
    }

    private void showStage(StartApplicationInput input) {
        Scene scene = new Scene(input.root(), 1280, 800);
        input.primaryStage().setTitle(input.applicationTitle());
        input.primaryStage().setScene(scene);
        input.primaryStage().setMinWidth(960);
        input.primaryStage().setMinHeight(640);
        input.primaryStage().show();
    }
}
