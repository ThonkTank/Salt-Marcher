package features.world.dungeonmap.ui.runtime;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.runtime.controls.DungeonViewControls;
import features.world.dungeonmap.ui.runtime.state.DungeonRuntimeViewState;
import features.world.dungeonmap.ui.runtime.workflow.DungeonRuntimeLoader;
import features.world.dungeonmap.ui.runtime.workflow.DungeonRuntimeMovementWorkflow;
import javafx.scene.Node;
import ui.shell.AppView;

public class DungeonView implements AppView {

    private final DungeonViewControls controls = new DungeonViewControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonRuntimeViewState state = new DungeonRuntimeViewState();
    private final DungeonRuntimeLoader loader;
    private final DungeonRuntimeMovementWorkflow movementWorkflow;

    public DungeonView(DungeonMapQueryService queries, EncounterRuntimePort encounterRuntimePort) {
        loader = new DungeonRuntimeLoader(state, controls, canvas, queries);
        movementWorkflow = new DungeonRuntimeMovementWorkflow(
                state,
                controls,
                canvas,
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
}
