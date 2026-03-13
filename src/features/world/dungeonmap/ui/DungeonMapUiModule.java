package features.world.dungeonmap.ui;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
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

    public DungeonMapUiModule(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        DungeonMapQueryService queries = new DungeonMapQueryService();
        DungeonMapCommandService commands = new DungeonMapCommandService();
        this.dungeonView = new DungeonView(queries, encounterRuntimePort);
        this.dungeonEditorView = new DungeonEditorView(detailsNavigator, queries, commands);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
