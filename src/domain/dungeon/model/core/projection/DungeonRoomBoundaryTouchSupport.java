package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public final class DungeonRoomBoundaryTouchSupport {

    private DungeonRoomBoundaryTouchSupport() {
    }

    public static boolean containsAnyRoomCell(Map<Long, List<Cell>> cellsByRoom, Cell cell) {
        for (List<Cell> cells : cellsByRoom.values()) {
            if (cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public static List<Long> touchingRoomIds(Edge edge, Map<Long, List<Cell>> cellsByRoom) {
        List<Long> result = new ArrayList<>();
        List<Cell> touchingCells = edge.touchingCells();
        for (Map.Entry<Long, List<Cell>> entry : cellsByRoom.entrySet()) {
            if (containsAny(entry.getValue(), touchingCells)) {
                result.add(entry.getKey());
            }
        }
        return List.copyOf(result);
    }

    private static boolean containsAny(List<Cell> cells, List<Cell> candidates) {
        for (Cell candidate : candidates) {
            if (cells.contains(candidate)) {
                return true;
            }
        }
        return false;
    }
}
