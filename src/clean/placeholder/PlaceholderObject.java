package clean.placeholder;

import clean.navigation.input.ComposeNavigationInput;
import clean.placeholder.input.ComposePlaceholderInput;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Placeholder surface owner for phase-1 clean capability targets.
 */
@SuppressWarnings("unused")
public final class PlaceholderObject {

    public ComposeNavigationInput.SurfaceInput composePlaceholder(ComposePlaceholderInput input) {
        ComposePlaceholderInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        Label toolbarContent = new Label(resolvedInput.title());
        VBox controlsContent = new VBox(new Label(resolvedInput.controlsLineOne()));
        VBox mainContent = new VBox(new Label(resolvedInput.summary()));
        VBox detailsContent = new VBox(new Label(resolvedInput.detailsLineOne()));
        VBox stateContent = new VBox(new Label(resolvedInput.stateLineOne()));
        return new ComposeNavigationInput.SurfaceInput(
                resolvedInput.surfaceId(),
                resolvedInput.title(),
                resolvedInput.navigationLabel(),
                toolbarContent,
                controlsContent,
                mainContent,
                detailsContent,
                stateContent
        );
    }
}
