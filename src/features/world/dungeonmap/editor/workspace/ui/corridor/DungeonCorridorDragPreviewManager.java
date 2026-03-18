package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;

import java.util.Objects;

public final class DungeonCorridorDragPreviewManager {

    private static final double CORRIDOR_DOOR_PREVIEW_HALF_LENGTH = 0.35;

    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneRenderState renderState;
    private final DungeonCorridorProjectionSupport corridorProjectionSupport;

    public DungeonCorridorDragPreviewManager(
            DungeonPanePreviewModel previewModel,
            DungeonPaneRenderState renderState,
            DungeonCorridorProjectionSupport corridorProjectionSupport
    ) {
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.corridorProjectionSupport = Objects.requireNonNull(corridorProjectionSupport, "corridorProjectionSupport");
    }

    public CorridorEditInteractionController.DoorDragPreview corridorDoorPreview() {
        return renderState.previewState().previewCorridorDoorDrag();
    }

    public CorridorDoorHandle previewCorridorDoorHandle() {
        return renderState.previewState().previewCorridorDoorHandle();
    }

    public boolean isPreviewDoor(long corridorId, long roomId) {
        CorridorEditInteractionController.DoorDragPreview previewDrag = renderState.previewState().previewCorridorDoorDrag();
        CorridorDoorHandle previewHandle = renderState.previewState().previewCorridorDoorHandle();
        long previewRoomId = previewDrag != null && previewDrag.snapTarget() != null
                ? previewDrag.snapTarget().roomId()
                : previewHandle == null ? Long.MIN_VALUE : previewHandle.roomId();
        return previewHandle != null
                && previewHandle.corridorId() == corridorId
                && previewRoomId == roomId
                && previewDrag != null;
    }

    public boolean clearCorridorDoorPreview() {
        if (renderState.previewState().previewCorridorDoorHandle() == null
                && renderState.previewState().previewCorridorDoorDrag() == null) {
            return false;
        }
        renderState.previewState().setPreviewCorridorDoorHandle(null);
        renderState.previewState().setPreviewCorridorDoorDrag(null);
        return true;
    }

    public boolean updateCorridorDoorPreview(
            CorridorDoorHandle handle,
            CorridorEditInteractionController.DoorDragPreview preview
    ) {
        if (previewModel.hasClusterDragPreview()) {
            return clearCorridorDoorPreview();
        }
        if (handle == null || preview == null || preview.previewSegment() == null || preview.snapTarget() == null) {
            return clearCorridorDoorPreview();
        }
        if (Objects.equals(renderState.previewState().previewCorridorDoorHandle(), handle)
                && Objects.equals(renderState.previewState().previewCorridorDoorDrag(), preview)) {
            return false;
        }
        renderState.previewState().setPreviewCorridorDoorHandle(handle);
        renderState.previewState().setPreviewCorridorDoorDrag(preview);
        return true;
    }

    public CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
            double screenX,
            double screenY,
            CorridorDoorHandle handle
    ) {
        if (previewModel.hasClusterDragPreview()) {
            return null;
        }
        return corridorProjectionSupport.projectCorridorDoorDragPreview(
                screenX,
                screenY,
                handle,
                CORRIDOR_DOOR_PREVIEW_HALF_LENGTH);
    }
}
