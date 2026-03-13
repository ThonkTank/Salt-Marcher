package features.world.dungeonmap.ui.editor.workflow.entity;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.ui.editor.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.connection.DungeonLinkFlow;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionController;

public final class ToolSettingsBinding {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionController selectionController;
    private final DungeonLinkFlow linkFlow;
    private final DungeonEntityWorkflow entityWorkflow;

    public ToolSettingsBinding(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionController selectionController,
            DungeonLinkFlow linkFlow,
            DungeonEntityWorkflow entityWorkflow
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.linkFlow = linkFlow;
        this.entityWorkflow = entityWorkflow;
    }

    public void bindToolSettings() {
        toolSettingsPane.setOnNewAreaRequested(entityWorkflow::createArea);
        toolSettingsPane.setOnDeleteAreaRequested(entityWorkflow::deleteActiveArea);
        toolSettingsPane.setOnNewFeatureRequested(entityWorkflow::createFeature);
        toolSettingsPane.setOnDeleteFeatureRequested(entityWorkflow::deleteActiveFeature);
        toolSettingsPane.setOnAddTileToFeatureRequested(entityWorkflow::addSelectedSquareToActiveFeature);
        toolSettingsPane.setOnRemoveTileFromFeatureRequested(entityWorkflow::removeSelectedSquareFromActiveFeature);
        toolSettingsPane.setOnCancelLink(linkFlow::cancelPendingLink);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.setOnAreaProfileSaveRequested(this::saveAreaProfile);
        toolSettingsPane.setOnFeatureSelected(this::handleFeatureSelected);
        toolSettingsPane.setOnTileContextFeatureSelected(this::handleFeatureSelected);
        toolSettingsPane.setOnEncounterSelected(this::saveSelectedFeatureEncounter);
    }

    public void syncFeatureEncounterSelection() {
        DungeonFeature selectedFeature = toolSettingsPane.selectedFeature();
        state.runWhileSyncingFeatureSelection(() ->
                toolSettingsPane.selectEncounter(selectedFeature == null ? null : selectedFeature.encounterId()));
    }

    private void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
    }

    private void handleFeatureSelected(DungeonFeature feature) {
        selectionController.selectFeature(feature);
        syncFeatureEncounterSelection();
    }

    private void saveAreaProfile(DungeonArea area) {
        if (!state.syncingAreaSelection() && area != null && state.currentState() != null) {
            entityWorkflow.saveArea(area);
        }
    }

    private void saveSelectedFeatureEncounter(DungeonEncounterSummary selectedEncounter) {
        DungeonFeature feature = toolSettingsPane.selectedFeature();
        if (state.syncingFeatureSelection()
                || feature == null
                || state.currentState() == null
                || feature.category() != features.world.dungeonmap.model.DungeonFeatureCategory.ENCOUNTER) {
            return;
        }
        entityWorkflow.saveFeature(new DungeonFeature(
                feature.featureId(),
                feature.mapId(),
                feature.category(),
                selectedEncounter == null ? null : selectedEncounter.encounterId(),
                feature.name(),
                feature.notes()));
    }
}
