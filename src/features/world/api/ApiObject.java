package features.world.api;

import features.world.api.input.WorldTravelSurface;
import features.world.api.input.WorldViews;
import features.world.dungeon.bootstrap.BootstrapObject;
import features.world.hexmap.api.HexMapModule;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

/**
 * Public world-owned boundary that composes the overworld and dungeon surfaces.
 */
public final class ApiObject {

    private final HexMapModule hexMapModule;
    private final BootstrapObject dungeonBootstrap;
    private final WorldTravelSurface travelSurface = HexMapModule.createTravelSurface();
    private final features.world.dungeon.bootstrap.input.BootstrapViews dungeonViews;

    public ApiObject(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexMapModule = new HexMapModule(detailsNavigator, travelSurface);
        this.dungeonBootstrap = new BootstrapObject(detailsNavigator, travelSurface);
        this.dungeonViews = dungeonBootstrap.views();
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        sceneRegistry.registerScene("Reise", travelSurface.sceneContent());
    }

    public WorldViews views() {
        return new WorldViews(
                hexMapModule.overworldView(),
                hexMapModule.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
