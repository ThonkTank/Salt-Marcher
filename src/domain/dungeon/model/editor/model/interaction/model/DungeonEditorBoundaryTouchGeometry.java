package src.domain.dungeon.model.editor.model.interaction.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Edge;

public record DungeonEditorBoundaryTouchGeometry(Cell start, Cell end) {

    public DungeonEditorBoundaryTouchGeometry {
        Cell safeStart = start == null ? Cell.empty() : start;
        start = safeStart;
        end = end == null ? safeStart : end;
    }

    public static DungeonEditorBoundaryTouchGeometry fromEdge(Edge edge) {
        if (edge == null) {
            return new DungeonEditorBoundaryTouchGeometry(Cell.empty(), Cell.empty());
        }
        return new DungeonEditorBoundaryTouchGeometry(edge.from(), edge.to());
    }

    public List<Cell> touchingCells() {
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

    public List<CellKey> touchingCellKeys() {
        List<CellKey> result = new ArrayList<>();
        for (Cell cell : touchingCells()) {
            result.add(new CellKey(cell.q(), cell.r(), cell.level()));
        }
        return List.copyOf(result);
    }

    public int touchingCount(Set<Cell> cells) {
        int count = 0;
        Set<Cell> safeCells = cells == null ? Set.of() : cells;
        for (Cell touchingCell : touchingCells()) {
            if (safeCells.contains(touchingCell)) {
                count++;
            }
        }
        return count;
    }

    public String directionForCell(Cell cell) {
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
