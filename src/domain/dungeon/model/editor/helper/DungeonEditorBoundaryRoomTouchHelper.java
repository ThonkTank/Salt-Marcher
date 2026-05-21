package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryRoomTouchHelper {

    public boolean editableDoorBoundary(
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

    public @Nullable BoundaryRoomTouch singleRoomTouch(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean requireDoorBoundary
    ) {
        if (snapshot == null || boundary == null || !boundary.present()) {
            return null;
        }
        if (requireDoorBoundary != boundary.doorKind()) {
            return null;
        }
        return DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef()).singleRoomTouch(snapshot);
    }

    public String boundaryDirectionForRoomCell(BoundaryTarget boundary, DungeonEditorWorkspaceValues.Cell roomCell) {
        return DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef()).directionForCell(roomCell);
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
