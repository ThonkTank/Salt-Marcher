package features.world.api;

import features.world.WorldObject;
import features.world.api.input.RegisterScenesInput;
import features.world.api.input.TravelSurfaceInput;
import features.world.api.input.ViewsInput;
import features.world.api.state.ApiState;

import java.util.Objects;

/**
 * Public world-owned boundary that composes the overworld and dungeon surfaces.
 */
@SuppressWarnings("unused")
public final class ApiObject {

    private final ApiState state;
    private final WorldObject worldObject;

    public ApiObject(ApiState state) {
        this.state = Objects.requireNonNull(state, "state");
        this.worldObject = new WorldObject(this.state);
    }

    public void registerScenes(RegisterScenesInput input) {
        worldObject.registerScenes(new features.world.input.RegisterScenesInput(input.sceneRegistry()));
    }

    public TravelSurfaceInput travelSurface(TravelSurfaceInput input) {
        return state.travelSurface();
    }

    public ViewsInput views(ViewsInput input) {
        features.world.input.ViewsInput worldViews = worldObject.views(
                new features.world.input.ViewsInput(
                        input == null ? null : input.overworldView(),
                        input == null ? null : input.mapEditorView(),
                        input == null ? null : input.dungeonView(),
                        input == null ? null : input.dungeonEditorView()));
        return new ViewsInput(
                worldViews.overworldView(),
                worldViews.mapEditorView(),
                worldViews.dungeonView(),
                worldViews.dungeonEditorView());
    }
}
