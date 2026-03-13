package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.readmodel.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.readmodel.index.DungeonMapIndex;
import features.world.dungeonmap.ui.editor.toolbar.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;

import java.util.function.Supplier;

public final class DungeonSelectionRestorer {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionController selectionController;
    private final Supplier<DungeonEditorTool> activeToolSupplier;

    public DungeonSelectionRestorer(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionController selectionController,
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
        if (applyPendingSelection(loadedState.index())) {
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

    private boolean applyPendingSelection(DungeonMapIndex index) {
        DungeonSelectionRestoreRequest restoreRequest = state.pendingSelectionRestore();
        state.setPendingSelectionRestore(null);
        if (restoreRequest == null || restoreRequest.entityId() == null) {
            return false;
        }
        return switch (restoreRequest.type()) {
            case ROOM -> restoreRoomSelection(index, restoreRequest.entityId());
            case AREA -> restoreAreaSelection(index, restoreRequest.entityId());
            case FEATURE -> restoreFeatureSelection(index, restoreRequest.entityId());
            case PASSAGE -> restorePassageSelection(index, restoreRequest.entityId());
        };
    }

    private boolean restoreRoomSelection(DungeonMapIndex index, Long roomId) {
        DungeonRoom room = index.findRoom(roomId);
        if (room == null) {
            return false;
        }
        selectionController.restoreRoomSelection(room);
        return true;
    }

    private boolean restoreAreaSelection(DungeonMapIndex index, Long areaId) {
        DungeonArea area = index.findArea(areaId);
        if (area == null) {
            return false;
        }
        selectionController.restoreAreaSelection(area);
        return true;
    }

    private boolean restoreFeatureSelection(DungeonMapIndex index, Long featureId) {
        DungeonFeature feature = index.findFeature(featureId);
        if (feature == null) {
            return false;
        }
        selectionController.restoreFeatureSelection(feature);
        return true;
    }

    private boolean restorePassageSelection(DungeonMapIndex index, Long passageId) {
        DungeonPassage passage = index.findPassage(passageId);
        if (passage == null) {
            return false;
        }
        selectionController.restorePassageSelection(passage);
        return true;
    }
}
