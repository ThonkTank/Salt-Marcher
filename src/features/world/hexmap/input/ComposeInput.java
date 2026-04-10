package features.world.hexmap.input;

import features.world.api.input.TravelSurfaceInput;

import java.util.Objects;

@SuppressWarnings("unused")
public record ComposeInput(ui.shell.DetailsNavigator detailsNavigator) {

    public ComposeInput {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
    }

    public record ComposedHexmapInput(
            TravelSurfaceInput travelSurface,
            ui.shell.AppView overworldView,
            ui.shell.AppView mapEditorView
    ) {
    }
}
