package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.panes.DungeonSelectionEditorPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

final class DungeonSelectionEditorWorkflowController {

    private final DungeonEditorState state;
    private final DungeonSelectionEditorPane selectionEditorPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonEntityCrudController entityCrudController;
    private final DungeonConnectionEditingController connectionEditingController;
    private final DungeonMapLoadingWorkflowController loadingController;

    DungeonSelectionEditorWorkflowController(
            DungeonEditorState state,
            DungeonSelectionEditorPane selectionEditorPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonEntityCrudController entityCrudController,
            DungeonConnectionEditingController connectionEditingController,
            DungeonMapLoadingWorkflowController loadingController
    ) {
        this.state = state;
        this.selectionEditorPane = selectionEditorPane;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.entityCrudController = entityCrudController;
        this.connectionEditingController = connectionEditingController;
        this.loadingController = loadingController;
    }

    void bindToolSettings() {
        bindToolActionButtons();
        bindToolSelections();
        bindToolDerivedSelections();
    }

    private void bindToolActionButtons() {
        toolSettingsPane.newRoomButton().setOnAction(event -> entityCrudController.createRoom(toolSettingsPane.newRoomButton()));
        toolSettingsPane.deleteRoomButton().setOnAction(event -> entityCrudController.deleteActiveRoom(toolSettingsPane.deleteRoomButton()));
        toolSettingsPane.newAreaButton().setOnAction(event -> entityCrudController.createArea(toolSettingsPane.newAreaButton()));
        toolSettingsPane.deleteAreaButton().setOnAction(event -> entityCrudController.deleteActiveArea(toolSettingsPane.deleteAreaButton()));
        toolSettingsPane.newFeatureButton().setOnAction(event -> entityCrudController.createFeature(toolSettingsPane.newFeatureButton()));
        toolSettingsPane.deleteFeatureButton().setOnAction(event -> entityCrudController.deleteActiveFeature(toolSettingsPane.deleteFeatureButton()));
        toolSettingsPane.addTileToFeatureButton().setOnAction(event -> entityCrudController.addSelectedSquareToActiveFeature());
        toolSettingsPane.removeTileFromFeatureButton().setOnAction(event -> entityCrudController.removeSelectedSquareFromActiveFeature());
        toolSettingsPane.setOnCancelLink(selectionController::cancelPendingLink);
    }

    private void bindToolSelections() {
        toolSettingsPane.setOnRoomSelected(selectionController::selectRoom);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.setOnFeatureSelected(this::handleFeatureSelected);
        toolSettingsPane.setOnTileContextFeatureSelected(this::handleFeatureSelected);
    }

    private void bindToolDerivedSelections() {
        toolSettingsPane.encounterTableComboBox().valueProperty()
                .addListener((obs, oldValue, newValue) -> saveSelectedAreaEncounterTable(newValue));
        toolSettingsPane.encounterComboBox().valueProperty()
                .addListener((obs, oldValue, newValue) -> saveSelectedFeatureEncounter(newValue));
    }

    void bindSelectionEditorPane() {
        selectionEditorPane.setOnRoomSaved(form -> entityCrudController.saveRoom(toRoom(form)));
        selectionEditorPane.setOnRoomDeleted(request -> entityCrudController.deleteRoom(request.entityId(), request.anchor()));
        selectionEditorPane.setOnAreaSaved(form -> entityCrudController.saveArea(toArea(form)));
        selectionEditorPane.setOnAreaDeleted(request -> entityCrudController.deleteArea(request.entityId(), request.anchor()));
        selectionEditorPane.setOnFeatureSaved(form -> entityCrudController.saveFeature(toFeature(form)));
        selectionEditorPane.setOnFeatureDeleted(request -> entityCrudController.deleteFeature(request.entityId(), request.anchor()));
        selectionEditorPane.setOnEndpointSaved(form -> {
            DungeonEndpoint current = connectionEditingController.findEndpoint(form.endpointId());
            if (current != null) {
                connectionEditingController.saveEndpoint(toEndpoint(form, current));
            }
        });
        selectionEditorPane.setOnEndpointDeleted(request -> connectionEditingController.deleteEndpoint(request.entityId(), request.anchor()));
        selectionEditorPane.setOnLinkSaved(form -> connectionEditingController.updateLinkLabel(
                form.linkId(),
                form.label(),
                loadingController::reloadCurrentMap));
        selectionEditorPane.setOnLinkDeleted(request -> connectionEditingController.deleteLink(request.entityId()));
        selectionEditorPane.setOnPassageSaved(form -> {
            DungeonPassage current = findPassage(form.passageId());
            if (current != null) {
                connectionEditingController.savePassage(toPassage(form, current));
            }
        });
        selectionEditorPane.setOnPassageDeleted(request -> connectionEditingController.deletePassage(request.entityId(), request.anchor()));
    }

