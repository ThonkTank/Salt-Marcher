package features.world.dungeonmap.api;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.bootstrap.DungeonMapUiBootstrap;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Stable world-facing facade for dungeon map views. External consumers depend on this boundary
 * instead of reaching into the feature's internal UI package directly.
 */
public final class DungeonMapModule {

    private final DungeonMapUiBootstrap uiBootstrap;

    public DungeonMapModule(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        this.uiBootstrap = new DungeonMapUiBootstrap(detailsNavigator, encounterRuntimePort);
    }

    public AppView dungeonView() {
        return uiBootstrap.dungeonView();
    }

    public AppView dungeonEditorView() {
        return uiBootstrap.dungeonEditorView();
    }
}
