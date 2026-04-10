package clean.startup;

import clean.frame.FrameObject;
import clean.frame.input.ComposeFrameInput;
import clean.navigation.NavigationObject;
import clean.navigation.input.ComposeNavigationInput;
import clean.startup.input.StartApplicationInput;
import javafx.scene.Scene;
import javafx.scene.layout.BorderPane;

/**
 * Startup owner for the clean application shell and stage presentation.
 */
@SuppressWarnings("unused")
public final class StartupObject {

    public void startApplication(StartApplicationInput input) {
        StartApplicationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ComposeNavigationInput composeNavigationInput = new ComposeNavigationInput(
                resolvedInput.surfaces(),
                resolvedInput.initialSurfaceId());
        ComposeNavigationInput.NavigationInput navigation =
                new NavigationObject().composeNavigation(composeNavigationInput);
        ComposeFrameInput composeFrameInput = new ComposeFrameInput(
                navigation.toolbarContent(),
                navigation.navigationContent(),
                navigation.controlsContent(),
                navigation.mainContent(),
                navigation.detailsContent(),
                navigation.stateContent());
        BorderPane root = new FrameObject().composeFrame(composeFrameInput).root();
        Scene scene = new Scene(root, 1280, 800);
        java.net.URL stylesheet = StartupObject.class.getResource("/clean/clean.css");
        if (stylesheet != null) {
            scene.getStylesheets().add(stylesheet.toExternalForm());
        }
        resolvedInput.primaryStage().setTitle(resolvedInput.applicationTitle());
        resolvedInput.primaryStage().setScene(scene);
        resolvedInput.primaryStage().setMinWidth(960);
        resolvedInput.primaryStage().setMinHeight(640);
        resolvedInput.primaryStage().show();
    }
}
