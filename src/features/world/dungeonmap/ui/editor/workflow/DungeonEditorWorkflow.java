package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonConnectionEditingController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonEntityCrudController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonMapEditingController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonSquareEditWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.loading.DungeonCatalogLoadingController;
import features.world.dungeonmap.ui.editor.workflow.loading.DungeonMapLoadingController;
import features.world.dungeonmap.ui.editor.workflow.loading.DungeonSelectionRestoreController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonLinkWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionEditorWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionWorkflowController;

public final class DungeonEditorWorkflow {

    private final DungeonCatalogLoadingController catalogLoadingController;
    private final DungeonSelectionRestoreController selectionRestoreController;
    private final DungeonMapLoadingController mapLoadingController;

    public DungeonEditorWorkflow(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonLinkWorkflowController linkWorkflowController,
            DungeonSquareEditWorkflowController squareEditWorkflowController,
            DungeonMapEditingController mapEditingController,
            DungeonEntityCrudController entityCrudController,
            DungeonConnectionEditingController connectionEditingController,
            DungeonSelectionEditorWorkflowController selectionEditorWorkflowController
    ) {
        catalogLoadingController = new DungeonCatalogLoadingController(state, toolSettingsPane);
        selectionRestoreController = new DungeonSelectionRestoreController(
                state,
                toolSettingsPane,
                selectionController,
                interactionState::activeTool);
        mapLoadingController = new DungeonMapLoadingController(
                state,
                controls,
                canvas,
                toolSettingsPane,
                selectionController,
                linkWorkflowController,
                selectionRestoreController);
        wireControllers(
                selectionController,
                squareEditWorkflowController,
                mapEditingController,
                entityCrudController,
                connectionEditingController,
                selectionEditorWorkflowController);
    }

    public void onShow() {
        catalogLoadingController.loadCatalogs();
        mapLoadingController.onShow();
    }

    public void loadMapAsync(Long mapId) {
        mapLoadingController.loadMapAsync(mapId);
    }

    public void reloadCurrentMap() {
        mapLoadingController.reloadCurrentMap();
    }

    public void reloadCurrentMap(DungeonSelectionRestoreRequest request) {
        mapLoadingController.reloadCurrentMap(request);
    }

    public void autoShowForTool(DungeonEditorTool tool) {
        selectionRestoreController.autoShowForTool(tool);
    }

    private void wireControllers(
            DungeonSelectionWorkflowController selectionController,
            DungeonSquareEditWorkflowController squareEditWorkflowController,
            DungeonMapEditingController mapEditingController,
            DungeonEntityCrudController entityCrudController,
            DungeonConnectionEditingController connectionEditingController,
            DungeonSelectionEditorWorkflowController selectionEditorWorkflowController
    ) {
        squareEditWorkflowController.setReloadCurrentMap(this::reloadCurrentMap);
        mapLoadingController.setOnMapLoaded(squareEditWorkflowController::handleMapLoaded);
        mapEditingController.setReloadMapList(this::onShow);
        entityCrudController.setReloadCurrentMap(this::reloadCurrentMap);
        connectionEditingController.setReloadCurrentMap(this::reloadCurrentMap);
        catalogLoadingController.setOnEncounterTablesChanged(selectionController::refreshInspectorForCurrentSelection);
        catalogLoadingController.setOnStoredEncountersChanged(() -> {
            selectionEditorWorkflowController.syncFeatureEncounterSelection();
            selectionController.refreshInspectorForCurrentSelection();
        });
    }
}
