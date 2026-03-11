package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

final class DungeonDetailsWorkflowController {

    private final DungeonEditorState state;
    private final DungeonDetailsPane detailsPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonEditingWorkflowController editingWorkflowController;
    private final DungeonMapLoadingWorkflowController loadingController;

    DungeonDetailsWorkflowController(
            DungeonEditorState state,
            DungeonDetailsPane detailsPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonEditingWorkflowController editingWorkflowController,
            DungeonMapLoadingWorkflowController loadingController
    ) {
        this.state = state;
        this.detailsPane = detailsPane;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.editingWorkflowController = editingWorkflowController;
        this.loadingController = loadingController;
    }

    void bindToolSettings() {
        toolSettingsPane.newRoomButton().setOnAction(event -> editingWorkflowController.createRoom(toolSettingsPane.newRoomButton()));
        toolSettingsPane.deleteRoomButton().setOnAction(event -> editingWorkflowController.deleteActiveRoom(toolSettingsPane.deleteRoomButton()));
        toolSettingsPane.newAreaButton().setOnAction(event -> editingWorkflowController.createArea(toolSettingsPane.newAreaButton()));
        toolSettingsPane.deleteAreaButton().setOnAction(event -> editingWorkflowController.deleteActiveArea(toolSettingsPane.deleteAreaButton()));
        toolSettingsPane.setOnRoomSelected(selectionController::selectRoom);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.encounterTableComboBox().valueProperty()
                .addListener((obs, oldValue, newValue) -> saveSelectedAreaEncounterTable(newValue));
        toolSettingsPane.setOnCancelLink(selectionController::cancelPendingLink);
    }

    void bindDetailsPane() {
        detailsPane.setOnRoomSaved(form -> editingWorkflowController.saveRoom(new DungeonRoom(
                form.roomId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.areaId())));
        detailsPane.setOnRoomDeleted(request -> editingWorkflowController.deleteRoom(request.entityId(), request.anchor()));
        detailsPane.setOnAreaSaved(form -> editingWorkflowController.saveArea(new DungeonArea(
                form.areaId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.encounterTableId(),
                editingWorkflowController.selectedEncounterTableName(form.encounterTableId()))));
        detailsPane.setOnAreaDeleted(request -> editingWorkflowController.deleteArea(request.entityId(), request.anchor()));
        detailsPane.setOnEndpointSaved(form -> {
            DungeonEndpoint current = editingWorkflowController.findEndpoint(form.endpointId());
            if (current != null) {
                editingWorkflowController.saveEndpoint(new DungeonEndpoint(
                        current.endpointId(),
                        current.mapId(),
                        current.squareId(),
                        form.name(),
                        form.notes(),
                        form.role(),
                        form.defaultEntry(),
                        current.x(),
                        current.y()));
            }
        });
        detailsPane.setOnEndpointDeleted(request -> editingWorkflowController.deleteEndpoint(request.entityId(), request.anchor()));
        detailsPane.setOnLinkSaved(form -> editingWorkflowController.updateLinkLabel(
                form.linkId(),
                form.label(),
                () -> loadingController.loadMapAsync(state.currentMapId())));
        detailsPane.setOnLinkDeleted(request -> editingWorkflowController.deleteLink(request.entityId()));
    }

    void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
        syncEncounterTableSelection();
    }

    void syncEncounterTableSelection() {
        DungeonArea selectedArea = toolSettingsPane.areaComboBox().getValue();
        state.setSyncingAreaSelection(true);
        toolSettingsPane.selectEncounterTable(selectedArea == null ? null : selectedArea.encounterTableId());
        state.setSyncingAreaSelection(false);
    }

    private void saveSelectedAreaEncounterTable(DungeonEncounterTableSummary selectedTable) {
        DungeonArea area = toolSettingsPane.areaComboBox().getValue();
        if (state.syncingAreaSelection() || area == null || state.currentState() == null) {
            return;
        }
        editingWorkflowController.saveArea(new DungeonArea(
                area.areaId(),
                area.mapId(),
                area.name(),
                area.description(),
                selectedTable == null ? null : selectedTable.tableId(),
                selectedTable == null ? null : selectedTable.name()));
    }
}
