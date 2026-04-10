package features.world.dungeonclean.input;

import features.world.api.input.TravelSurfaceInput;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

@SuppressWarnings("unused")
public record ViewsInput(
        DetailsNavigator detailsNavigator,
        SceneRegistry sceneRegistry,
        TravelSurfaceInput travelSurface
) {
    public record LoadedViewsInput(
            AppView dungeonView,
            AppView dungeonEditorView
    ) {
    }
}
