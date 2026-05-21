package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
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
        List<DungeonEditorWorkspaceValues.Cell> touchingCells = touchingCells(
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
        List<CellKey> touchingCells = touchingCellKeys(
                boundary.start().toWorkspaceCell(),
                boundary.end().toWorkspaceCell());
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

    private static List<CellKey> touchingCellKeys(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        List<CellKey> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Cell cell : touchingCells(start, end)) {
            result.add(new CellKey(cell.q(), cell.r(), cell.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> touchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        if (start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonEditorWorkspaceValues.Cell> horizontalTouchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r() - 1, start.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> verticalTouchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(start.q() - 1, r, start.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }
}
