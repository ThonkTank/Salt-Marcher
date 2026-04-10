package clean.startup;

import clean.startup.input.StartApplicationInput;
import javafx.scene.Scene;

/**
 * Startup owner for the clean application shell and stage presentation.
 */
public final class StartupObject {

    private final StartApplicationInput startup;

    public StartupObject(StartApplicationInput input) {
        this.startup = java.util.Objects.requireNonNull(input, "input");
        new StartupAssembly(startup).startApplication();
    }

    public StartApplicationInput startApplication(StartApplicationInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return startup;
    }

    private static final class StartupAssembly {

        private final StartApplicationInput input;

        private StartupAssembly(StartApplicationInput input) {
            this.input = input;
        }

        private void startApplication() {
            Scene scene = new Scene(input.root(), 1280, 800);
            if (!input.root().getStyleClass().contains("clean-root")) {
                input.root().getStyleClass().add("clean-root");
            }
            java.net.URL stylesheetUrl = StartupObject.class.getResource("/clean/clean.css");
            if (stylesheetUrl == null) {
                throw new IllegalStateException("Missing clean stylesheet: /clean/clean.css");
            }
            scene.getStylesheets().add(stylesheetUrl.toExternalForm());
            input.primaryStage().setTitle(input.applicationTitle());
            input.primaryStage().setScene(scene);
            input.primaryStage().setMinWidth(960);
            input.primaryStage().setMinHeight(640);
            input.primaryStage().show();
        }
    }
}
