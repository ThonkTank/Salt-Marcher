package features.world.dungeonmap.api;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.composition.DungeonMapComposition;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

/**
 * Stable world-facing facade for dungeon map views. External consumers depend on this boundary
 * instead of reaching into the feature's internal UI package directly.
 */
public final class DungeonMapModule {

    private final DungeonMapComposition composition;

    public DungeonMapModule(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        this.composition = new DungeonMapComposition(detailsNavigator, encounterRuntimePort);
    }

    public AppView dungeonView() {
        return composition.dungeonView();
    }

    public AppView dungeonEditorView() {
        return composition.dungeonEditorView();
    }
}
