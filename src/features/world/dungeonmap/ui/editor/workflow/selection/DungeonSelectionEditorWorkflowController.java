package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonEntityCrudController;

public final class DungeonSelectionEditorWorkflowController {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonLinkWorkflowController linkWorkflowController;
    private final DungeonEntityCrudController entityCrudController;

    public DungeonSelectionEditorWorkflowController(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonLinkWorkflowController linkWorkflowController,
            DungeonEntityCrudController entityCrudController
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.linkWorkflowController = linkWorkflowController;
        this.entityCrudController = entityCrudController;
    }

    public void bindToolSettings() {
        bindToolActionButtons();
        bindToolSelections();
        bindToolDerivedSelections();
    }

    private void bindToolActionButtons() {
        toolSettingsPane.setOnNewAreaRequested(entityCrudController::createArea);
        toolSettingsPane.setOnDeleteAreaRequested(entityCrudController::deleteActiveArea);
        toolSettingsPane.setOnNewFeatureRequested(entityCrudController::createFeature);
        toolSettingsPane.setOnDeleteFeatureRequested(entityCrudController::deleteActiveFeature);
        toolSettingsPane.setOnAddTileToFeatureRequested(entityCrudController::addSelectedSquareToActiveFeature);
        toolSettingsPane.setOnRemoveTileFromFeatureRequested(entityCrudController::removeSelectedSquareFromActiveFeature);
        toolSettingsPane.setOnCancelLink(linkWorkflowController::cancelPendingLink);
    }

    private void bindToolSelections() {
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.setOnAreaProfileSaveRequested(this::saveAreaProfile);
        toolSettingsPane.setOnFeatureSelected(this::handleFeatureSelected);
        toolSettingsPane.setOnTileContextFeatureSelected(this::handleFeatureSelected);
    }

    private void bindToolDerivedSelections() {
        toolSettingsPane.setOnEncounterSelected(this::saveSelectedFeatureEncounter);
    }

    public void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
    }

    public void handleFeatureSelected(DungeonFeature feature) {
        selectionController.selectFeature(feature);
        syncFeatureEncounterSelection();
    }

    public void syncFeatureEncounterSelection() {
        DungeonFeature selectedFeature = toolSettingsPane.selectedFeature();
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
        DungeonFeature feature = toolSettingsPane.selectedFeature();
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
