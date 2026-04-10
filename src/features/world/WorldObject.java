package features.world;

import features.world.api.state.ApiState;
import features.world.input.RegisterScenesInput;
import features.world.input.ViewsInput;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

/**
 * Canonical world-owned boundary that composes the overworld, dungeon, and
 * shared travel scene for shell-facing consumers.
 */
@SuppressWarnings("unused")
public final class WorldObject {

    private final ApiState state;

    public WorldObject(DetailsNavigator detailsNavigator, SceneRegistry sceneRegistry) {
        this(new ApiState(detailsNavigator, sceneRegistry));
    }

    public WorldObject(ApiState state) {
        this.state = Objects.requireNonNull(state, "state");
    }

    public void registerScenes(RegisterScenesInput input) {
        input.sceneRegistry().registerScene("Reise", state.travelSurface().sceneContent());
    }

    public ViewsInput views(ViewsInput input) {
        var worldViews = state.worldViews();
        return new ViewsInput(
                worldViews.overworldView(),
                worldViews.mapEditorView(),
                worldViews.dungeonView(),
                worldViews.dungeonEditorView());
    }
}
