package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonEdge;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class DungeonRoomBoundaryTouchSupport {

    private DungeonRoomBoundaryTouchSupport() {
    }

    static boolean containsAnyRoomCell(Map<Long, List<DungeonCell>> cellsByRoom, DungeonCell cell) {
        for (List<DungeonCell> cells : cellsByRoom.values()) {
            if (cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    static List<Long> touchingRoomIds(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        List<Long> result = new ArrayList<>();
        List<DungeonCell> touchingCells = edge.touchingCells();
        for (Map.Entry<Long, List<DungeonCell>> entry : cellsByRoom.entrySet()) {
            if (containsAny(entry.getValue(), touchingCells)) {
                result.add(entry.getKey());
            }
        }
        return List.copyOf(result);
    }

    private static boolean containsAny(List<DungeonCell> cells, List<DungeonCell> candidates) {
        for (DungeonCell candidate : candidates) {
            if (cells.contains(candidate)) {
                return true;
            }
        }
        return false;
    }
}
