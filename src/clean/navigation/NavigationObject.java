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
        ComposeNavigationInput.SurfaceInput startSurface = resolvedInput.startSurface();
        Label titleLabel = new Label(startSurface.title());
        HBox toolbarContent = new HBox(titleLabel);
        VBox navigationContent = new VBox();
        StackPane controlsContent = new StackPane();
        StackPane mainContent = new StackPane();
        StackPane detailsContent = new StackPane();
        StackPane stateContent = new StackPane();
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
