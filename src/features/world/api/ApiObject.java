package features.world.api;

import features.world.api.input.RegisterScenesInput;
import features.world.api.input.TravelSurfaceInput;
import features.world.api.input.ViewsInput;
import features.world.dungeon.bootstrap.BootstrapObject;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Public world-owned boundary that composes the overworld and dungeon surfaces.
 */
public final class ApiObject {

    private final features.world.hexmap.api.ApiObject hexMapModule;
    private final BootstrapObject dungeonBootstrap;
    private final TravelSurfaceInput travelSurface = features.world.hexmap.api.ApiObject.createTravelSurface();
    private final features.world.dungeon.bootstrap.input.BootstrapViews dungeonViews;

    public ApiObject(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexMapModule = new features.world.hexmap.api.ApiObject(detailsNavigator, travelSurface);
        this.dungeonBootstrap = new BootstrapObject(detailsNavigator, travelSurface);
        this.dungeonViews = dungeonBootstrap.views();
    }

    public void registerScenes(RegisterScenesInput input) {
        input.sceneRegistry().registerScene("Reise", travelSurface.sceneContent());
    }

    public TravelSurfaceInput travelSurface() {
        return travelSurface;
    }

    public ViewsInput views() {
        return new ViewsInput(
                hexMapModule.overworldView(),
                hexMapModule.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
