package features.world.dungeonmap.bootstrap;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonConceptCommandService;
import features.world.dungeonmap.service.DungeonConceptQueryService;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.editor.screen.DungeonEditorWorkspaceView;
import features.world.dungeonmap.ui.editor.screen.DungeonEditorView;
import features.world.dungeonmap.ui.concept.screen.DungeonConceptPlannerView;
import features.world.dungeonmap.ui.runtime.DungeonView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

public final class DungeonMapUiBootstrap {

    private final DungeonView dungeonView;
    private final AppView dungeonEditorView;

    public DungeonMapUiBootstrap(DetailsNavigator detailsNavigator, EncounterRuntimePort encounterRuntimePort) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(encounterRuntimePort, "encounterRuntimePort");
        DungeonMapQueryService queries = new DungeonMapQueryService();
        DungeonMapCommandService commands = new DungeonMapCommandService();
        DungeonConceptQueryService conceptQueries = new DungeonConceptQueryService();
        DungeonConceptCommandService conceptCommands = new DungeonConceptCommandService();
        DungeonEditorView rasterEditorView = new DungeonEditorView(detailsNavigator, queries, commands);
        DungeonConceptPlannerView conceptPlannerView = new DungeonConceptPlannerView(
                detailsNavigator,
                queries,
                commands,
                conceptQueries,
                conceptCommands);
        this.dungeonView = new DungeonView(detailsNavigator, queries, encounterRuntimePort);
        this.dungeonEditorView = new DungeonEditorWorkspaceView(
                new DungeonEditorWorkspaceView.ModeBinding(rasterEditorView, rasterEditorView::currentMapId, rasterEditorView::setPreferredMapId),
                new DungeonEditorWorkspaceView.ModeBinding(conceptPlannerView, conceptPlannerView::currentMapId, conceptPlannerView::setPreferredMapId));
    }

    public AppView dungeonView() {
        return dungeonView;
    }

    public AppView dungeonEditorView() {
        return dungeonEditorView;
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        dungeonView.registerScenes(sceneRegistry);
    }
}
