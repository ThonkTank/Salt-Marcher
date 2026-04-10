package features.world.hexmap.editorsurface.input;

import ui.shell.DetailsNavigator;

import java.util.Objects;

@SuppressWarnings("unused")
public record ComposeInput(DetailsNavigator detailsNavigator) {

    public ComposeInput {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
    }
}
