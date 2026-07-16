package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;

final class CorridorHostRoomCellSelection {

    Cell nearestRoomCell(List<Cell> roomCells, Cell anchor) {
        Cell nearest = anchor;
        for (Cell cell : roomCells == null ? List.<Cell>of() : roomCells) {
            if (cell != null) {
                nearest = nearestCell(nearest, cell, anchor);
            }
        }
        return nearest;
    }

    private static Cell nearestCell(Cell current, Cell candidate, Cell anchor) {
        return roomCellComparison(candidate, current, anchor) < 0 ? candidate : current;
    }

    private static int roomCellComparison(Cell candidate, Cell current, Cell anchor) {
        int distance = Integer.compare(distanceFrom(candidate, anchor), distanceFrom(current, anchor));
        if (distance != 0) {
            return distance;
        }
        int row = Integer.compare(candidate.r(), current.r());
        return row == 0 ? Integer.compare(candidate.q(), current.q()) : row;
    }

    private static int distanceFrom(Cell left, Cell right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }
}
