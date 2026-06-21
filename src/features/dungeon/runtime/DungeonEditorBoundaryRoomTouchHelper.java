package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;

final class DungeonEditorBoundaryRoomTouchHelper {

    boolean editableDoorBoundary(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean deleteMode
    ) {
        if (boundary == null || !boundary.present()) {
            return false;
        }
        if (deleteMode) {
            return boundary.doorKind();
        }
        return !boundary.doorKind() && touchingRoomCount(snapshot, boundary) >= 1;
    }

    private int touchingRoomCount(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            BoundaryTarget boundary
    ) {
        if (snapshot == null) {
            return 0;
        }
        return DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef()).touchingRoomCount(snapshot.areas());
    }

}
