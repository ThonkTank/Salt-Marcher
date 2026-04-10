package clean.navigation;

import clean.navigation.input.ComposeNavigationInput;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Navigation owner for clean surface switching and panel projection.
 */
@SuppressWarnings("unused")
public final class NavigationObject {

    public ComposeNavigationInput.NavigationInput composeNavigation(ComposeNavigationInput input) {
        ComposeNavigationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ComposeNavigationInput.SurfaceInput activeSurface = resolvedInput.activeSurface();
        HBox toolbarContent = new HBox(activeSurface.toolbarContent());
        VBox navigationContent = new VBox(new Label(activeSurface.navigationLabel()));
        StackPane controlsContent = new StackPane(activeSurface.controlsContent());
        StackPane mainContent = new StackPane(activeSurface.mainContent());
        StackPane detailsContent = new StackPane(activeSurface.detailsContent());
        StackPane stateContent = new StackPane(activeSurface.stateContent());
        return new ComposeNavigationInput.NavigationInput(
                toolbarContent,
                navigationContent,
                controlsContent,
                mainContent,
                detailsContent,
                stateContent
        );
    }
}
