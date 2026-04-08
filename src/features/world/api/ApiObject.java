package features.world.api;

import features.world.api.input.RegisterScenesInput;
import features.world.api.input.TravelSurfaceInput;
import features.world.api.input.ViewsInput;
import features.world.api.state.ApiState;

import java.util.Objects;

/**
 * Public world-owned boundary that composes the overworld and dungeon surfaces.
 */
public final class ApiObject {

    private final ApiState state;

    public ApiObject(ApiState state) {
        this.state = Objects.requireNonNull(state, "state");
    }

    public void registerScenes(RegisterScenesInput input) {
        input.sceneRegistry().registerScene("Reise", state.travelSurface().sceneContent());
    }

    public TravelSurfaceInput travelSurface(TravelSurfaceInput input) {
        return state.travelSurface();
    }

    public ViewsInput views(ViewsInput input) {
        return state.worldViews();
    }
}
