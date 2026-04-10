package clean.startup;

import clean.frame.FrameObject;
import clean.frame.input.ComposeFrameInput;
import clean.navigation.NavigationObject;
import clean.navigation.input.ComposeNavigationInput;
import clean.startup.input.StartApplicationInput;
import clean.startup.task.StartApplicationTask;
import javafx.scene.Scene;
import javafx.scene.layout.BorderPane;

/**
 * Startup owner for the clean application shell and stage presentation.
 */
@SuppressWarnings("unused")
public final class StartupObject {

    private final NavigationObject navigationObject = new NavigationObject();
    private final FrameObject frameObject = new FrameObject();

    public void startApplication(StartApplicationInput input) {
        StartApplicationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ComposeNavigationInput composeNavigationInput = StartApplicationTask.startApplication(resolvedInput);
        ComposeNavigationInput.NavigationInput navigation = navigationObject.composeNavigation(composeNavigationInput);
        ComposeFrameInput composeFrameInput = new ComposeFrameInput(
                navigation.toolbarContent(),
                navigation.navigationContent(),
                navigation.controlsContent(),
                navigation.mainContent(),
                navigation.detailsContent(),
                navigation.stateContent());
        ComposeFrameInput.FrameInput frame = frameObject.composeFrame(composeFrameInput);
        showStage(frame, resolvedInput);
    }

    private void showStage(ComposeFrameInput.FrameInput frame, StartApplicationInput input) {
        BorderPane root = frame.root();
        Scene scene = new Scene(root, 1280, 800);
        java.net.URL stylesheet = StartupObject.class.getResource("/clean/clean.css");
        if (stylesheet != null) {
            scene.getStylesheets().add(stylesheet.toExternalForm());
        }
        input.primaryStage().setTitle(input.applicationTitle());
        input.primaryStage().setScene(scene);
        input.primaryStage().setMinWidth(960);
        input.primaryStage().setMinHeight(640);
        input.primaryStage().show();
    }
}
