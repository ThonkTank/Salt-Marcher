package features.world.api;

import features.world.api.input.RegisterScenesInput;
import features.world.api.input.TravelSurfaceInput;
import features.world.api.input.ViewsInput;
import features.world.dungeon.bootstrap.BootstrapObject;
import features.world.hexmap.HexmapObject;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Public world-owned boundary that composes the overworld and dungeon surfaces.
 */
public final class ApiObject {

    private final HexmapObject hexMapModule;
    private final BootstrapObject dungeonBootstrap;
    private final TravelSurfaceInput travelSurface = HexmapObject.createTravelSurface();
    private final features.world.dungeon.bootstrap.input.BootstrapViews dungeonViews;

    public ApiObject(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexMapModule = new HexmapObject(detailsNavigator, travelSurface);
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
        var hexMapViews = hexMapModule.views();
        return new ViewsInput(
                hexMapViews.overworldView(),
                hexMapViews.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
