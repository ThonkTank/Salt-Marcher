package src.domain.dungeon.model.worldspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues;

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