    void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
        syncEncounterTableSelection();
    }

    void handleFeatureSelected(DungeonFeature feature) {
        selectionController.selectFeature(feature);
        syncFeatureEncounterSelection();
    }

    void syncEncounterTableSelection() {
        DungeonArea selectedArea = toolSettingsPane.areaComboBox().getValue();
        state.runWhileSyncingAreaSelection(() ->
                toolSettingsPane.selectEncounterTable(selectedArea == null ? null : selectedArea.encounterTableId()));
    }

    void syncFeatureEncounterSelection() {
        DungeonFeature selectedFeature = toolSettingsPane.activeFeatureComboBox().getValue();
        state.runWhileSyncingFeatureSelection(() ->
                toolSettingsPane.selectEncounter(selectedFeature == null ? null : selectedFeature.encounterId()));
    }

    private void saveSelectedAreaEncounterTable(DungeonEncounterTableSummary selectedTable) {
        DungeonArea area = toolSettingsPane.areaComboBox().getValue();
        if (state.syncingAreaSelection() || area == null || state.currentState() == null) {
            return;
        }
        entityCrudController.saveArea(new DungeonArea(
                area.areaId(),
                area.mapId(),
                area.name(),
                area.description(),
                selectedTable == null ? null : selectedTable.tableId()));
    }

    private void saveSelectedFeatureEncounter(DungeonEncounterSummary selectedEncounter) {
        DungeonFeature feature = toolSettingsPane.activeFeatureComboBox().getValue();
        if (state.syncingFeatureSelection()
                || feature == null
                || state.currentState() == null
                || feature.category() != features.world.dungeonmap.model.DungeonFeatureCategory.ENCOUNTER) {
            return;
        }
        entityCrudController.saveFeature(new DungeonFeature(
                feature.featureId(),
                feature.mapId(),
                feature.category(),
                selectedEncounter == null ? null : selectedEncounter.encounterId(),
                feature.name(),
                feature.notes()));
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

    private DungeonRoom toRoom(DungeonSelectionEditorPane.RoomForm form) {
        return new DungeonRoom(
                form.roomId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.areaId());
    }

    private DungeonArea toArea(DungeonSelectionEditorPane.AreaForm form) {
        return new DungeonArea(
                form.areaId(),
                state.currentMapId(),
                form.name(),
                form.description(),
                form.encounterTableId());
    }

    private DungeonFeature toFeature(DungeonSelectionEditorPane.FeatureForm form) {
        return new DungeonFeature(
                form.featureId(),
                state.currentMapId(),
                form.category(),
                form.encounterId(),
                form.name(),
                form.notes());
    }

    private DungeonEndpoint toEndpoint(DungeonSelectionEditorPane.EndpointForm form, DungeonEndpoint current) {
        return new DungeonEndpoint(
                current.endpointId(),
                current.mapId(),
                current.squareId(),
                form.name(),
                form.notes(),
                form.role(),
                form.defaultEntry(),
                current.x(),
                current.y());
    }

    private DungeonPassage toPassage(DungeonSelectionEditorPane.PassageForm form, DungeonPassage current) {
        return new DungeonPassage(
                current.passageId(),
                current.mapId(),
                current.x(),
                current.y(),
                current.direction(),
                form.name(),
                form.notes(),
                form.endpointId());
    }
}
