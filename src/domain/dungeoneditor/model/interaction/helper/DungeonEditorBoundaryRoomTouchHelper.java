package src.domain.dungeoneditor.model.interaction.helper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

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
        List<DungeonEditorWorkspaceValues.Cell> touchingCells = DungeonEditorBoundaryRoomTouchSupportHelper.touchingCells(
                boundary.start().toWorkspaceCell(),
                boundary.end().toWorkspaceCell());
        List<BoundaryRoomTouch> touches = roomTouches(snapshot.areas(), touchingCells);
        return touches.size() == 1 ? touches.getFirst() : null;
    }

    public String boundaryDirectionForRoomCell(BoundaryTarget boundary, DungeonEditorWorkspaceValues.Cell roomCell) {
        EdgeKey boundaryKey = EdgeKey.from(boundary.edgeRef());
        CellKey cellKey = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (TravelHeading direction : TravelHeading.values()) {
            if (EdgeKey.sideOf(cellKey, direction).equals(boundaryKey)) {
                return direction.name();
            }
        }
        return "";
    }

    private int touchingRoomCount(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            BoundaryTarget boundary
    ) {
        if (snapshot == null) {
            return 0;
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        List<CellKey> touchingCells = DungeonEditorBoundaryRoomTouchSupportHelper.touchingCells(
                boundary.start().toWorkspaceCell(),
                boundary.end().toWorkspaceCell()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom()) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                    roomIds.add(area.id());
                }
            }
        }
        return roomIds.size();
    }

    private static List<BoundaryRoomTouch> roomTouches(
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Cell> touchingCells
    ) {
        List<BoundaryRoomTouch> touches = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Area area : areas) {
            if (!area.kind().isRoom()) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    touches.add(new BoundaryRoomTouch(area, cell));
                    break;
                }
            }
        }
        return List.copyOf(touches);
    }
}
