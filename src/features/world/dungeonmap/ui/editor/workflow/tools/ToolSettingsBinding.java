package features.world.dungeonmap.ui.editor.workflow.tools;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.connection.DungeonLinkFlow;
import features.world.dungeonmap.ui.editor.workflow.entity.DungeonEntityWorkflow;
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
        toolSettingsPane.setOnDeleteFeatureRequested(entityWorkflow::deleteActiveFeature);
        toolSettingsPane.setOnCancelLink(linkFlow::cancelPendingLink);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.setOnAreaProfileSaveRequested(this::saveAreaProfile);
    }

    private void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
    }

    private void saveAreaProfile(DungeonArea area) {
        if (!state.syncingAreaSelection() && area != null && state.currentState() != null) {
            entityWorkflow.saveArea(area);
        }
    }
}
