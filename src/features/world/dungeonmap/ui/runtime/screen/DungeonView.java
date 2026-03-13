package features.world.dungeonmap.ui.runtime.screen;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.mapcanvas.DungeonMapPane;
import features.world.dungeonmap.ui.runtime.chrome.controls.DungeonViewControls;
import features.world.dungeonmap.ui.runtime.chrome.inspector.DungeonRuntimeInspectorContentFactory;
import features.world.dungeonmap.ui.runtime.chrome.state.DungeonRuntimeStatePane;
import features.world.dungeonmap.ui.runtime.state.DungeonRuntimeViewState;
import features.world.dungeonmap.ui.runtime.workflow.DungeonRuntimeLoader;
import features.world.dungeonmap.ui.runtime.workflow.DungeonRuntimeMovementWorkflow;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneHandle;
import ui.shell.SceneRegistry;

public class DungeonView implements AppView {

    private final DungeonViewControls controls = new DungeonViewControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonRuntimeStatePane runtimeStatePane = new DungeonRuntimeStatePane();
    private final DungeonRuntimeViewState state = new DungeonRuntimeViewState();
    private final DungeonRuntimeLoader loader;
    private final DungeonRuntimeMovementWorkflow movementWorkflow;
    private SceneHandle runtimeScene;

    public DungeonView(DetailsNavigator detailsNavigator, DungeonMapQueryService queries, EncounterRuntimePort encounterRuntimePort) {
        loader = new DungeonRuntimeLoader(state, controls, runtimeStatePane, canvas, queries);
        movementWorkflow = new DungeonRuntimeMovementWorkflow(
                state,
                runtimeStatePane,
                canvas,
                detailsNavigator,
                new DungeonRuntimeInspectorContentFactory(),
                encounterRuntimePort,
                this::reloadRuntimeView);
        controls.setOnMapSelected(mapId -> loader.handleMapSelected(mapId, movementWorkflow::updateLocationLabels));
        canvas.setOnCellClicked(interaction -> movementWorkflow.handleSquareClicked(interaction.square()));
        canvas.setOnEndpointClicked(endpoint -> {
            if (endpoint != null && endpoint.squareId() != null) {
                movementWorkflow.handleSquareClicked(state.squareById(endpoint.squareId()));
            }
        });
        canvas.setShowEndpoints(true);
        canvas.setShowLinks(true);
    }

    @Override
    public Node getMainContent() {
        return canvas;
    }

    @Override
    public String getTitle() {
        return "Dungeon";
    }

    @Override
    public String getIconText() {
        return "\u25a3";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public void onShow() {
        if (runtimeScene != null) {
            runtimeScene.activate();
        }
        loader.onShow(movementWorkflow::updateLocationLabels);
    }

    private void reloadRuntimeView() {
        loader.reloadCurrentMap(movementWorkflow::updateLocationLabels);
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        if (runtimeScene != null) {
            return;
        }
        runtimeScene = sceneRegistry.registerScene("\u25A3 Dungeon", runtimeStatePane);
    }
}
