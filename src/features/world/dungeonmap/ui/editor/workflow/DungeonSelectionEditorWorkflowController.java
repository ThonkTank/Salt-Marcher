package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.ui.editor.DungeonEntityCrudController;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;

public final class DungeonSelectionEditorWorkflowController {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonEntityCrudController entityCrudController;

    public DungeonSelectionEditorWorkflowController(
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

    public void bindToolSettings() {
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
        toolSettingsPane.setOnAreaProfileSaveRequested(this::saveAreaProfile);
        toolSettingsPane.setOnFeatureSelected(this::handleFeatureSelected);
        toolSettingsPane.setOnTileContextFeatureSelected(this::handleFeatureSelected);
    }

    private void bindToolDerivedSelections() {
        toolSettingsPane.encounterComboBox().valueProperty()
                .addListener((obs, oldValue, newValue) -> saveSelectedFeatureEncounter(newValue));
    }

    public void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
    }

    public void handleFeatureSelected(DungeonFeature feature) {
        selectionController.selectFeature(feature);
        syncFeatureEncounterSelection();
    }

    public void syncFeatureEncounterSelection() {
        DungeonFeature selectedFeature = toolSettingsPane.activeFeatureComboBox().getValue();
        state.runWhileSyncingFeatureSelection(() ->
                toolSettingsPane.selectEncounter(selectedFeature == null ? null : selectedFeature.encounterId()));
    }

    private void saveAreaProfile(DungeonArea area) {
        if (state.syncingAreaSelection() || area == null || state.currentState() == null) {
            return;
        }
        entityCrudController.saveArea(area);
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
