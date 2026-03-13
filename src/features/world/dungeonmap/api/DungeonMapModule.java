package features.world.dungeonmap.api;

import features.world.dungeonmap.ui.DungeonMapUiModule;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Stable world-facing facade for dungeon map views. External consumers depend on this boundary
 * instead of reaching into the feature's internal UI package directly.
 */
public final class DungeonMapModule {

    private final DungeonMapUiModule uiModule;

    public DungeonMapModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.uiModule = new DungeonMapUiModule(detailsNavigator);
    }

    public AppView dungeonView() {
        return uiModule.dungeonView();
    }

    public AppView dungeonEditorView() {
        return uiModule.dungeonEditorView();
    }
}
