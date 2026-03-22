package features.world.api;

import features.world.dungeonmap.bootstrap.DungeonMapModule;
import features.world.hexmap.api.HexMapTravelSurface;
import features.world.hexmap.api.HexMapModule;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

/**
 * Aggregates world-facing subfeatures so bootstrap code depends on one world boundary.
 */
public final class WorldModule {

    private final HexMapModule hexMapModule;
    private final DungeonMapModule dungeonMapModule;
    private final HexMapTravelSurface travelSurface = new HexMapTravelSurface();

    public WorldModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexMapModule = new HexMapModule(detailsNavigator, travelSurface);
        this.dungeonMapModule = new DungeonMapModule(detailsNavigator, travelSurface);
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        sceneRegistry.registerScene("Reise", travelSurface.sceneContent());
    }

    public AppView overworldView() {
        return hexMapModule.overworldView();
    }

    public AppView mapEditorView() {
        return hexMapModule.mapEditorView();
    }

    public AppView dungeonView() {
        return dungeonMapModule.dungeonView();
    }

    public AppView dungeonEditorView() {
        return dungeonMapModule.dungeonEditorView();
    }
}
