package features.world.api;

import features.world.dungeonmap.api.DungeonMapModule;
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

    public WorldModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexMapModule = new HexMapModule(detailsNavigator);
        this.dungeonMapModule = new DungeonMapModule(detailsNavigator);
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        hexMapModule.registerScenes(sceneRegistry);
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
