package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

final class DungeonSelectionEditorWorkflowController {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonEntityCrudController entityCrudController;

    DungeonSelectionEditorWorkflowController(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonEntityCrudController entityCrudController
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.entityCrudController = entityCrudController;
    }

    void bindToolSettings() {
        bindToolActionButtons();
        bindToolSelections();
        bindToolDerivedSelections();
    }

    private void bindToolActionButtons() {
        toolSettingsPane.newAreaButton().setOnAction(event -> entityCrudController.createArea(toolSettingsPane.newAreaButton()));
        toolSettingsPane.deleteAreaButton().setOnAction(event -> entityCrudController.deleteActiveArea(toolSettingsPane.deleteAreaButton()));
        toolSettingsPane.newFeatureButton().setOnAction(event -> entityCrudController.createFeature(toolSettingsPane.newFeatureButton()));
        toolSettingsPane.deleteFeatureButton().setOnAction(event -> entityCrudController.deleteActiveFeature(toolSettingsPane.deleteFeatureButton()));
        toolSettingsPane.addTileToFeatureButton().setOnAction(event -> entityCrudController.addSelectedSquareToActiveFeature());
        toolSettingsPane.removeTileFromFeatureButton().setOnAction(event -> entityCrudController.removeSelectedSquareFromActiveFeature());
        toolSettingsPane.setOnCancelLink(selectionController::cancelPendingLink);
    }

    private void bindToolSelections() {
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
}
