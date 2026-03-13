package features.world.dungeonmap.ui;

import features.world.dungeonmap.service.DungeonMapServices;
import features.world.dungeonmap.ui.editor.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Internal composition root for dungeon map views. Shell integration should stay on
 * {@link DetailsNavigator}; rich dungeon inspector cards remain feature-local and are hosted there.
 */
public final class DungeonMapUiModule {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapUiModule(DetailsNavigator detailsNavigator) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        DungeonMapServices services = new DungeonMapServices();
        this.dungeonView = new DungeonView(services.queries());
        this.dungeonEditorView = new DungeonEditorView(detailsNavigator, services.queries(), services.commands());
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
