package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

final class DungeonDetailsWorkflowController {

    private final DungeonEditorState state;
    private final DungeonDetailsPane detailsPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonEntityEditingWorkflowController entityEditingWorkflowController;
    private final DungeonMapLoadingWorkflowController loadingController;

    DungeonDetailsWorkflowController(
            DungeonEditorState state,
            DungeonDetailsPane detailsPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonEntityEditingWorkflowController entityEditingWorkflowController,
            DungeonMapLoadingWorkflowController loadingController
    ) {
        this.state = state;
        this.detailsPane = detailsPane;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.entityEditingWorkflowController = entityEditingWorkflowController;
        this.loadingController = loadingController;
    }

    void bindToolSettings() {
        toolSettingsPane.newRoomButton().setOnAction(event -> entityEditingWorkflowController.createRoom(toolSettingsPane.newRoomButton()));
        toolSettingsPane.deleteRoomButton().setOnAction(event -> entityEditingWorkflowController.deleteActiveRoom(toolSettingsPane.deleteRoomButton()));
        toolSettingsPane.newAreaButton().setOnAction(event -> entityEditingWorkflowController.createArea(toolSettingsPane.newAreaButton()));
        toolSettingsPane.deleteAreaButton().setOnAction(event -> entityEditingWorkflowController.deleteActiveArea(toolSettingsPane.deleteAreaButton()));
        toolSettingsPane.setOnRoomSelected(selectionController::selectRoom);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.encounterTableComboBox().valueProperty()
                .addListener((obs, oldValue, newValue) -> saveSelectedAreaEncounterTable(newValue));
        toolSettingsPane.setOnCancelLink(selectionController::cancelPendingLink);
    }

    void bindDetailsPane() {
        detailsPane.setOnRoomSaved(form -> entityEditingWorkflowController.saveRoom(new DungeonRoom(
                form.roomId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.areaId())));
        detailsPane.setOnRoomDeleted(request -> entityEditingWorkflowController.deleteRoom(request.entityId(), request.anchor()));
        detailsPane.setOnAreaSaved(form -> entityEditingWorkflowController.saveArea(new DungeonArea(
                form.areaId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.encounterTableId(),
                entityEditingWorkflowController.selectedEncounterTableName(form.encounterTableId()))));
        detailsPane.setOnAreaDeleted(request -> entityEditingWorkflowController.deleteArea(request.entityId(), request.anchor()));
        detailsPane.setOnEndpointSaved(form -> {
            DungeonEndpoint current = entityEditingWorkflowController.findEndpoint(form.endpointId());
            if (current != null) {
                entityEditingWorkflowController.saveEndpoint(new DungeonEndpoint(
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
        detailsPane.setOnEndpointDeleted(request -> entityEditingWorkflowController.deleteEndpoint(request.entityId(), request.anchor()));
        detailsPane.setOnLinkSaved(form -> entityEditingWorkflowController.updateLinkLabel(
                form.linkId(),
                form.label(),
                () -> loadingController.loadMapAsync(state.currentMapId())));
        detailsPane.setOnLinkDeleted(request -> entityEditingWorkflowController.deleteLink(request.entityId()));
        detailsPane.setOnPassageSaved(form -> {
            DungeonPassage current = findPassage(form.passageId());
            if (current != null) {
                entityEditingWorkflowController.savePassage(new DungeonPassage(
                        current.passageId(),
                        current.mapId(),
                        current.x(),
                        current.y(),
                        current.direction(),
                        form.type(),
                        form.name(),
                        form.notes(),
                        form.endpointId()));
            }
        });
        detailsPane.setOnPassageDeleted(request -> entityEditingWorkflowController.deletePassage(request.entityId(), request.anchor()));
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
        entityEditingWorkflowController.saveArea(new DungeonArea(
                area.areaId(),
                area.mapId(),
                area.name(),
                area.description(),
                selectedTable == null ? null : selectedTable.tableId(),
                selectedTable == null ? null : selectedTable.name()));
    }

    private DungeonPassage findPassage(Long passageId) {
        if (state.currentState() == null || passageId == null) {
            return null;
        }
        for (DungeonPassage passage : state.currentState().passages()) {
            if (passageId.equals(passage.passageId())) {
                return passage;
            }
        }
        return null;
    }
}
