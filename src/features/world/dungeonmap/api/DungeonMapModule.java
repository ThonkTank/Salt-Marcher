package features.world.dungeonmap.api;

import features.encounter.api.EncounterRuntimePort;
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

    public DungeonMapModule(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        this.uiModule = new DungeonMapUiModule(detailsNavigator, encounterRuntimePort);
    }

    public AppView dungeonView() {
        return uiModule.dungeonView();
    }

    public AppView dungeonEditorView() {
        return uiModule.dungeonEditorView();
    }
}
