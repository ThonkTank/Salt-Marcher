package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Area;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.TravelHeading;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;

record DungeonEditorBoundaryTouchGeometry(Cell start, Cell end) {

    DungeonEditorBoundaryTouchGeometry {
        Cell safeStart = start == null ? Cell.empty() : start;
        start = safeStart;
        end = end == null ? safeStart : end;
    }

    static DungeonEditorBoundaryTouchGeometry fromEdge(Edge edge) {
        if (edge == null) {
            return new DungeonEditorBoundaryTouchGeometry(Cell.empty(), Cell.empty());
        }
        return new DungeonEditorBoundaryTouchGeometry(edge.from(), edge.to());
    }

    List<Cell> touchingCells() {
        if (start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells();
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells();
        }
        return List.of();
    }

    List<CellKey> touchingCellKeys() {
        List<CellKey> result = new ArrayList<>();
        for (Cell cell : touchingCells()) {
            result.add(new CellKey(cell.q(), cell.r(), cell.level()));
        }
        return List.copyOf(result);
    }

    int touchingCount(Collection<Cell> cells) {
        int count = 0;
        Collection<Cell> safeCells = cells == null ? List.of() : cells;
        for (Cell touchingCell : touchingCells()) {
            for (Cell cell : safeCells) {
                if (touchingCell.equals(cell)) {
                    count++;
                }
            }
        }
        return count;
    }

    String directionForCell(Cell cell) {
        if (cell == null) {
            return "";
        }
        DungeonEditorMainViewInteractionValues.EdgeKey boundaryKey =
                DungeonEditorMainViewInteractionValues.EdgeKey.from(new DungeonEditorWorkspaceValues.Edge(start, end));
        CellKey cellKey = new CellKey(cell.q(), cell.r(), cell.level());
        for (TravelHeading direction : TravelHeading.values()) {
            if (DungeonEditorMainViewInteractionValues.EdgeKey.sideOf(cellKey, direction).equals(boundaryKey)) {
                return direction.name();
            }
        }
        return "";
    }

    int touchingRoomCount(List<Area> areas) {
        return roomTouches(areas).size();
    }

    @Nullable BoundaryRoomTouch singleRoomTouch(@Nullable MapSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        return singleRoomTouch(snapshot.areas());
    }

    @Nullable BoundaryRoomTouch singleRoomTouch(List<Area> areas) {
        List<BoundaryRoomTouch> touches = roomTouches(areas);
        return touches.size() == 1 ? touches.getFirst() : null;
    }

    List<BoundaryRoomTouch> roomTouches(List<Area> areas) {
        List<BoundaryRoomTouch> touches = new ArrayList<>();
        List<Cell> touchingCells = touchingCells();
        for (Area area : areas == null ? List.<Area>of() : areas) {
            if (!area.kind().isRoom()) {
                continue;
            }
            for (Cell cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    touches.add(new BoundaryRoomTouch(area, cell));
                    break;
                }
            }
        }
        return List.copyOf(touches);
    }

    private List<Cell> horizontalTouchingCells() {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<Cell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new Cell(q, start.r() - 1, start.level()));
            result.add(new Cell(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private List<Cell> verticalTouchingCells() {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<Cell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new Cell(start.q() - 1, r, start.level()));
            result.add(new Cell(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }
}
