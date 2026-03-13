package features.world.dungeonmap.ui.runtime;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.runtime.DungeonRuntimeCommandService;
import features.world.dungeonmap.service.runtime.DungeonRuntimeQueryService;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.runtime.chrome.controls.DungeonViewControls;
import features.world.dungeonmap.ui.runtime.chrome.inspector.DungeonRuntimeInspectorContentFactory;
import features.world.dungeonmap.ui.runtime.chrome.state.DungeonRuntimeStatePane;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

public class DungeonView implements AppView {

    private final DungeonViewControls controls = new DungeonViewControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonRuntimeStatePane runtimeStatePane = new DungeonRuntimeStatePane();
    private final DungeonRuntimeViewState state = new DungeonRuntimeViewState();
    private final DungeonRuntimeLoader loader;
    private final DungeonRuntimeMovementWorkflow movementWorkflow;

    public DungeonView(DetailsNavigator detailsNavigator, DungeonMapQueryService queries, EncounterRuntimePort encounterRuntimePort) {
        DungeonRuntimeQueryService runtimeQueries = new DungeonRuntimeQueryService();
        DungeonRuntimeCommandService runtimeCommands = new DungeonRuntimeCommandService();
        loader = new DungeonRuntimeLoader(state, controls, runtimeStatePane, canvas, queries, runtimeQueries);
        movementWorkflow = new DungeonRuntimeMovementWorkflow(
                state,
                runtimeStatePane,
                canvas,
                detailsNavigator,
                new DungeonRuntimeInspectorContentFactory(),
                runtimeCommands,
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
        loader.onShow(movementWorkflow::updateLocationLabels);
    }

    private void reloadRuntimeView() {
        loader.reloadCurrentMap(movementWorkflow::updateLocationLabels);
    }

    public void registerScenes(SceneRegistry sceneRegistry) {
        sceneRegistry.registerScene("\u25A3 Dungeon", runtimeStatePane);
    }
}
