package features.world.dungeonmap.bootstrap;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.editor.screen.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.screen.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapUiBootstrap {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapUiBootstrap(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        DungeonMapQueryService queries = new DungeonMapQueryService();
        DungeonMapCommandService commands = new DungeonMapCommandService();
        this.dungeonView = new DungeonView(detailsNavigator, queries, encounterRuntimePort);
        this.dungeonEditorView = new DungeonEditorView(detailsNavigator, queries, commands);
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }
}
