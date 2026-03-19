package features.world.dungeonmap.bootstrap;

import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.editor.DungeonEditorView;
import features.world.dungeonmap.shell.runtime.DungeonRuntimeView;
import features.world.dungeonmap.state.DungeonMapState;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonMapState state = new DungeonMapState();
        DungeonMapLoadingService loadingService = new DungeonMapLoadingService(
                new DungeonMapLoader(),
                state);
        this.dungeonView = new DungeonRuntimeView("Dungeon", false, loadingService, state);
        this.dungeonEditorView = new DungeonEditorView(loadingService, state);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
