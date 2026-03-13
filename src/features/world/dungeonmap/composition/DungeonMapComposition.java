package features.world.dungeonmap.composition;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.editor.DungeonEditorView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonMapComposition {

    private final AppView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapComposition(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
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
