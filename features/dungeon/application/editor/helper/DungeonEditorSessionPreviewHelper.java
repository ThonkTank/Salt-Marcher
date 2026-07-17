package features.dungeon.application.editor.helper;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;

public interface DungeonEditorSessionPreviewHelper {
    static boolean clearsSelectionAfterApply(DungeonEditorSessionValues.Preview preview) {
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room -> room.deleteMode();
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries -> boundaries.deleteMode();
            case DungeonEditorSessionValues.StairCreatePreview ignored -> false;
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> true;
            case DungeonEditorSessionValues.NoPreview ignored -> false;
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> false;
            case DungeonEditorSessionValues.MoveHandlePreview ignored -> false;
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview ignored -> false;
        };
    }

    static boolean inMemoryDragPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            DungeonEditorHandleKind kind = moveHandle.handleRef().kind();
            return kind == DungeonEditorHandleKind.DOOR
                    || kind == DungeonEditorHandleKind.CLUSTER_LABEL
                    || kind == DungeonEditorHandleKind.CLUSTER_CORNER
                    || kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN;
        }
        return preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview;
    }

    static boolean directClusterMoveCommitHandle(DungeonEditorHandleKind kind) {
        return kind != null && kind.isDirectClusterMoveCommit();
    }

    static boolean directDoorMoveCommitHandle(DungeonEditorHandleKind kind) {
        return kind != null && kind.isDirectDoorMoveCommit();
    }

    static boolean directCorridorMoveCommitHandle(DungeonEditorHandleKind kind) {
        return kind != null && kind.isDirectCorridorMoveCommit();
    }

}
