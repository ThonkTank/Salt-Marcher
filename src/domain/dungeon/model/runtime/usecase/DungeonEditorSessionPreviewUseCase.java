package src.domain.dungeon.model.runtime.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;

final class DungeonEditorSessionPreviewUseCase {
    private DungeonEditorSessionPreviewUseCase() {
    }

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
            DungeonEditorHandleType kind = moveHandle.handleRef().kind();
            return kind == DungeonEditorHandleType.DOOR
                    || kind == DungeonEditorHandleType.CLUSTER_LABEL
                    || kind == DungeonEditorHandleType.CLUSTER_CORNER
                    || kind == DungeonEditorHandleType.CLUSTER_WALL_RUN;
        }
        return preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview;
    }

    static boolean directClusterMoveCommitHandle(DungeonEditorHandleType kind) {
        return kind == DungeonEditorHandleType.CLUSTER_LABEL
                || kind == DungeonEditorHandleType.CLUSTER_CORNER;
    }
}
