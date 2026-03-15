package features.world.dungeonmap.api;

import features.world.dungeonmap.ui.editor.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

public final class DungeonMapModule {

    private final DungeonView dungeonView;
    private final DungeonEditorView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.dungeonView = new DungeonView(detailsNavigator);
        this.dungeonEditorView = new DungeonEditorView(detailsNavigator);
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
