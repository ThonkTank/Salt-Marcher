package features.world.dungeonmap.ui.editor.workflow.loading;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionWorkflowController;

import java.util.function.Supplier;

public final class DungeonSelectionRestoreController {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final Supplier<DungeonEditorTool> activeToolSupplier;

    public DungeonSelectionRestoreController(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            Supplier<DungeonEditorTool> activeToolSupplier
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.activeToolSupplier = activeToolSupplier;
    }

    public void setPendingSelectionRestore(DungeonSelectionRestoreRequest request) {
        state.setPendingSelectionRestore(request);
    }

    public boolean restoreAfterLoad(DungeonMapState loadedState) {
        if (loadedState == null) {
            state.setPendingSelectionRestore(null);
            return false;
        }
        if (applyPendingSelection(loadedState)) {
            return true;
        }
        autoShowForTool(activeToolSupplier.get());
        return false;
    }

    public void autoShowForTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        if (!effectiveTool.autoShowsSelectedArea()) {
            return;
        }
        DungeonArea area = toolSettingsPane.selectedArea();
        if (area != null) {
            selectionController.selectArea(area);
        }
    }

    private boolean applyPendingSelection(DungeonMapState loadedState) {
        DungeonSelectionRestoreRequest restoreRequest = state.pendingSelectionRestore();
        state.setPendingSelectionRestore(null);
        if (restoreRequest == null || restoreRequest.entityId() == null) {
            return false;
        }
        return switch (restoreRequest.type()) {
            case ROOM -> restoreRoomSelection(loadedState, restoreRequest.entityId());
            case AREA -> restoreAreaSelection(loadedState, restoreRequest.entityId());
            case FEATURE -> restoreFeatureSelection(loadedState, restoreRequest.entityId());
            case PASSAGE -> restorePassageSelection(loadedState, restoreRequest.entityId());
        };
    }

    private boolean restoreRoomSelection(DungeonMapState loadedState, Long roomId) {
        for (DungeonRoom room : loadedState.rooms()) {
            if (roomId.equals(room.roomId())) {
                selectionController.restoreRoomSelection(room);
                return true;
            }
        }
        return false;
    }

    private boolean restoreAreaSelection(DungeonMapState loadedState, Long areaId) {
        for (DungeonArea area : loadedState.areas()) {
            if (areaId.equals(area.areaId())) {
                selectionController.restoreAreaSelection(area);
                return true;
            }
        }
        return false;
    }

    private boolean restoreFeatureSelection(DungeonMapState loadedState, Long featureId) {
        for (DungeonFeature feature : loadedState.features()) {
            if (featureId.equals(feature.featureId())) {
                selectionController.restoreFeatureSelection(feature);
                return true;
            }
        }
        return false;
    }

    private boolean restorePassageSelection(DungeonMapState loadedState, Long passageId) {
        for (DungeonPassage passage : loadedState.passages()) {
            if (passageId.equals(passage.passageId())) {
                selectionController.restorePassageSelection(passage);
                return true;
            }
        }
        return false;
    }
}
